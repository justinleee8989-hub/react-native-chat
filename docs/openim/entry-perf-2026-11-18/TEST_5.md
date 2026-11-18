# 进入会话测试说明 · 第五轮（Android Release）— 2026-11-18

第四轮结果见 [`RESULTS_4.md`](RESULTS_4.md)。构建、抓日志和打点含义同 [`TEST_1.md`](TEST_1.md)，构建仍加 `EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`。

测完后填 `RESULTS_5.md`，日志和录屏放到 `docs/openim/evidence/2026-11-18-entry-perf-5/`，提交并推送到 `perf/openim-open-chat`。

## 一、本轮针对第四轮的三个问题

| 第四轮的问题 | 原因 | 本轮改动 |
|---|---|---|
| V1 冷启动打开长会话后马上快速上滑，3/3 出现 150–250ms 空带 | 打开会话时内存里**只有最新一页（30 条）消息**，首屏 28 行。连续三次快速上滑约 0.3 秒就到了这 30 条的顶部，这时才开始拉下一页，拉回来后再渲染（日志里 1.0–1.25s 那个 246ms 的长帧），中间就是空带，然后"后续仍有行补入" | **在列表扩展缓冲的同时预取上一页历史**：用户第一次拖动或转场结束（以先到者为准）时，如果已加载的消息不到 60 条且还有更早的，就拉一次上一页。用户滑到顶部之前，上一页通常已经在内存里了 |
| V6 冷启动后首次进入通讯录，标题先贴近状态栏，然后下移 | 通讯录、设置等页面共用 `ProductPage`，顶部安全区由**原生** `SafeAreaView` 加内边距。页面第一次挂载时，原生侧要晚一帧才把内边距加上，所以第一帧标题在状态栏下面，下一帧跳下来。第二次进入时页面已挂载，所以正常。聊天页头部用的是 `useSafeAreaInsets()`，所以从来不跳 | `ProductPage` 改为用 `useSafeAreaInsets()` 在 JS 侧算出 `paddingTop`，第一帧就在正确位置。所有用 `ProductPage` 的页面（通讯录、群组、设置、已读明细等）都会受益 |
| V3 推送分支缺少当前后端的可见性、通话记录等改动，无法部署 | 推送分支是从旧基点拉出来的 | `chat` 的 `feat/group-read-push` **已合入当前部署的 `feature/rtc-terminal-records`（`d5f9db7`）**，合并提交为 `054fd9a`。相对当前后端只多 4 个文件，测试已通过。`open-im-server` 分支本来就基于当前的 `e089f78`，不用动。详见 [推送说明](../GROUP_READ_PUSH_2026-11-18.md) |

预取不会增加进入会话的耗时：它发生在页面已经显示之后（第一次拖动或转场结束），拿到的消息只进入数据，不在缓冲范围内的不会渲染。

## 二、要测什么

### V1 快速上滑空带（复测）

方法与第四轮相同：force-stop 冷启动，打开长会话，看到 `navigate` 后约 100ms 连续三次快速上滑，录屏，3 次。

记录：
- 是否还有空带、出现在录屏的什么时间点、持续多久；
- 日志里是否还有 1.0s 之后的 200ms 以上长帧；
- 继续往上滑到更早的消息时，是否正常加载（顶部的"加载更早消息"指示是否正常出现和消失）。

> 说明：冷启动时每行第一次渲染的成本较高（第四轮首屏 28 行用了约 200ms），所以在页面还在滑入时就**极快地**甩到很远，仍有可能短暂看到未渲染的行。本轮的目标是消除"滑到已加载消息顶部后等下一页"这一段。如果空带仍然明显，请记录空带出现时已经滑过了多少条消息。

### V3 群已读推送联调

按 [推送说明](../GROUP_READ_PUSH_2026-11-18.md) 的第四、五节部署：

1. `chat` 用 `feat/group-read-push`（`054fd9a`）构建，设置环境变量 `OPENIM_WEBHOOK_SECRET`，并确认消息扩展已开启（`MESSAGE_EXTRAS_ENABLED` 或 RTC）。
2. `open-im-server` 用 `feat/group-read-webhook-context`（`280d0a23d`）构建，打开 `afterGroupMsgRead` webhook，URL 指向 `chat-api` 的 `/callback/openim_webhook/<secret>`。
3. 按推送说明第五节的验证清单测试，并填写其中的结果表。

重点记录：Android 停在群聊页时，伙伴阅读后已读人数**几秒内**从 0 变为 1（测两次）；群里没有多出可见消息；chat-api 日志里没有 `group read notification failed`，也没有 `message extras are disabled`。

### V4 速度回归

方法同第四轮，各 3 次：长会话热进入的 `transition-end`；长 → 短 → 长的未预热 `navigate`。应与第四轮持平（约 290ms / 约 220ms）。

### V6 冷启动首次进入通讯录（复测）

方法同第四轮，3 次，重点看最初 250ms 的帧：标题、搜索框在首次进入时应该一开始就在正确位置，不再上下跳。

另外抽查一次：冷启动后首次进入"我"/设置页、群组列表，标题位置同样稳定。

### V5 抽查

- 已读成员页、长按菜单、表情回应（同第四轮）；
- 打开一个只有几条消息的短会话，确认没有多余的加载指示，也没有报错。

## 三、自动测试

本轮新增或修改的测试：

- `useMessageListLayout.ui.test.tsx`：新增"缓冲扩展只通知一次，不管是先拖动还是先结束转场"；
- `NewMessageScreen.ui.test.tsx`：`react-native-safe-area-context` 的 mock 改为提供 `useSafeAreaInsets`（`ProductPage` 不再用 `SafeAreaView`）；
- `chat`：合并后 `go test ./internal/api/chat/ ./pkg/common/...` 本机已通过。

请照常跑 UI、typecheck、lint、OpenIM 业务测试和 Android Release 构建。本机缺少依赖，Jest、typecheck 和 lint 只能在测试机上跑。
