# 账户、资料与头像接入

基线：ChatServer v1.8.4-patch.5，Web SDK 3.8.3-patch.15.1，RN SDK 3.8.3-patch.12.4。

- `/chats/settings`：读取与保存自身昵称、头像，选择本地图片后经 SDK uploadFile 上传，再更新 setSelfInfo；全局消息通知使用 globalRecvMsgOpt=2（接收但不通知）或 0（正常）。不控制系统通知权限或虚构原生推送能力。
- `/chats/people/[id]`：读取好友/用户资料，修改自己的好友备注（不是修改对方昵称），加入/移出黑名单，打开会话；联系人列表已增加资料入口。
- `/chats/account?mode=register|reset`：邮箱注册/密码重置表单，登录页有入口。邮箱验证码服务必须由运维先配置；前端构建变量 `EXPO_PUBLIC_OPENIM_EMAIL_VERIFICATION_ENABLED=true` 只是能力声明，不能代替服务端启用邮件服务。

2026-11-14 只读核对运行容器配置：allowRegister=true，phone.use 为空，mail.enable=false。因此默认禁止请求验证码和提交注册/重置，明确提示管理员开通服务。没有使用或暴露超级验证码；没有发送邮件/SMS、创建用户或改变真实密码。短信流程未接入。

ChatServer 标签源码依据：`pkg/protocol/chat/chat.pb.go`、`internal/api/chat/start.go`、`internal/api/chat/chat.go`、`internal/rpc/chat/login.go`、`internal/rpc/chat/password.go`。邮件验证码 usedFor=1 注册、2 重置；注册 user.password 与重置 password 为 MD5，autoLogin=false。普通用户不能指定注册 userID。后端仍检查邀请码、注册开关与验证码。

修改密码使用 `/account/password/change`，独立 chatToken 鉴权和当前 userID，currentPassword/newPassword 按现有 MD5 协议。旧会话无 chatToken 要求重新登录。后端变更后使 Chat token 失效并强制 IM 下线，成功后前端退出；界面要求二次确认。超时/后端错误保持可见，不自动重试不可判定的账户写入。

平台适配：Web 指定好友参数为 friendUserIDList，RN 为 userIDList。Web uploadFile 使用真实 File 字节且取 data.url，RN 把 content/file URI 复制至缓存后传 filepath 并取 url，上传结束释放临时文件。只接受 HTTP(S) 上传结果；异步上传前后检查页面会话，不能把 blob/file URL 保存为头像。页面按 userID+imToken 隔离。头像资料更新仍须成功调用 SDK；若上传成功但保存失败，可重新操作，可能留下未引用的已上传对象。

本轮未接入 addFriendPermission，因为双平台 SDK 类型不一致；未宣称已验证原生文件系统和真机上传。契约测试覆盖 Web 图片字节、原生路径传递/缓存释放、会话过期、双平台响应归一化、黑名单、备注、全局通知和账户 HTTP 契约。真实服务器上传和页面行为由整体验收执行。
