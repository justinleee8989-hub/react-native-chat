# SDK 通用扩展边界检查

**Goal:** 检查相对本地 upstream/main 的全部 SDK 改动（已提交和未提交），保持产品界面、行为和原体验数据，禁止 OpenIM 业务与产品页面反向依赖进入 SDK。

**Architecture:** 录音播放/采集、可选渲染器、主题尺寸和平台兼容修复仍属于通用SDK。OpenIM鉴权、会话、群权限、已读接口以及产品页面样式留在example/features/im。主题里的录音按钮文案迁到labels，保留旧字段兼容。

- [x] 检查全部本地upstream差异、未跟踪文件、SDK导入和发布依赖；不只检查最近工作区diff。
- [x] 确认当前没有SDK直接引用OpenIM/产品模块；逐类记录通用能力与应用责任。
- [x] 录音文案labels迁移：先测试新文案入口、旧主题兼容和默认行为，再实现并更新公共文档。
- [x] 添加源码/发布依赖边界回归，阻止后续引入OpenIM包或应用层导入。
- [x] 修复context-menu属性注释错位；检查其余新增参数默认值与文档。
- [x] 完整SDK/UI/类型/lint回归与构建；恢复本地前端并核对PC/H5入口。

不增加产品功能，不操作账号数据，不提交或推送。

## 完成结果

新增labels入口先测：2项失败/4项通过；实现后6项通过。边界检测2项通过。最终SDK84套件483项/34快照、产品UI44套件187项通过；root/example类型、lint、diff检查、SDK build和Web导出全部exit0。Node业务未改未重复验收。保留既有模块类型/Jest异步句柄提示。

前端35881已恢复（Metro会话13825），真实QA登录恢复、PC/390px H5聊天布局、中文录音入口和已读数显示已观察。只读复验，没有发送/删除或修改任何体验数据。审查明细见../../openim/SDK_EXTENSION_BOUNDARIES.md。

日志 /tmp/im-sdk-final-*.log、/tmp/im-sdk-build.log、/tmp/im-sdk-web-export.log；Web导出 /tmp/im-sdk-boundary-web。没有提交/推送。
