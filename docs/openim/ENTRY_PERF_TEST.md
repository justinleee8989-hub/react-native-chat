# 进入会话耗时测试说明（Android Release）— 2026-11-18

问题：在会话列表点击有历史消息的会话，到聊天页可用大约要 0.6 秒。

本分支 `perf/openim-open-chat` 基于 `feat/openim-integration`，做了三件事：

1. **扩充已有的 `[IMEntry]` 打点**：从手指按下开始计时，补上页面提交次数、页面和列表布局、转场开始和结束、JS 卡帧等节点。
2. **加入三个运行时实验开关**：只在诊断包里显示，一个 Release 包就能对比不同组合。
3. **几处默认生效的优化**，见第一节。

测完后请把结果填进 [`ENTRY_PERF_RESULTS.md`](ENTRY_PERF_RESULTS.md)，把原始日志放进 `docs/openim/evidence/2026-11-18-entry-perf/`，提交并推送到本分支。我再根据数据决定下一步。

---

## 一、本次改动

只改了 `example/`，SDK 的 `src/` 没动，不需要重新构建 `lib/`。

### 默认生效的优化（普通 Release 也会生效）

| 改动 | 原因 |
|---|---|
| **列表缓冲扩展推迟到转场结束后**（`useMessageListLayout`）。列表就绪后，`drawDistance` 从 600 扩到两屏（最多 2400），以前在就绪后两帧就扩，现在等推入动画结束（最多等 700ms）。 | 列表就绪会立刻触发导航，两帧后扩缓冲正好落在转场开始时，额外的消息行和转场动画抢同一批帧。 |
| **传给 `Chat` 的 `messages` 改为 `useMemo`**（`ChatScreen`）。依赖是原始消息、`messageID` 和 extras。 | `SessionChat` 订阅了整个 IM store，任何全局变化都会让它重渲染；以前每次都重建全部消息对象，列表要把每一行重新比较一遍，预渲染期间这种重渲染会发生好几次。 |
| **`useMessageExtras` 改为可被 React Compiler 编译**：渲染期间写 ref 改到 `useLayoutEffect` 里；`map` 用 `useCallback`，返回值用 `useMemo`。 | 渲染期间写 ref 会让 Compiler 跳过整个 hook，导致 `map` 每次渲染都是新函数，上面的 `useMemo` 就没用了。 |
| **`mergeMessageExtras` 在没有变化时返回原对象**（`extras.ts`）。 | 每 2.5 秒一次的 extras 轮询以前每次都生成新对象，导致整页消息重新投影一遍。 |

### 只在诊断包里出现的实验开关

诊断包（`EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`）的会话列表左下角有三个按钮，点一下切换到下一个值。**每次冷启动都会恢复默认值。**

| 按钮 | 选项 | 说明 |
|---|---|---|
| `进入` | **`wait-ready`**（默认，原行为） / `navigate-now` | `wait-ready`：先在屏幕外把真实页面和列表布局好，再导航，等待期间列表保持不动。`navigate-now`：点击后立刻导航，页面在滑入过程中构建，历史消息在后台加载。 |
| `Activity` | **`on`**（默认，原行为） / `off` | 根 stack 和 `chats` stack 的 `activityEnabled`。要验证的猜测是：预渲染的页面是否被放进隐藏的 React Activity，以低优先级渲染，从而拖慢预布局。 |
| `缓冲` | **`after-transition`**（默认，新行为） / `two-frames` | 列表缓冲在转场结束后扩展（新），还是就绪后两帧就扩展（原行为）。 |

切到 `进入: wait-ready`、`Activity: on`、`缓冲: two-frames`，就等于本分支之前的原行为（基准），只是 messages 和 extras 的稳定化仍然生效。

## 二、打诊断 Release 包

`EXPO_PUBLIC_OPENIM_ENTRY_TRACE` 是在打包 JS 时写进去的，所以打诊断包时要带上这个环境变量：

```bash
cd example/android && EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1 ./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

```bash
adb install -r example/android/app/build/outputs/apk/release/app-release.apk
```

如果装好后会话列表左下角**没有出现三个按钮**，说明环境变量没生效（多半是用了旧的打包缓存）。先执行 `./gradlew clean` 再打包。

## 三、抓日志

```bash
adb logcat -c
```

```bash
adb logcat -s ReactNativeJS:V | grep IMEntry | tee entry.log
```

每行的格式是：

```
[IMEntry] {"sample":3,"phase":"list-ready","atMs":81234,"sinceMs":412,"detail":"..."}
```

- `sample`：会话编号。同一个会话始终是同一个编号，日志里不会出现会话 id 或账号。
- `sinceMs`：**距离手指按下（`press-in`）的毫秒数**，分析时主要看这个字段。
- `detail`：附加信息。`press-*` 行里带的是当时三个开关的设置。

## 四、时间节点说明（大致按出现顺序）

| phase | 什么时候 | 看什么 |
|---|---|---|
| `press-in` | 手指按下会话行，**计时从这里开始（0）** | — |
| `prepare` | 开始在屏幕外预渲染真实页面（`router.prefetch`） | 如果页面已经预热好了，这一行不会出现 |
| `press-cached` / `press-cold` | 手指抬起、触发点击。`cached` 表示本地已有这个会话的消息，`cold` 表示没有，需要先读 SDK | `detail` 里是当时三个开关的设置 |
| `history-ready` | SDK 历史读取完成（已有缓存时会立即出现） | 以前实测只有 10ms 左右，如果这里很大，说明是 SDK 侧的问题 |
| `page-commit #n` | 聊天页每提交一次就打一行 | **导航前出现了几次**：次数越多，等待中重复渲染越多。超过 12 次后只再打一行汇总 |
| `page-layout` | 聊天页根 View 第一次 `onLayout` | 和 `page-commit #1` 的差值 = 首次提交到原生布局完成的时间。**以前实测这段约 370ms，是最大的空档** |
| `list-layout` | 消息列表视口第一次 `onLayout` | — |
| `list-ready` | 列表报告就绪（LegendList `onReady`） | `wait-ready` 模式下要等到这一步才导航 |
| `navigate` | 真正开始导航 | **`press-in → navigate` = 用户点了之后，列表还停留不动的时间**，这是体感上"点了没反应"的主要部分 |
| `transition-start` | 原生推入动画开始 | 可能不出现（动画开始时监听还没注册），不影响分析 |
| `focus` / `focused-frame` | 页面获得焦点 / 获得焦点后两帧 | — |
| `transition-end` | 推入动画结束 | `navigate → transition-end` = 转场时长 |
| `long-frame` | 按下后 2.5 秒内，JS 线程有一帧超过 34ms，`detail` 是这一帧的实际时长 | 对照前后的 phase，看是在预渲染期间还是转场期间出现的 |
| `duplicate-ignored` / `entry-failed` / `retire` | 重复点击被忽略 / 1.5 秒内页面没就绪而放弃 / 页面离开 | 出现 `entry-failed` 请一定记下来 |

**注意：** 如果页面在按下之前就已经预热好了（列表获得焦点 200ms 后会自动预热最近的一个会话），`page-commit`、`page-layout`、`list-ready` 会出现在 `press-in` **之前**，这次点击会直接 `navigate`。这种情况请在结果里标为"预热命中"。

**每次打开请记下这几个数字（都是 `sinceMs`）：**

1. **A 点击到导航**：`navigate`
2. **B 列表就绪**：`list-ready`
3. **C 转场结束**：`transition-end`
4. **D 首次提交到页面布局**：`page-layout` 减 `page-commit #1`
5. **E 导航前的 page-commit 次数**
6. **F 最大 long-frame**，并注明它出现在 `navigate` 之前还是之后

## 五、测试矩阵

### 会话选择

- **短会话**：10 条以内的消息。
- **长会话**：一屏以上，例如之前用过的 QA 长会话。
- **群聊**：有已读数和成员头像。
- **多媒体会话**：有图片、语音或文件。

每个会话打开 **4 次**：

- 第 1 次在**冷启动 app 后**马上点，记为"冷"。
- 第 2–4 次是返回列表、等 1 秒后再点同一个会话，取中位数，记为"热"。
- 如果某一次是"预热命中"，请单独标出来。

### 测试轮次

| 轮次 | 进入 | Activity | 缓冲 | 目的 |
|---|---|---|---|---|
| R1 | wait-ready | on | two-frames | 基准，接近原行为 |
| R2 | wait-ready | on | after-transition | 本次的默认配置 |
| R3 | navigate-now | on | after-transition | 点击后立刻导航 |
| R4 | wait-ready | off | after-transition | 验证 Activity 是否拖慢预布局（看 D 和 B） |
| R5 | navigate-now | off | after-transition | 两个都开时的效果 |

时间不够的话，优先测 **R1、R2、R3、R4**，会话只测长会话和短会话。

### 主观感受（每轮都请写一句）

- 点下去是不是马上有反应？
- 滑入时卡不卡？
- 页面出来时消息是否完整？有没有空白、闪烁、跳动，或者先出现半屏？
- 返回列表是否正常？

## 六、怎么回复

1. 填写 [`ENTRY_PERF_RESULTS.md`](ENTRY_PERF_RESULTS.md)。
2. 原始日志按轮次存放：`docs/openim/evidence/2026-11-18-entry-perf/R1.log` 到 `R5.log`。
3. 提交并推送到 `perf/openim-open-chat`，然后告诉我一声。
