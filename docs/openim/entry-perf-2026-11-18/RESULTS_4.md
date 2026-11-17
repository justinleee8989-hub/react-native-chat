# 进入会话测试结果 · 第四轮（构建及自动测试已完成，真机待连接）

测试日期：2026-11-18。说明见 [TEST_4.md](TEST_4.md)；群已读以 [推送联调说明](../GROUP_READ_PUSH_2026-11-18.md) 为准。

## 本次结论

已拉取最新代码并构建诊断 Release，自动测试通过。**本次 ADB 设备列表为空，未执行第四轮真机验收，不能据此认定空带、交替点击失败或已读刷新问题已修复。** 已请求连接手机。没有修改实现代码，没有登录或修改任何体验账号或数据，没有部署、重启后端。

## 环境与构建

- 分支：`perf/openim-open-chat`；被测 commit：`81c0b70e23c3fd686a6f2bab731b3f7f89f135ce`。
- 构建：`EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`，arm64-v8a，JDK 17，`app:assembleRelease --max-workers=2`。
- 构建成功：52 秒；1046 tasks，40 executed，1006 up-to-date。未安装到设备。
- APK：`example/android/app/build/outputs/apk/release/app-release.apk`，构建产物不提交。
- SHA-256：`b395176d0b0458a08ea1dc9ac424a848366fb163495d856f6bac87f72586ccac`。
- 当前机型 / Android 版本：未连接，不能现场确认；上一轮 Xiaomi Android 14 不作为本轮实测证据。
- 后续仅用独立 QA：长会话 `1386688880`（Android QA 75e48277），短会话 `1139200649`（Android Jump QA 20261117）。

## V1 快速上滑空带

| 次序 | 首屏 | 是否出现空带 / 时间 / 持续时间 | 结果 |
|---|---|---|---|
| 1 | viewport | 未测 | 等待真机 |
| 2 | viewport | 未测 | 等待真机 |
| 3 | viewport | 未测 | 等待真机 |
| 对照 | 600 | 不适用 | 最终代码已移除实验面板；不为测试修改实现或重新加入开关 |

## V2 换着点会话

三轮均待真机：按住 A 滑开 → 打开 B → 返回立即打开 A；需保留 navigate 和 entry-failed 日志，不能用自动测试代替实际手势结果。

## V3 群已读推送

未联调。两个后端分支已 fetch，但没有切换或部署：

- `chat origin/feat/group-read-push`：`ad2265e`；当前工作分支仍为 `feature/rtc-terminal-records`。
- `open-im-server origin/feat/group-read-webhook-context`：`280d0a23d`；当前工作分支仍为 `main`。
- 已对照已安装 RN SDK 源码确认事件常量：`src/constants/OpenIMEvents.ts:56` 定义 `OnRecvCustomBusinessMessage: 'onRecvCustomBusinessMessage'`。这只核实名称，未证明实际推送到达。
- 后续需要按联调说明部署 webhook 配置，用 Android 发送与真实 H5 伙伴阅读，测两次人数更新延迟、确认没有额外通知气泡，并回归已读明细和私聊状态。
- 原 TEST_4 中 5 秒轮询步骤已经作废，本次不把轮询测试当作推送测试。

## V4 速度回归

| 场景 | 第 1 次 | 第 2 次 | 第 3 次 |
|---|---|---|---|
| 长会话热进入 transition-end | 未测 | 未测 | 未测 |
| 长 → 短 → 长的未预热 navigate | 未测 | 未测 | 未测 |

## V5 抽查

新消息直接查看已读成员、长按菜单、表情回应均待真机实测；未沿用第三轮通过结果。录音及视频仍由用户自测。

## 自动测试

| 项目 | 本轮结果 | 证据 |
|---|---|---|
| UI | 54 suites / 247 tests 通过，exit 0 | ui.log |
| 应用 typecheck | 通过，exit 0 | typecheck.log（空输出） |
| 源码 lint | 通过，exit 0 | lint.log |
| OpenIM 业务 | 287 tests 通过，0 failed，exit 0 | openim.log |
| chat 指定分支 Go 测试 | `go test ./internal/api/chat/` 通过，exit 0 | chat-test.log |
| Android Release 构建 | 通过，exit 0 | build.log |

Go 测试使用 `origin/feat/group-read-push` 的 git archive 临时副本，未切换本地后端工作分支。lint 使用 `eslint src example --ignore-pattern 'example/public/**'`，排除生成的 public SDK 文件，未使用自动修复。

非阻断警告如实保留：Jest worker 未正常退出后被回收（整体 exit 0）；Node MODULE_TYPELESS_PACKAGE_JSON；Gradle deprecated features。没有为消除警告修改实现。

原始构建及测试日志：[第四轮证据目录](../evidence/2026-11-18-entry-perf-4/)。本目录没有真机录屏、性能日志或截图，避免把历史证据误当本轮结果。
