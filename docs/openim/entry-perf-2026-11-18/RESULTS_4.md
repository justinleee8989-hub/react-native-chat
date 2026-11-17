# 进入会话测试结果 · 第四轮（Android Release）

测试日期：2026-11-18。说明见 [TEST_4.md](TEST_4.md)；群已读以 [推送联调说明](../GROUP_READ_PUSH_2026-11-18.md) 为准。

## 本次结论

- **V1 未通过**：冷启动打开长会话后立刻连续快速上滑，3/3 次出现上方缺行空带，随后补齐；主要可见时段约 150–250ms。拖动时扩展缓冲没有完全消除这一现象。对应记录最大 JS 长帧为 240 / 246 / 236ms，不能将两者直接等同或据此断定根因。
- **V2 通过**：按下 A 滑开 → 进入 B → 返回后 300ms 点 A，3/3 次正常进入，A 的 navigate 为 248 / 273 / 305ms，无 `entry-failed`。另有普通等待后的三轮也通过。
- **V4 通过本轮耗时回归**：热进入 transition-end 为 295 / 288 / 275ms；长→短→长的未预热 navigate 为 216 / 232 / 213ms。仅代表这组 QA 样本，不能代表所有会话均无卡顿。
- **V5 通过**：本轮新消息可直接打开已读成员页，长按菜单及表情回应添加/取消正常。
- **V3 受阻，未联调**：指定 chat 推送分支缺少当前后端已实现的可见性、通话记录等改动，不能直接部署覆盖。保持现有服务，不在本轮修改/合并实现。

本轮未修改任何实现代码；未操作原体验账号或消息。仅在独立 QA 群新增一条 `QA-perf4-direct-read-20261118`，添加后取消其 👍 回应；没有清空、删除、转让或解散操作。录音和视频未测，仍由用户自测。

## 环境与构建

- 分支：`perf/openim-open-chat`；实现 commit：`81c0b70e23c3fd686a6f2bab731b3f7f89f135ce`，报告提交不改变被测实现。
- 真机：Xiaomi 24053PY09C，Android 14，1236×2750，系统 animator duration scale 1.0。
- 构建：`EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`，arm64-v8a，JDK 17，`app:assembleRelease --max-workers=2`。
- 构建成功：52 秒；1046 tasks，40 executed，1006 up-to-date。已 `adb install -r` 覆盖安装成功，未清除应用数据。
- APK：`example/android/app/build/outputs/apk/release/app-release.apk`，构建产物不提交。
- SHA-256：`b395176d0b0458a08ea1dc9ac424a848366fb163495d856f6bac87f72586ccac`。
- 独立 QA：长会话 `1386688880`（Android QA 75e48277），短会话 `1139200649`（Android Jump QA 20261117）。未切换到原体验账号。
- 恢复设备本地转发 10008 / 10002 / 10001 / 10005；测试结束返回 QA 会话列表。未停止或重启后端，未改变系统分辨率和动画设置。

## V1 快速上滑空带

每次 force-stop 冷启动，打开长会话；观察到 `[IMEntry] navigate` 后约 100ms 发出三次连续 100ms 的上翻历史手势（手指从 y=650 到 y=2200）。录屏先于点击开始，时间点是**录屏秒数**，不是 sinceMs。用 50ms 间隔抽帧核对主空带，边界是采样估算，不是精确逐帧性能指标。

| 次序 | 首屏 | 结果 | 主要空带时段（录屏） | 大致持续 | 备注 |
|---|---|---|---|---|---|
| 1 | viewport | 未通过 | 约 0.60/0.65–0.80s | 150–200ms | 上方空白明显扩大，0.80s 已补入旧记录；后续仍有行补入 |
| 2 | viewport | 未通过 | 约 0.75/0.80–1.00s | 200–250ms | 0.90–0.95s 上方大面积无气泡，1.00s 补入 |
| 3 | viewport | 未通过 | 约 0.85–1.05s | 200ms | 1.00s 仍大面积无气泡，1.05s 补入；后续仍有行补入 |
| 对照 | 600 | 不适用 | — | — | 最终代码已移除实验面板，不为对照修改实现或加回开关 |

三次均没有导航失败或 App 崩溃，但不能把“最终有历史”判作“快速滑动流畅”。这次没有确定空带来自分页、缓冲扩展渲染或行测量中的哪一环。

证据：[第 1 次录屏](../evidence/2026-11-18-entry-perf-4/V1-scroll-1.mp4)、[第 2 次录屏](../evidence/2026-11-18-entry-perf-4/V1-scroll-2.mp4)、[第 3 次录屏](../evidence/2026-11-18-entry-perf-4/V1-scroll-3.mp4)；对应 `*-detail.png` 为 0.65–1.00s 抽帧，`*-detail2.png` 为 1.00–1.35s 抽帧。

## V2 换着点会话

严格补测方法：A 行按下并滑到屏幕边缘取消点击 → 点击 B 并确认实际短会话页 → 返回 → **不插入 UI dump**，等待 300ms 后点击原 A 行。用真实 UI 核对 A 标题及聊天信息入口，日志保留最初取消按下及后续 prepare/navigate。

| 次序 | 能否正常进入 | A navigate（sinceMs） | entry-failed | 证据 |
|---|---|---|---|---|
| 1 | 是 | 248 | 无 | V2-immediate-1.log / .mp4 |
| 2 | 是 | 273 | 无 | V2-immediate-2.log / .mp4 |
| 3 | 是 | 305 | 无 | V2-immediate-3.log / .mp4 |

另有较宽松的三轮：返回后先做 UI 就绪断言再点击，A navigate 为 265 / 361 / 353ms，也无失败；日志为 `V2-1-A.log` 等。最终结论以上表紧接点击为主。一个组合日志包含多次 press-in，`immediate-summary.json` 取最后一次 navigate 为 A，不混入 B 的时间。

## V3 群已读推送：未部署，保留阻塞

文档的两个分支都已 fetch：

- `chat origin/feat/group-read-push`：`ad2265ea8390083370412164dafa3fbadc9bbe37`。
- 当前 chat 为 `feature/rtc-terminal-records` / `d5f9db7`。两分支共同基点是 `3d1002f`；推送分支没有包含当前的 `d5f9db7`，直接替换会缺少 `message_visibility.go`、`message_admission.go`、通话记录及相关测试等。直接 diff 为 38 files、503 insertions、2454 deletions。
- `open-im-server origin/feat/group-read-webhook-context`：`280d0a23d`；相对当前源码仅 2 文件差异，但只部署这一端不能完成端到端推送。
- 服务保持原样：`local/openim-chat:v1.8.4-patch.5-backend-boundaries-v17` 与 `local/openim-server:v3.8.3-patch.18-owner-policy`，没有覆盖构建或修改配置。
- 兼容性证据：[backend-branch-compatibility.txt](../evidence/2026-11-18-entry-perf-4/backend-branch-compatibility.txt)。下一步需要开发侧把推送能力整理到包含现有后端能力的分支，再按部署文档配置和联调；本轮仅测试，不代为合并实现。

已对照已安装 RN SDK 源码确认事件名：`src/constants/OpenIMEvents.ts:56` 为 `OnRecvCustomBusinessMessage: 'onRecvCustomBusinessMessage'`，类型映射也存在。前端 `events.ts` 使用同一字符串。**只核实名称，不证明通知实际到达。**

| 项目 | 本轮结果 |
|---|---|
| webhook 实际到达 chat-api | 未部署，未验证 |
| Android 0→1 更新延迟（两次） | 未联调，未测 |
| 设备实际收到业务通知 | 未联调，未测 |
| 群里无额外消息 / 快速滚动时推送正常 | 未联调，未测 |
| 已读明细回归 | V5 新消息直接打开通过；不能代替推送验收 |
| 轮询停止 | 不适用，最终实现已去掉轮询 |

## V4 速度回归

时间从真实 press-in 算起，单位 ms。热进入前先进入长会话并返回；未预热样本每次先进入短会话，返回后进入长会话，日志都有新的 list-ready，28 行首屏。缓存消息存在，不能称为无缓存网络冷读。

| 场景 | 第 1 次 | 第 2 次 | 第 3 次 |
|---|---|---|---|
| 长会话热进入 navigate | 10 | 14 | 8 |
| 长会话热进入 transition-end | 295 | 288 | 275 |
| 长会话热进入最大 JS 长帧 | 53 | 53 | 45 |
| 长→短→长，未预热 navigate | 216 | 232 | 213 |
| 对应 list-ready | 207 | 221 | 204 |
| 对应 transition-end | 468 | 487 | 470 |

另三次 force-stop 后长会话进入（V1）：navigate 430 / 379 / 353ms，list-ready 403 / 368 / 338ms。首次构建比已读入内存的长→短→长样本更慢，报告分别列出，不混为同一场景。

证据为 `V4-*.log`、`V1-scroll-*.log`，汇总 [summary.json](../evidence/2026-11-18-entry-perf-4/summary.json)。导航后 page-commit 间隔可能包含异步等待，不将其等同阻塞时长；最大 JS 长帧也不等同原生渲染帧率。

## V5 抽查

| 项目 | 结果 | 证据 |
|---|---|---|
| 新消息直接点查看已读成员 | 通过：发送本轮消息后未退出聊天，点击 0 人已读直接进入明细，已读 0 / 未读 1，无错误页 | V5-readers.png |
| 长按菜单 | 通过：本轮消息出现回复、复制、转发、编辑、已读成员、撤回及表情栏；本项确认菜单展示，不等于重验所有子操作 | V5-menu.png |
| 表情回应 | 通过：👍 添加后显示 👍 1，点击后消失；仅作用本轮新消息 | V5-reaction-added.png / V5-reaction-removed.png |

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

原始构建及测试日志：[第四轮证据目录](../evidence/2026-11-18-entry-perf-4/)。本目录已补充本轮真机录屏、性能日志、抽帧和抽查截图。
