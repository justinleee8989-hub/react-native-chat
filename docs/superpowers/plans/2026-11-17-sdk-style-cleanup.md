# SDK 风格整理实施计划

**Goal:** 保持附件界面、OpenIM真实功能和多端行为不变，整理应用层代码，使其遵循 SDK 的可读性、组件组合和职责拆分习惯。

**Architecture:** 已有 feat/openim-integration 包含尚未提交的完整产品，不切换/重置这些改动。以 /tmp/im-style-baseline/im 保存本轮开始时基线。SDK公共接口保持不变；业务适配仍在 application/domain/infrastructure，界面在功能目录。

**Tech Stack:** React Native、TypeScript、Expo、React Native Chat；ESLint、既有Jest与OpenIM测试。

用户已批准前一轮建议的只整理代码、不改界面与功能方案。

- [x] 跑UI基线并保存当前源码；确认本轮仅应用层维护。
- [x] 展开产品TSX过密JSX，应用仓库ESLint规则；不更改字符串、属性或样式值。
- [x] 将ProductInputToolbar拆为入口、类型、输入测量Hook、表情面板和样式，保持导出路径。
- [x] 将ProductMessage分离气泡与消息行；将ProductShell分离外框、导航栏和分栏样式。
- [x] 复核其他长组件；对纯格式改动通过AST等价对比，结构改动逐项审查。
- [x] 运行UI/逻辑回归、root lint、两层TypeScript、SDK测试和构建、Web导出。构建时管理Metro避免lib重建造成旧缓存。
- [x] 复核PC和H5聊天入口；记录实际改动与验证结果，不把源码整理当成新一轮全部业务验收。

验收：没有新业务功能/接口/依赖；无数据操作；公开导入路径保留；禁止通过改测试断言掩盖行为变化。

## 完成记录

- 产品TSX展开为可读JSX，保持颜色、尺寸、文字及动作；67个格式化文件编译AST严格等价，另外3个仅相邻字符串/对象键形式等价，经独立审查确认。5个入口改为兼容导出并分离职责。
- 五组结构整理：输入区、消息、产品外框、公共UI基础组件、认证表单。保持Context唯一实例、回调/ref转发和状态生命周期。
- 无SDK源码变化，无依赖/后端/数据修改。独立QA聊天临时输入后已清空；未发送消息。没有提交或推送。
- 回归：UI44套件187项；SDK82套件475项/34快照；OpenIM逻辑256项，全部通过。root/example TypeScript、root lint、git diff --check、SDK build与Web导出均exit0。
- 浏览器：PC聊天/群已读恢复、三行输入展开后缩回，390×844 H5聊天/群资料与公共卡片、PC注册表单入口实际检查通过。没有重新宣称所有业务状态或原生端验收。
- 本地前端已在原端口35881恢复，Web导出在 /tmp/im-style-final-web。Metro会话52326。
- 已知工具警告：Node MODULE_TYPELESS_PACKAGE_JSON 与 Jest异步句柄退出提示；测试命令正常退出0，不宣称零警告。
- 日志：/tmp/im-style-ui.log、/tmp/im-style-final-*.log、/tmp/im-style-build.log、/tmp/im-style-web-export.log。结构说明见 ../../openim/FRONTEND_STRUCTURE.md。
