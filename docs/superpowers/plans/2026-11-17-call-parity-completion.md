# 通话差异补齐实施计划

> 使用 subagent-driven-development 分任务实施；测试使用低级模型。既有重构分支与未提交内容保留，不提交推送，不重置数据。

**目标：** 修复离线终结记录、实际通话时长、真实媒体控制，并接回现有RN页面。

**架构：** Go authority 是终结状态与媒体时间唯一事实来源。终结状态须先持久化再投递，重试保持稳定room键/消息ID，前端合并旧信令和新终结记录但不修改原始消息。媒体计时依据LiveKit签名加入事件中双方实际连接，不把响铃算进时长。旧记录无时间则不伪造。

- [x] 后端：在 `chat/pkg/common/rtcauthority` 增加签名媒体加入后的连接时间与结束时长；同room重连不能重置首个开始时间，过期/重复/非成员webhook不得计时。先增加Go回归测试。
- [x] 后端：实现持久终结记录投递与重试；适配OpenIM服务端消息接口，sender由authority确定，稳定终结ID，重试不依赖客户端在线；不可重放原有体验数据或自动补发已有历史。新功能仅对部署后新创建的通话启用。保留失败outbox直到成功，未交付不随24h清理丢失。
- [x] 前端：扩展可选可信终结元数据（room、caller、callee、status、ended、duration等），兼容旧signal，真实结果图标/文案/时长，聊天预览与通话记录一致。客户端不重复发新协议终结记录；按服务端能力兼容旧服务。
- [x] 前端：响铃中的麦克风/摄像头切换保存本次通话偏好，接通时应用；授权失败提供明确错误并保留可恢复状态。Web扬声器控制远端播放静音（浏览器不能承诺听筒切换），原生使用LiveKit AudioSession实际路由；不以startAudio冒充路由切换。
- [x] 审查：状态竞态、重复终结、离线、断线、webhook重放、权限、消息归属、原生媒体释放、导航与旧历史兼容。
- [x] 验证：Go targeted tests/race，RN业务/UI/typecheck/lint/build；低级模型执行回归。仅独立QA账号作接口验收；原体验数据和视频手工验收安排不变。
- [x] 部署：只更新目标OpenIM chat镜像/服务和35881前端，不重启其他项目，不删卷。记录自动化通过与浏览器未验收项分别列示。

## 实际结果

- 后端分支 `feature/rtc-terminal-records`，未提交/推送。Chat镜像已部署为 `local/openim-chat:v1.8.4-patch.5-rtc-records-v14`，只替换API，容器healthy。
- 463项SDK测试、70项UI测试、234项业务测试通过；Go authority/API race测试、lint及前后端类型检查通过。SDK构建、H5导出通过；最后房间一致性保护改动重跑UI/typecheck/export。
- 独立QA三项部署后接口验收通过：caller_cancel、callee_reject、ring_timeout；均未发送客户端IM信令，双方可读v2终结记录。未接通时长0。报告见 `2026-11-17-rtc-terminal-acceptance.json`。
- 时长与音频路由通过源码、Go/JS/UI测试，未冒充真实摄像头/真机媒体验收。Web声音控制为播放gain，非听筒路由；原生使用真实AudioSession路由。
- 浏览器页面读取策略阻断仍存在，因此逐页PC/手机视觉验收不在本次完成声明内。原有体验数据未动；仅新增三个QA测试通话。
