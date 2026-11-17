# 首次加载骨架优化

**目标：** 复用SDK ChatListShimmer，避免启动遮罩盖住列表骨架；联系人/群列表与资料页面首次无数据使用布局占位，刷新保留已有内容，失败提供重试。
**架构：** SDK不新增组件；产品ui提供静态结构骨架，ProductPage统一加载/失败边界。useTask记录成功完成状态，各业务页面显式启用首次骨架；会话使用独立首次同步完成标记。未增加数据缓存、不修改后端、不触碰原体验数据。

- [x] ProductPage首次加载/失败重试/刷新保留内容测试，先失败后实现。
- [x] 公共产品骨架，接入联系人、好友申请、群聊、群申请、群详情、群管理、个人资料和设置。
- [x] 启动占位复用SDK会话骨架；SDK登录完成即解除恢复遮罩；会话首次同步失败不能显示假空态。
- [x] 类型/lint/UI与业务回归、Web构建；浏览器PC/H5首屏与正常页面检查。

## 完成记录

- SDK已有ChatListShimmer保持不变；StartupSkeleton复用ChatList的isLoading，SDK登录成功后初始化标记即生效，不再等首次会话同步完才解除遮罩。
- 会话使用conversationsLoaded，首次空结果与未完成请求分开；首次失败显示重新加载，重试恢复加载态。已有会话的后台刷新不被骨架替换。
- ProductSkeleton提供静态list/profile/settings占位，避免动画负担与假消息。ProductPage增加显式initialLoading/skeleton/onRetry接口。
- useTask记录hasSucceeded，首次失败不标成功，成功后刷新失败仍保留内容；登出/换账号使用既有组件key和会话重置隔离。
- 接入通讯录、新的朋友、联系人资料、群列表、群申请、群资料、群管理/成员、我的、资料设置。聊天历史/搜索/媒体等其他加载流程未在本轮改成骨架，仍保留原有加载方式。
- 测试：新增ProductPage首次骨架/失败重试/刷新保留内容测试（红态2失败，绿态通过）；UI47套件210项通过，业务263项通过；example类型、root lint、Web导出通过。既有Node module-type警告保留。SDK未改，未重复SDK全量测试。
- 浏览器：独立QA账号PC通讯录首次显示骨架后恢复真实好友；群列表同样验证；390×844 H5群资料骨架→真实资料。刷新登录恢复正常。首次失败/重试由自动化覆盖，未在浏览器人为断开共享服务。
- 原体验数据、后端、缓存实现均未改。只读查看QA页面可能更新QA会话已读状态。未提交或推送。
- 证据目录：docs/openim/evidence/2026-11-17-initial-skeletons/。Web产物：/tmp/im-skeleton-web-export。在线入口：http://127.0.0.1:35881/。
