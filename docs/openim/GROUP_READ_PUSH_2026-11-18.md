# 群已读人数实时推送 — 部署与测试说明（2026-11-18）

本次改动替换第四轮里"每 5 秒轮询已读接口"的做法（[`entry-perf-2026-11-18/TEST_4.md`](entry-perf-2026-11-18/TEST_4.md) 里的 V3 以本文为准）。轮询已经从客户端移除。

## 一、为什么要改服务端

- **OpenIM 不会通知发送者。** 群成员阅读后，客户端调用 `markConversationMessageAsRead`。在 OpenIM 服务端（`internal/rpc/msg/as_read.go` 的 `MarkConversationAsRead`）里，群聊这一步只更新读者自己的 `hasReadSeq`，然后发一条 `HasReadReceipt` 通知，**发送方和接收方都是读者本人**（只用来同步读者自己的其它设备）。发送者收不到任何消息，所以"N 人已读"只有重新进入会话才会变。
- **轮询的代价随群人数增长。** chat 服务端的已读接口（`/user/message/readers`）每次请求都要分页拉取全部群成员，再**对每个成员单独**查询一次已读进度。所以群越大，轮询给服务端的压力越大。
- **OpenIM 自带的回调用不上。** OpenIM 已有 `afterGroupMsgRead` webhook，但它的回调参数里只有读者 ID 和已读 seq，**没有会话 ID 或群 ID**，收到回调也不知道是哪个群。

## 二、链路

```
群成员 B 阅读
  → OpenIM MarkConversationAsRead
  → afterGroupMsgRead webhook（新增 conversationID / groupID / hasReadSeq）
  → chat 服务端 /callback/openim_webhook/<secret>/callbackAfterGroupMsgReadCommand
      - 立即应答，后台处理（10 秒超时）
      - 用管理员 token 拉取 B 已读位置之前最近 20 条消息，找出其中的发送者（排除 B 本人、系统通知和已删除的消息）
      - 同一会话、同一发送者，1 秒内最多推送一次（用 Redis SET NX 加过期时间实现，多个 chat-api 实例共享；Redis 出错时照常推送，最多多发一次）
      - 对每个发送者调用 /msg/send_business_notification
        key = group_read_progress，data = {conversationID, readerID, hasReadSeq}
        reliabilityLevel = 1（只推给在线用户），不保存为消息
  → 发送者 A 的客户端 onRecvCustomBusinessMessage
  → runtime.readersChanged(conversationID)
  → 当前打开的群聊页重新请求最新一条自己消息的已读人数
```

如果 A 当时不在线，就收不到这条推送。A 下次打开这个群聊时，页面会重新加载已读人数。

## 三、三个仓库的改动

| 仓库 | 分支 | 改动 |
|---|---|---|
| `open-im-server` | `feat/group-read-webhook-context`（`280d0a23d`，基于当前部署的 `e089f78`） | `CallbackGroupMsgReadReq` 新增 `conversationID`、`groupID`、`hasReadSeq` 三个字段，在 `MarkConversationAsRead` 里填入。原有字段不变 |
| `chat` | `feat/group-read-push`（`054fd9a`，已合入当前部署的 `feature/rtc-terminal-records` / `d5f9db7`） | 新增路由 `POST /callback/openim_webhook/:secret/:command`（`internal/api/chat/group_read_webhook.go`），以及对应的单元测试 |
| `react-native-chat` | `perf/openim-open-chat` | 监听 `onRecvCustomBusinessMessage`，按会话发出刷新信号；去掉 5 秒轮询；回到前台时的刷新保留 |

## 四、部署配置

### chat 服务端

**前提：必须开启 message extras**（`MESSAGE_EXTRAS_ENABLED=true` 并配置 `MESSAGE_EXTRAS_REDIS_ADDR`，或者开启 RTC）。推送要用到的 OpenIM API 地址和 Redis，都是开启 message extras 时才初始化的，和已读明细接口 `/user/message/readers` 的依赖相同。没开启时，回调照样返回成功，但不会推送，日志里会出现一次警告：`group read webhook received but message extras are disabled`。

然后设置环境变量（**不要写进仓库**）：

```bash
export OPENIM_WEBHOOK_SECRET='<一段足够长的随机字符串>'
```

如果没有设置，这个回调路由一律返回 404，等于功能关闭。

### open-im-server

用新分支重新构建并部署，然后打开 webhook。可以改 `config/webhooks.yml`，也可以用环境变量覆盖（OpenIM 支持 `IMENV_<文件名>_<键>` 形式的环境变量）：

```bash
export IMENV_WEBHOOKS_URL='http://<chat-api 内网地址>:10008/callback/openim_webhook/<OPENIM_WEBHOOK_SECRET>'
export IMENV_WEBHOOKS_AFTERGROUPMSGREAD_ENABLE=true
```

**注意：**
- `webhooks.url` 是**所有** webhook 共用的地址。目前其它 webhook 都是关闭的；以后如果打开别的 webhook，它们的请求也会发到这个地址，chat 服务端对不认识的回调一律直接返回成功、不做处理。
- chat 里原本已有的 `/callback/open_im`（上游自带，按 `?callbackCommand=` 转发给 chat RPC，目前只处理加好友前的检查，**没有鉴权**），和这次新增的 `/callback/openim_webhook/<secret>/<command>` 用途不同：前者是上游的 before 类回调，后者是带 secret 的 after 类回调，需要调用 IM 管理接口，所以放在 API 层。两个不要混用。
- chat-api 的地址应该用内网地址，不要经过公网。secret 是 URL 路径的一部分，**不要**把它打到访问日志里，或者在网关层把这个路径脱敏。

## 五、已经验证过的

- `open-im-server`：改动的包能编译通过，`go vet` 通过。`internal/rpc/msg` 这个包本身没有单元测试。
- `chat`：`go test ./internal/api/chat/` 全部通过，其中包括新增的 6 个测试：
  - 只通知已读范围内其他人发的普通消息的发送者，发送方是配置里的 IM 管理员；
  - 同一发送者在限流期内只推一次，过期后可以再推；
  - Redis 出错时照常推送；
  - Redis 不可达时如实报错（不会静默放行或拦截）；
  - secret 错误或未配置时返回 404，其它回调、以及没开启 message extras 时的已读回调都直接返回成功；
  - 回调参数校验。

  `go vet` 和 `gofmt` 都没有问题。
- 客户端：新增 `group-read-notice.test.mjs`（解析通知，2 项），在本机已通过。`store.test.mjs` 里新增的用例因为本机缺依赖包，**还没跑过**。

## 六、要在测试环境验证的

1. **部署**：按第四节配置两个服务端，重启后在 open-im-server 日志里搜索 `webhook`，确认 `callbackAfterGroupMsgReadCommand` 请求发到了 chat-api，并且返回成功。
2. **实时更新**：Android 在群里发一条新消息，停留在聊天页；伙伴用真实客户端（H5 或另一台手机）打开群并阅读。记录 Android 上"N 人已读"多少秒后更新（预期 1–2 秒）。
3. **事件名**：如果第 2 步没有更新，先在 Android 日志里确认有没有收到 `onRecvCustomBusinessMessage` 事件。RN SDK 的事件名我是按 OpenIM 的命名推断的，**没能对着 SDK 源码核实**。
4. **不打扰别人**：伙伴阅读后，群里**不应出现**任何新消息或通知气泡；其它没在看这个群的成员也不应受影响。
5. **快速滚动**：伙伴快速翻阅大量消息时，Android 上的已读人数正常更新，chat 服务端日志里也没有大量报错。
6. **回归**：已读明细页、重新进入后的已读人数、私聊的已读状态都和之前一致。

## 七、结果

| 项目 | 结果 |
|---|---|
| 部署后 webhook 正常到达 chat-api | |
| 已读人数更新延迟（秒） | |
| 收到 onRecvCustomBusinessMessage | |
| 群里没有多出消息或通知 | |
| 快速滚动时正常 | |
| 回归 | |
| 自动测试（UI / typecheck / lint / OpenIM 业务 / chat go test） | |

## 2026-11-18 第四轮测试机补充

RN SDK 事件名已核实：`@openim/rn-client-sdk/src/constants/OpenIMEvents.ts:56` 定义 `OnRecvCustomBusinessMessage: 'onRecvCustomBusinessMessage'`，与客户端监听一致。UI 247 项、业务 287 项、应用 typecheck、源码 lint 及推送分支 `go test ./internal/api/chat/` 均通过。

**端到端部署仍受阻。** 指定 `chat` 分支 `ad2265e` 不含当前 `feature/rtc-terminal-records` / `d5f9db7` 的可见性、消息准入及通话记录等改动。直接部署会回退这些功能，故本轮保持 v17 服务，不合并或修改实现。不能把事件名核实、Go 单测或已读明细页可打开当作实时推送通过。具体分支差异及后续项见 [第四轮报告 V3](entry-perf-2026-11-18/RESULTS_4.md#v3-群已读推送未部署保留阻塞)。

## 2026-11-18 第四轮阻塞的处理

`chat` 的 `feat/group-read-push` 已合入 `origin/feature/rtc-terminal-records`（`d5f9db7`），合并提交为 `054fd9a`。合并后相对 `d5f9db7` 只多 4 个文件：`group_read_webhook.go`、`group_read_webhook_test.go`、`chat.go`（Api 结构体多两个字段）和 `start.go`（多一条路由），**可见性、消息准入、通话记录等现有能力全部保留**。合并后 `go build ./...`、`go vet`、`go test ./internal/api/chat/ ./pkg/common/...` 均已通过。

`open-im-server` 的 `feat/group-read-webhook-context` 本来就基于当前部署的 `e089f78`，只多 2 个文件，无需处理。现在两个后端都可以在当前服务的基础上构建部署，测试方法见 [第五轮 V3](entry-perf-2026-11-18/TEST_5.md)。

## 2026-11-18 第五轮部署及联调实测

详见 [第五轮 V3](entry-perf-2026-11-18/RESULTS_5.md#v3-推送部署和两轮真实阅读)。已使用 chat 054fd9a、OpenIM 280d0a23d 构建；测试机旧镜像依赖和配置结构与分支有差异，必须使用同分支完整二进制、RPC 服务名映射，并将既有管理员字段映射到新结构，保留原密钥与策略。仅替换消息RPC会造成发现协议混用，不能照搬。

最终服务健康且真实消息/历史/已读明细可用，但**实时更新两次均未通过**：伙伴真实H5阅读后，Android当前页分别至少22.7s、47.0s仍0，打开明细均为1。配置加载器确认开关及URL生效；未证实 webhook 实际到达和 RN 事件实际收到，WARN级别无成功日志不能作缺请求的证据。没有改实现或加轮询兜底。群里只新增两条本轮QA文本，未见额外通知气泡。

| 第五轮复核项 | 结果 |
|---|---|
| 配套部署和配置加载 | 完成，真实业务可用 |
| webhook 实际到达 / RN事件 | 未确认，不声称通过 |
| 真实阅读后当前页人数 | 两轮均未通过 |
| 已读明细 | 两轮已读1/未读0，正确 |
| 新增可见系统消息 | 未见；新范围只有两条QA文本 |
| UI / 类型 / lint / 业务 / SDK / Go | UI23失败；其余指定检查通过，见报告 |

## 2026-11-18 第五轮失败的原因

两轮真实阅读后发送者页面都没有刷新。原因在客户端 SDK：`@openim/rn-client-sdk` 3.8.3-patch.12.4 的原生层（Android `OpenImSdkRnModule.initSDK`、iOS `initSDK`）只注册了 6 个监听器，**没有注册业务通知监听器**，所以 `onRecvCustomBusinessMessage` 永远到不了 JS。事件名本身是对的。修复在 `example/.yarn/patches/@openim-rn-client-sdk-npm-3.8.3-patch.12.4-bac3fad1bc.patch`，复测见 [第六轮 V3](entry-perf-2026-11-18/TEST_6.md)。服务端两个分支不用改。
