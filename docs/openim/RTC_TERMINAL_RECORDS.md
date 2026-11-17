# 通话终结记录与媒体控制

2026-11-17：本地 Chat API 新增单聊终结记录投递能力，RN 产品端消费 v2 记录。原始体验数据不回填、不清理。

## 服务端协议

新创建且启用了投递器的单聊 `Call.serverRecordDelivery = true`。终结状态在同一 Redis 事务中写入投递任务；独立 worker 向 OpenIM 发送文本消息，客户端离线不影响此过程。

文本前缀仍为 `[OpenIM 呼叫] `，JSON 字段包括 `version: 2`、`eventID: rtc-terminal:<room>`、`room`、`caller`、`callee`、`kind`、`status`、`expires`、`ended`，以及可选 `connectedAt`、`durationSeconds`。发送者固定为 caller。拒接方向按 caller/callee 判断，不按消息发送者猜测。

OpenIM HTTP API自行生成clientMsgID，因此投递保证为至少一次；发送成功但确认丢失时可产生多个真实消息。前端按room/双方/expires折叠，优先v2终结记录，保留真实SDK ID供已读、撤回、搜索和引用使用。明确定位/引用的原消息不会被隐藏。原始消息不删除。

旧通话没有投递能力标志，不自动补发。群通话继续采用原群邀请和authority状态，未声明单聊终结投递能力。新版客户端仅在旧服务未声明能力时保留旧终结发送路径。

## 时长

由经过签名验证的LiveKit参与者入房事件确认双方实际进入媒体房间后开始。重连不重置首次连接时间；同秒重连允许，已退SID不得重放恢复。结束时排除未恢复的末尾离房宽限期。

时长表示整场连接的墙钟时长，中间重连间隔保留。只有租约超时而没有离房事件时无法确定精确结束点，服务端省略时长。旧记录无时间也省略；前端从不使用 created/ended 相减伪造。

## 媒体控制

响铃时麦克风/摄像头按钮保存当前房间偏好，接通后才实际请求设备。默认麦克风开、摄像头关。失败显示真实错误，输入初始化不被播放许可或输出路由失败阻止。

- Android：LiveKit AudioSession选择speaker或可用earpiece/headset/bluetooth；无可用路由时明确失败。
- iOS：选择force_speaker或系统default路由。
- H5：按钮为“声音”，控制远端WebAudio gain，不声称支持浏览器听筒切换。保持SDK音频元素静音，避免双路播放与startAudio自动解除静音。

挂断立即使媒体操作失效、停止已获得的本地track，再异步断开。权限请求迟到完成时再次停止track，避免继续采集。

## 本地部署与验收

Chat镜像：`local/openim-chat:v1.8.4-patch.5-rtc-records-v14`，仅替换chat-api，继承v13现有RPC、验证码和配置。服务：`openim-rn-local-openim-chat-1`；数据库卷保持不变。

前端：`http://127.0.0.1:35881/`。浏览器策略阻断下未补做逐页视觉验收；Go并发测试、前端自动化、独立QA的取消/拒接/超时消息接口验收分别记录，不等同于真机或实际媒体验收。
