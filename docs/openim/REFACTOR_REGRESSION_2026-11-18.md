# 架构与风格整改回归 — 2026-11-18

## 范围

被测前端提交为 `8885e83d7adcd815b73dc92a9baf5ebec92996f8`，分支为 `perf`。本提交统一诊断开关并把 `ChatScreen` 拆为目录，声明不改变业务行为。本轮只做回归、记录和证据归档，没有修改实现代码、依赖或后端，也没有清除应用数据。

后端继续使用既有健康实例：

- `openim-rn-local-openim-server-1`：`local/openim-server:perf5-group-read-ready`
- `openim-rn-local-openim-chat-1`：`local/openim-chat:perf5-group-read-push`

## 自动门禁

| 项目 | 结果 |
| --- | --- |
| IM UI | 54 suites / 249 tests，通过 |
| OpenIM 业务 | 287 / 287，通过 |
| SDK Jest | 91 suites / 501 tests / 34 snapshots，通过 |
| 应用 typecheck | exit 0 |
| SDK typecheck | exit 0 |
| 根目录 lint | exit 0 |
| SDK build | exit 0 |
| Android Release | `BUILD SUCCESSFUL in 38s`，1046 tasks：40 executed / 1006 up-to-date |

SDK Jest 仍输出既有的异步退出提示，但进程退出码为 0；本轮不把它描述为零警告。Release APK SHA-256：

```text
d5eebb6820deb28aa2a394533ac184a7fdfcbab4dadbb6c929f7a215302c2de9
```

APK 使用 `EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`、OpenJDK 17 和 arm64-v8a 构建，随后通过 `adb install -r` 覆盖安装；没有清除应用数据。

## Android Release 真机抽查

设备为 Xiaomi 24053PY09C、Android 14。仅使用既有独立 QA A/B 和独立 QA 群，不操作原体验账号、群或消息。

| 流程 | 实际结果 |
| --- | --- |
| 冷启动与长会话进入 | Release 恢复登录后进入独立 QA 长会话，真实历史和输入区可用；本轮是功能回归，不重新声明旧性能目标达成。 |
| 文字消息 | 发送唯一标记 `QA-refactor-20261118-text` 成功。 |
| 回复 | 对本轮文字消息发送回复成功，引用卡片显示目标正文。 |
| 转发 | 把本轮回复转发给独立 QA B 成功。 |
| 撤回 | 本轮回复消息撤回成功，会话显示撤回提示。 |
| 文件附件 | 选择既有独立 QA 文本附件，上传和消息落地成功。 |
| @成员 | 选择独立 QA B，发送 @消息成功。 |
| 更早历史 | 连续向较早方向滚动，加载到 `QA-scroll-001` 和后续历史，没有停在分页空状态。 |
| 群已读实时刷新 | 独立 QA B 在临时 H5 打开群聊后，Android 最新 @消息从 `0 人已读` 更新为 `1 人已读`。 |
| 诊断日志 | 收到 `[IMReadPush] {"shape":"object","parsed":true,"known":true}`；日志不含账号、群 ID、令牌或消息正文。 |
| 回到前台 | 应用进入后台后重新打开，仍恢复在同一独立 QA 会话，历史、已读数和输入区正常。 |

本轮新增的 QA 数据只有上述文字、回复后撤回、转发副本、文件和 @消息；没有删除、解散或修改原体验数据。

## 边界

- 录音和视频按用户约定由用户自行测试，本轮没有申请媒体权限，也不把语音发送记为通过。
- 本轮没有重新执行 PC/H5 全页面逐页验收；临时 H5 只用于独立 QA B 登录和触发真实群已读，完成后已停止。
- 本轮没有重新量化第八轮记录的极快上滑空带，也不改变该已知限制。
- 本轮没有改动或重新部署 `chat`、`open-im-server`。

## 证据

证据目录：[evidence/2026-11-18-refactor-regression](evidence/2026-11-18-refactor-regression)。其中包含自动测试日志、Release 构建日志、APK 哈希、最终已读截图/UI 树和脱敏 `[IMReadPush]` 日志；`manifest-sha256.txt` 记录各证据文件哈希。

## 结论

在本轮明确覆盖范围内，`8885e83` 的架构拆分未观察到功能回退，自动门禁、Release 构建及上述 Android 真机流程通过。录音、视频和旧性能限制不在本轮通过结论内。
