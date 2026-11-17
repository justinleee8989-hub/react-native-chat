# 进入会话耗时测试说明 · 第二轮（Android Release）— 2026-11-18

第一轮结果见 [`RESULTS_1.md`](RESULTS_1.md)。构建、抓日志、打点含义和第一轮相同，见 [`TEST_1.md`](TEST_1.md)；这里只写第二轮的变化和要测的内容。

测完后填写 [`RESULTS_2.md`](RESULTS_2.md)，原始日志放进 `docs/openim/evidence/2026-11-18-entry-perf-2/`，提交并推送到 `perf/openim-open-chat`。

## 一、第一轮发现了什么

热进入（页面已预热）时，每一次都是同样的结构：

| | 短会话 | 长会话 |
|---|---|---|
| 点击 → `navigate` | 约 15ms | 约 20ms |
| `navigate` → `transition-start` | 约 80ms | **约 330ms** |
| 原生转场动画（`transition-start` → `transition-end`） | 约 450ms | 约 390ms |
| 点击 → `transition-end` | 约 545ms | **约 720ms** |

长会话多出来的时间，都在导航后、动画开始前，而且每一次 `page-commit` 大约要 100ms。导航和 focus 之后，聊天页会提交 3 次左右，**每一次都会让所有消息行重新渲染**。原因是：

- 传给 `Chat` 的 `renderMessage`、`renderBubble`、`renderCustomView`、`renderDay`、`messageActions`，在每次渲染时都是新的函数；
- `useProductChatTheme()` 每次也返回一个新的主题对象。

SDK 只稳定 `on*` 开头的回调，其它属性一旦换了新的引用，就会让每一行消息都重渲染。主题换了新对象，也会让所有用到主题的组件重渲染。

## 二、本轮改动

| 改动 | 预期效果 |
|---|---|
| `renderBubble`、`renderDay`、`renderChatEmpty` 改为模块级常量 | 不再每次渲染都换新函数 |
| `renderMessage`、`renderCustomView`、`messageActions` 改为 `useCallback`，依赖只保留所有行共用的内容：列表宽度、最后一条自己发的消息、是否群聊、当前用户 | focus 标记已读、在线状态、输入中提示等和消息行无关的 store 变化，不再导致消息行重渲染 |
| 每条投影消息上直接带着它的**原始 OpenIM 消息**和**已读人数**，回调里不再每行 `rawMessages.find` 一遍 | 某条消息变化（已读、确认、编辑）时，只有那一行重渲染；查找从 O(n) 变为 O(1) |
| `reactions` 对象改为 `useMemo` | 同上 |
| `useProductChatTheme()` 的返回值改为 `useMemo` | 主题引用保持稳定，聊天页重渲染时不再让所有气泡重渲染 |
| 新增 **`动画`** 实验开关，可选：`default` / `slide_from_right` / `ios_from_right` / `fade` / `fade_from_bottom` / `none` | 原生动画目前约占 400–450ms，用来实测哪个动画最短、看起来也自然 |
| 修正 `ChatListScreen.tsx` 的 import 排序（第一轮报告里的 lint 失败） | — |

诊断包里的面板现在有四个按钮：`进入`、`Activity`、`缓冲`、`动画`。默认值是 `wait-ready` / `on` / `after-transition` / `default`。`press-*` 行的 `detail` 里也会带上 `anim=`。

**第一轮的结论不变：** `navigate-now` 会露出空白的消息区，Activity 不是主要原因，所以这一轮不再测 `进入` 和 `Activity` 两个开关，保持默认即可。

## 三、要测什么

### T1 消息行稳定化（默认配置，动画 `default`）

和第一轮的 R2 对比，测同样的短会话和长会话，同样是冷进入 1 次加热进入 3 次。

**重点看这几个数字：**

- **热进入长会话**：`transition-start` 是否从约 350ms 提前到 100–150ms，`transition-end` 是否从约 720ms 降到约 550ms。
- **导航后的 `page-commit` 间隔**：前后两次 `page-commit` 的 `sinceMs` 差值，是否从约 100ms 降到几十毫秒。
- **导航后的最大 `long-frame`**：第一轮热进入长会话约为 220ms。
- **冷进入长会话的 `navigate`**：第一轮约为 630ms。

### T2 连续切换不同会话（默认配置，动画 `default`）

第一轮的热进入全部都是"预热命中"（同一个会话返回后再进），而实际使用中更常见的是在多个会话之间切换。

步骤：冷启动后，依次打开长会话 → 返回 → 打开短会话 → 返回 → 打开长会话 → 返回 → 打开短会话，每次返回后等 1 秒。每次打开都记一组数字，并标注是否预热命中。

### T3 转场动画

用默认配置，只切换 `动画`。每种动画测**长会话热进入 3 次**，并录一段屏。

| 编号 | 动画 |
|---|---|
| T3a | `default`（可以直接用 T1 的数据） |
| T3b | `slide_from_right` |
| T3c | `ios_from_right` |
| T3d | `fade` |
| T3e | `fade_from_bottom` |
| T3f | `none`（只作参考，用来看去掉动画后的下限） |

**每种动画请记：**

- 动画时长：`transition-end` 减 `transition-start`；
- 点击到动画结束：`transition-end`；
- 主观感受：是否自然，有没有闪烁、白屏或者先黑一下。

## 四、功能回归（这轮改了消息行的渲染，请务必检查）

请在长会话或群聊里逐项确认：

- [ ] 消息气泡、时间、发送状态显示正常，**和改动前一致**
- [ ] 群聊的**已读人数**正确；对方读了之后数字会**更新**
- [ ] 长按菜单：复制、回复、转发、编辑（自己发的文字）、撤回、已读成员，**该出现的都出现，不该出现的不出现**
- [ ] 点击已读成员能跳到正确的页面
- [ ] 表情回应：点一下能加上，再点能取消，数字正确
- [ ] 发送失败的消息点重试有效
- [ ] 通话消息、名片、位置等自定义内容显示正常，点击有效
- [ ] 新消息到达、自己发消息时，列表正常更新，没有跳动
- [ ] 切换深色模式或改变窗口宽度时，气泡样式正确更新

**有任何一项不对，请直接写在结果里**，这比耗时数据更重要。
