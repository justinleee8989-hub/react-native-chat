# 进入会话测试说明 · 第六轮（Android Release）— 2026-11-18

第五轮结果见 [`RESULTS_5.md`](RESULTS_5.md)。构建、抓日志和打点含义同 [`TEST_1.md`](TEST_1.md)，构建仍加 `EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`。后端保持第五轮最终部署（`local/openim-server:perf5-group-read-ready`、`local/openim-chat:perf5-group-read-push`），**不用重新部署**。

测完后填 `RESULTS_6.md`，证据放到 `docs/openim/evidence/2026-11-18-entry-perf-6/`，提交并推送到 `perf/openim-open-chat`。

## 一、本轮改动

| 第五轮的问题 | 原因 | 本轮改动 |
|---|---|---|
| V3 已读人数不实时刷新（两轮都停在 0） | **RN SDK 原生层从没注册业务通知监听器。** `@openim/rn-client-sdk` 3.8.3-patch.12.4 的 Android `OpenImSdkRnModule.initSDK` 只注册了用户、会话、好友、群、消息、批量消息 6 个监听器；`SetCustomBusinessListener` 这个类写好了却没有被调用。iOS 的 `initSDK` 也一样。所以服务端即使发出了业务通知，JS 也永远收不到 `onRecvCustomBusinessMessage` | 在已有的 yarn patch（`example/.yarn/patches/@openim-rn-client-sdk-npm-3.8.3-patch.12.4-bac3fad1bc.patch`）里补上注册：Android 在 `initSDK` 里调用 `Open_im_sdk.setCustomBusinessListener(...)`；iOS 让模块实现 `OnCustomBusinessListener` 协议并调用 `Open_im_sdkSetCustomBusinessListener(self)` |
| V4 未预热进入从约 220ms 退到约 350ms | 日志显示首屏行数没变（29 对 28），但首屏构建帧从 106ms 变成 151ms，后面每次测量提交也多出 40–60ms。列表拿到的消息总数变多了：上一页预取，以及 V1 翻到最早消息后，内存里有远多于 30 条消息，列表首次布局要处理全部 | **打开过程中只把最新 30 条交给列表**；缓冲扩展（第一次拖动或转场结束）时再交出全部消息。定位到某条消息（搜索跳转）时不做这个限制 |
| UI 测试 4 个 suite 失败（`No safe area value available`） | 第五轮 `ProductPage` 改用 `useSafeAreaInsets()`，这 4 个测试没有提供安全区 | 4 个测试各自 mock `useSafeAreaInsets`（其余导出保持真实实现），与仓库里其他页面测试的写法一致 |

### 构建前必须做：重新安装依赖

SDK 的 patch 内容变了，`yarn.lock` 里这条 patch 的 hash 和 checksum 需要更新：

```bash
cd example && yarn install
```

不要加 `--immutable`。装完后确认 `node_modules/@openim/rn-client-sdk/android/src/main/java/com/openimsdkrn/OpenImSdkRnModule.java` 里有 `setCustomBusinessListener`，再构建 Release。**请把更新后的 `example/yarn.lock` 一并提交。** 如果 patch 应用失败（npm 包内容与 GitHub 同版本 tag 不一致），请贴出 yarn 的报错，不要手改 node_modules。

> 第五轮提到部署时要补 `rpcService` 映射：那是 OpenIM 新版本（`e089f78` 及之后，tools alpha.126）的服务发现配置格式，和旧镜像（alpha.122）不同，与群已读推送功能本身无关。第五轮最终部署已按新格式配好，本轮沿用。

## 二、要测什么

### V3 群已读实时推送（本轮重点）

方法同第五轮：Android 停在群聊页，另一个 QA 用户在 H5 上阅读，测两次。

记录：
- 已读人数从 0 变为 1 用了几秒；
- logcat 里能否看到 `onRecvCustomBusinessMessage`（可临时用 `adb logcat | grep -i business`）；
- 没有多出可见消息。

如果仍然不变，请按顺序确认是哪一段断了，各附一行证据：
1. chat-api 是否收到 webhook：把 chat-api 日志级别临时调到 INFO/DEBUG，看是否有 `/callback/openim_webhook/` 请求；
2. chat-api 是否调用了 `/msg/send_business_notification`（OpenIM api 日志）；
3. 设备是否收到事件（logcat）。

### V4 速度回归

方法同第五轮，各 3 次。**先做 V4，再做 V1**，并在 RESULTS 里写明长会话当时内存里大约有多少条消息（例如是否刚翻到过最早消息）。目标：未预热 `navigate` 回到 220–250ms，热进入 `transition-end` 约 290ms。另外请专门测一次"先把长会话翻到最早消息，返回，再长 → 短 → 长"，看 `navigate` 是否仍在同一水平。

### V1 快速上滑（复测，记录即可）

方法同第五轮。第五轮的分析是对的：空带出现时离最新消息只有约 11 条，**不是**分页等待，而是冷启动后行第一次渲染太慢（单帧 233–460ms）。本轮没有专门针对这一点的改动，请照常记录，作为下一步优化（分批扩展缓冲）的基线。另外请确认打开后第一次上滑时，更早的消息能连续出现，没有跳动或回弹（本轮缓冲扩展时会一次性补入窗口外的消息）。

### V6 / V5 抽查

- 冷启动首次进入通讯录 3 次，标题位置稳定；
- 从搜索结果跳到一条较早的消息，能正确定位并高亮；
- 已读明细、长按菜单、表情回应。

## 三、自动测试

本轮新增或修改：

- `useMessageListLayout.ui.test.tsx`：新增"缓冲扩展前 `opening` 为 true"；
- `ProductPage.navigation`、`HistorySearchScreen`、`SettingsNavigation`、`Contacts` 四个 UI 测试补安全区 mock。

请照常跑 UI、typecheck、lint、OpenIM 业务测试、SDK 测试和 Android Release 构建。
