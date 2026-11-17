# 群已读人数实时推送 — 部署与测试说明（2026-11-18）

本次改动替换第四轮里"每 5 秒轮询已读接口"的做法（[`ENTRY_PERF_TEST_4.md`](ENTRY_PERF_TEST_4.md) 里的 V3 以本文为准）。轮询已经从客户端移除。

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
      - 同一会话、同一发送者，1 秒内最多推送一次
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
| `open-im-server` | `feat/group-read-webhook-context` | `CallbackGroupMsgReadReq` 新增 `conversationID`、`groupID`、`hasReadSeq` 三个字段，在 `MarkConversationAsRead` 里填入。原有字段不变 |
| `chat` | `feat/group-read-push` | 新增路由 `POST /callback/openim_webhook/:secret/:command`（`internal/api/chat/group_read_webhook.go`），以及对应的单元测试 |
| `react-native-chat` | `perf/openim-open-chat` | 监听 `onRecvCustomBusinessMessage`，按会话发出刷新信号；去掉 5 秒轮询；回到前台时的刷新保留 |

## 四、部署配置

### chat 服务端

设置环境变量（**不要写进仓库**）：

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
- chat-api 的地址应该用内网地址，不要经过公网。secret 是 URL 路径的一部分，**不要**把它打到访问日志里，或者在网关层把这个路径脱敏。

## 五、已经验证过的

- `open-im-server`：改动的包能编译通过，`go vet` 通过。`internal/rpc/msg` 这个包本身没有单元测试。
- `chat`：`go test ./internal/api/chat/` 全部通过，其中包括新增的 4 个测试：
  - 只通知已读范围内其他人发的普通消息的发送者；
  - 同一发送者 1 秒内只推一次；
  - secret 错误或未配置时返回 404，其它回调直接返回成功；
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
