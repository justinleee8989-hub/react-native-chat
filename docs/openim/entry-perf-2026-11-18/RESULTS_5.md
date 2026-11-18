# 进入会话测试结果 · 第五轮（Android Release）

2026-11-18；按 [TEST_5.md](TEST_5.md) 执行。[日志、录屏及截图](../evidence/2026-11-18-entry-perf-5/)。本轮只执行构建、部署和测试，**没有修改前后端实现或测试源码**。

## 结论

| 项目 | 结果 |
|---|---|
| V1 快速上滑空带 | **未通过**：3/3 仍有空带；三次都有点击后约 1 秒以上的 >200ms JS 长帧，最大 460ms |
| V1 更早分页 | 通过读取路径：可连续上翻到 QA-scroll-001；最终没有错误或卡住的加载状态。没有单独证明瞬时加载指示每次都出现 |
| V3 群已读实时推送 | **未通过**：两次真实 H5 阅读后，Android 当前页仍显示 0，分别在点击后 22.7s / 47.0s 截图确认；打开明细却为已读 1、未读 0 |
| V4 热进入 | 通过：transition-end 291 / 294 / 281ms，与约 290ms 目标持平 |
| V4 未预热进入 | **未达到持平目标**：navigate 364 / 357 / 338ms，第四轮为 216 / 232 / 213ms；不据此单独归因于预取 |
| V6 通讯录 | 最终稳定部署后追加的 3 次首帧位置均稳定；联调阶段的另外 3 次中仍捕获过 1 次上移，保留时序疑点及证据 |
| V6 我的 / 群组列表 | 各抽查 1 次，未见标题上下跳动 |
| V5 已读明细 / 菜单 / 表情 / 短会话 | 抽查通过 |
| UI 自动测试 | **未通过**：4 suites / 23 tests 失败，50 suites / 225 tests 通过；失败为缺少 SafeAreaProvider |
| 其他自动检查及构建 | 应用类型、源码 lint、287 业务测试、501 SDK 测试及 34 快照、SDK 类型/编译、chat Go 测试、Release 构建通过 |

不将“可打开页面”“最终能补入历史”“打开明细后数据正确”当作滑动或实时刷新通过。录音和视频仍由用户自测，本轮未操作这些权限或媒体。

## 环境及范围

- 前端分支 `perf/openim-open-chat`；被测实现 **f45c8e0ff7e8e7c43e6b72fb249b14c60d8228fc**（报告提交不改变被测实现）。
- Xiaomi 24053PY09C，Android 14，1236×2750；系统动画设置保持原样。
- 诊断 Release：`EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`，arm64-v8a，JDK 17；Gradle 构建成功，1m 2s；覆盖安装成功，未清应用数据。
- APK SHA-256：`0605d2c73f60c12e42521441c4ed5746639c7eb46e1aa19d25f9f69e3ec44234`。APK / lib 等构建产物不提交。
- 只用独立 QA 用户 6425355272 / 5379898012；长群 1386688880、短群 1139200649。保留原体验数据，未清空、删除、解散、转让或改密。
- 仅新增文本 `QA-perf5-read-push-01`、`QA-perf5-read-push-02`，并在第二条上添加后取消 👍。已有 QA 消息只读取。
- USB 重连后端口转发曾缺失，已恢复 10008 / 10002 / 10001 / 10005。缺少转发及后端中间部署阶段的性能样本未用于正式 V1/V4 数据；本地保留在 `/tmp/im-entryperf5/` 的预检子目录，没有覆盖为成功样本。

## V1 空带、分页与消息位置

最终服务业务通信恢复后，每次 force-stop 冷启动，打开长会话，观察到 navigate 后约 100ms 连续发出三次 100ms 的上翻手势（手指 y=650→2200）。正式录屏 `V1-scroll-1/2/3.mp4`；50ms 间隔抽帧为 `*-detail.png`、`*-detail2.png`。时段为**录屏秒数估算**，不是 sinceMs，也不是精确帧率测量。

| 次序 | 空带 | 可见主时段 / 恢复 | sinceMs ≥1000 的 >200ms JS 长帧 |
|---|---|---|---|
| 1 | 有 | 约 0.80s 上方空白，0.85s 补入，约 50–100ms；之后仍有补行 | 1238ms 时记录 246ms |
| 2 | 有 | 约 0.60–0.70s 大面积缺行，0.75s 补入，约 150–200ms | 1026ms 时记录 460ms |
| 3 | 有 | 约 0.65–0.75s 缺行，0.80s 补入，约 150–200ms；0.95s 又有行间空带 | 1037ms 时记录 233ms；此前 769ms 时还有 234ms |

### 与“首批只有 30 条”的关系

空带时可见的锚点包括 `QA-perf2-outgoing-20261118`。只读 QA 群序号索引确认：该消息 seq=51，当时最新 `QA-perf4-direct-read-20261118` seq=62，两者仅相差 11 个序号；seq 差不等于可见行数，但表明该处仍是较近的历史。不能仅凭本轮结果把所有空带都解释为已经越过最初 30 条、在等待下一页。

证据 `qa-history-index.json` 仅含本 QA 群文本标记及序号；没有其他账号历史或令牌。尚未确定虚拟列表补行、测量及分页各自贡献，本轮未增加实现探针或修改预取逻辑。

### 继续分页

`V1-pagination.mp4` 连续 8 次进一步上翻；最终 UI 中出现建群提示和 `QA-scroll-001`、002、003 等最早消息。`V1-pagination-state.txt` 保存最终可见状态。未见最终加载指示卡住或错误提示；未逐帧证实“加载更早消息”每次请求都有显示，因此不扩大判定。

## V3 推送部署和两轮真实阅读

### 构建与配套部署

- chat 使用 **054fd9a**（`origin/feat/group-read-push`），确认包含当前 d5f9db7；相对当前后端仅 4 文件新增/增量，现有可见性和通话记录实现保留。
- OpenIM 使用 **280d0a23d**（`origin/feat/group-read-webhook-context`），源文件未修改。
- 本机原镜像的 tools/protocol 依赖分别是 alpha.122 / alpha.19，新分支是 alpha.126 / alpha.20。最初仅替换消息 RPC 的尝试造成服务发现不兼容，已回滚原配置并排除该阶段性能样本。
- 随后完整构建同分支 13 个服务二进制。旧镜像发现配置缺少新分支的 `rpcService` 映射，旧 share 配置仍是 `imAdminUserID`；只加二进制时还发生过 crontask 因新管理员数组为空而退出。
- 最终使用分支的发现服务名配置，把**既有**管理员 ID 映射为新结构 `imAdminUser.userIDs`，保留原密钥、连接环境、登录与清理策略；没有修改实现、迁移或删除数据，也未手动运行清理任务。
- 最终镜像：`local/openim-server:perf5-group-read-ready`、`local/openim-chat:perf5-group-read-push`。二者 healthy，实际 QA 历史读取、发消息和已读明细均工作，不只依赖健康标记。
- private Compose 覆盖及原镜像回滚配置在 `/tmp/im-perf5-deploy/`，权限受限，**不入库**；部署只替换本项目两个应用容器，没有删除卷或重建数据库。
- `OPENIM_WEBHOOK_SECRET` 保持私密；使用真实配置加载器验证 `afterGroupMsgRead enabled=true` 且目标为本地 chat 路由，见 `V3-webhook-config-check.log`。这不等于端到端到达已获证明。

### 两轮实际结果

Android 停在群聊页；伙伴是本机 35882 端口的真实 H5 客户端，使用另一独立 QA 用户。第一轮从列表打开群阅读；第二轮先切到 QA 私聊，待 Android 发新消息后再返回群。没有用服务端伪造阅读代替真实客户端。

| 轮次 | 伙伴动作后 Android 当前页 | 打开已读明细 | 结果 |
|---|---|---|---|
| 1 | 点击后 22.7s 截图仍 0 人已读，未退出聊天页 | 已读 1 / 未读 0，成员为 QA b | 未通过 |
| 2 | 点击后 47.0s 截图仍 0 人已读，未退出聊天页 | 已读 1 / 未读 0，成员为 QA b | 未通过 |

证据 `V3-push-1/2.mp4`、`*-after.png`、第二轮 `V3-push-2-readers.png`、`*-timing.json`。截图延时从 H5 点击起算，不把它当作精确服务端阅读提交时刻；未观察到 0→1，故不能填一个成功延迟值。

| 推送专项 | 结果 |
|---|---|
| 配置开关、URL、分支与服务已部署 | 是，配置加载器确认；最终服务业务可用 |
| webhook 实际到达并触发业务通知 | **未能确认**；当前 WARN 级别不保留正常 webhook 的 INFO 日志，不能用空日志断言它没有请求 |
| 实际收到 onRecvCustomBusinessMessage | **未能确认**；设备日志关键词未见匹配，也未增加事件探针。SDK 名称仍与源码一致 |
| 页面实时人数更新 | 两轮均失败 |
| 可见额外消息 / 保存的通知气泡 | 未见；只读拉取新范围只有 seq63、64 两条 contentType101 文本，见 V3-new-message-count.json |
| 伙伴翻阅历史 | H5 可实际滚到较早 QA 历史；因实时更新已失败，不判推送压力路径通过 |
| 已读明细、重新进入及私聊 | 两轮明细正确；菜单抽查返回聊天后显示 1；伙伴 QA 私聊可打开并显示既有已读标记 |
| chat 错误关键词 | 本轮采样未见 group read notification failed / message extras are disabled；不是成功通知的证明 |

后续需定位 webhook 入口、通知发送与 RN 事件/数据解析哪一环未完成。按“先别改实现代码”要求，本轮到证据和失败记录为止，没有以轮询或手工刷新替换它。

## V4 速度回归

单位 ms，从 press-in 算起；最大长帧是 JS 诊断，不等同物理绘制时间。转场结束日志也可能受 JS 回调调度延迟影响。

| 场景 | 1 | 2 | 3 |
|---|---|---|---|
| 热进入 navigate | 9 | 12 | 6 |
| 热进入 transition-end | 291 | 294 | 281 |
| 热进入最大 JS 长帧 | 52 | 51 | 49 |
| 长→短→长，未预热 navigate | 364 | 357 | 338 |
| 未预热 list-ready | 352 | 336 | 301 |
| 未预热 transition-end | 614 | 605 | 614 |

未预热样本均有新 list-ready，首屏 29 / 29 / 24 行；缓存消息存在，不能称作完全无缓存网络冷读。本轮相对第四轮还改变了后端构建与已有消息数量，不能作为单变量归因；但这些实测未达到第五轮文档约 220ms 的目标。完整阶段数据在 `V4-*.log` 与 `summary.json`。

## V6 通讯录与其他首次页面

1. 恢复 USB 转发、联系人数据已可读取但后端仍在联调时，三轮 `V6-contacts-*` 中第 3 次仍出现 0.10s 标题靠近状态栏，0.13s 下移；另外两次位置稳定。保留这组证据，不把它覆盖掉。
2. 最终服务健康、首页无同步错误后追加三次 `V6-final-contacts-*`，最初 250ms 按约 33ms 抽帧：**3/3 标题位置稳定**，再次进入也正常。仍有短暂内容骨架，但未见标题移位。
3. 我的/设置根页、群组列表各抽查一次，标题位置正常；群列表保持正常侧向推入。

最终环境的三轮通过，但联调阶段一次异常仍是需要复核的启动时序边界，不能声称所有异常启动路径都已消除。`*-early.png` 是最初 0–0.23s；`V6-profile-first*.png`、`V6-groups-first*.png` 为额外页面对照。

## V5 抽查

- 第二条新消息发送后，未离开聊天即可点 0 人已读打开明细，显示已读0/未读1；没有 seq 缺失错误。证据 `V5-new-message-readers.png`。
- 长按第二条新消息，菜单包含回复、复制、转发、编辑、已读成员、撤回及表情栏；本项核验展示，不等于重验全部子操作。证据 `V5-menu.png`。
- 👍 添加后出现 1，再次点击后移除，只作用第二条本轮新消息，证据 `V5-reaction-added/removed.png`。
- 短会话只有建群提示和已有 QA-final-empty-first-message，打开正常，没有多余加载指示或错误页；`V5-short-chat.png`。

## 自动检查及构建

| 检查 | 结果 |
|---|---|
| UI Jest | **exit 1**；4 failed / 50 passed suites；23 failed / 225 passed tests，总计248 |
| 应用 typecheck | exit0，通过 |
| 源码 lint | exit0，通过；排除生成的 example/public/**，未自动修复 |
| OpenIM 业务测试 | exit0，287通过、0失败 |
| SDK Jest | exit0，91 suites、501 tests、34 snapshots 通过 |
| SDK typecheck / build | exit0，通过；lib 为忽略的构建产物 |
| chat Go | exit0，go test ./internal/api/chat/ ./pkg/common/... 通过 |
| 服务端二进制及本地镜像 | 构建通过；最终配套部署说明见 V3 |
| Android Release | exit0，构建并覆盖安装成功 |

UI 失败 suites：ProductPage.navigation、HistorySearchScreen、SettingsNavigation、Contacts。共同报错是 `No safe area value available`，堆栈指向 ProductPage 的 useSafeAreaInsets；现有测试装配没有提供所需 Provider。只记录，没有加 mock、修改组件或跳过失败测试。

非阻断警告保留：Node MODULE_TYPELESS_PACKAGE_JSON、Gradle deprecated features 等；不能把自动测试失败归入普通警告。构建及测试日志均在证据目录。
