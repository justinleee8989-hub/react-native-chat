# 前端结构与维护约定

当前产品基于 fork 的 React Native Chat 构建。聊天底座在 `src/`；OpenIM 产品代码在 `example/features/im/`。Web 使用 React Native Web，原生平台通过对应适配文件接入。本文说明当前组织方式，不代表所有页面均为 SDK 默认界面。

## 分层

| 目录 | 职责 |
| --- | --- |
| `src/` | 可复用聊天 SDK，不放产品账号、群权限或具体服务地址 |
| `example/app/` | Expo Router 路由入口，页面实现交给 features |
| `features/im/application/` | 会话状态、事件处理和业务操作编排 |
| `features/im/domain/` | 领域类型与 OpenIM 消息到聊天模型的转换 |
| `features/im/infrastructure/openim/` | 原生/Web SDK 与接口适配 |
| `features/im/messages/` | 聊天呈现、输入、搜索、转发、附件及已读详情 |
| `features/im/auth/contacts/groups/profile/calls/` | 对应业务页面和操作 |
| `features/im/ui/` | 产品主题、尺寸、基础组件与跨页面 UI |
| `features/im/navigation/` | PC 分栏、手机导航、路由恢复和产品外框 |

## 本轮拆分的模块

旧导入入口保留，页面调用方不需要随内部拆分迁移。

- `messages/ProductInputToolbar.tsx`：兼容导出；内部 `ProductInputToolbar/` 包含组合入口、`useComposerSize.ts`、`EmojiPanel.tsx`、`styles.ts`、`constants.ts`、`types.ts`。输入高度与 ref 转发留在 Hook，表情面板只负责显示和回调，发送仍走原来的真实业务回调。
- `messages/ProductMessage.tsx`：兼容导出；内部 `ProductMessage/` 区分 `Bubble.tsx`、`MessageRow.tsx`、`context.ts` 和 `types.ts`。SDK `Bubble`/`Message` 仍负责聊天基础渲染。
- `navigation/ProductShell.tsx`：兼容导出；内部 `Frame.tsx` 处理外框，`Rail.tsx` 处理导航栏，`Layout.tsx` 处理主从分栏，固定布局值集中到 `styles.ts`。
- `ui/primitives.tsx`：公共组件出口；`primitives/` 内拆为 Header/Card/Row/Search/Segment，分隔线 Context 只有一份，共享固定样式集中到 `styles.ts`。
- `auth/AuthForm.tsx`：公共表单出口；`AuthForm/` 内分别为 Page/Field/Controls/styles。认证逻辑继续在原有业务模块中。
- `messages/ChatScreen/`：聊天页，`index.tsx` 保留原导入路径和默认导出。消息行渲染在同级 `useChatRows.tsx`；目录内 `useGroupReadCount.ts`（最新自己群消息的已读人数）、`useChatSend.ts`（发送）、`useFocusedConversation.ts`（聚焦与回到前台）、`useOpeningTransition.ts`（推入转场与诊断打点）、`attachments.tsx`（附件菜单）、`history.tsx`（更早历史）、`inputToolbar.tsx`（输入栏或无权限提示）、`ChatNotices.tsx`、`MissingConversation.tsx`、`voice-errors.ts`、`styles.ts`。
- `shared/diagnostics.ts`：诊断开关（`EXPO_PUBLIC_OPENIM_ENTRY_TRACE=1`）与 `[tag] {json}` 输出，各层共用；不得输出账号或群 ID、令牌、消息内容。

## 后续改动规则

1. 先复用 SDK 的 `Chat`、`ChatList`、`Message`、`Bubble`、`InputToolbar` 和扩展接口；产品外观由产品组件负责。
2. 通用 SDK 新能力才放进 `src/`，并同步公共类型、导出、文档和 SDK 测试。OpenIM 特有逻辑留在应用层。
3. JSX 分层展开。不要把一整行消息、弹窗或表单压成一行。复杂条件使用命名变量或职责清晰的子组件。
4. 固定样式可放在所属模块 `styles.ts`；颜色/尺寸优先用已有主题与 tokens。状态和布局相关样式在消费位置组合，不为抽取而制造跨层依赖。
5. 多职责组件拆为同名目录，保留旧导入入口。Context、订阅和需要保留的状态不能因拆组件重复创建或改变生命周期。
6. 浏览器专属能力局限在平台适配或明确的 Web 分支；不能用 DOM 页面替代 RN 产品页面。
7. 格式遵循根 `AGENTS.md`：两空格、单引号、无分号、命名函数参数前空格、分组导入。以根 lint 和类型检查为门禁。
8. 行为不变的整理先使用既有回归，必要时比较编译后语法树；新功能/缺陷才添加有行为意义的测试，不为文件拆分编写镜像测试。

## 本轮验证口径

本轮不改业务接口、样式值或账号数据，不更新依赖，不提交/推送。代码组织整理不是新的全业务验收；原有页面对照结果见 `PC_H5_PARITY_ACCEPTANCE_2026-11-17.md`。本轮回归与构建结果记录在对应实施计划中。


本轮检查结果：SDK475项测试/34快照、产品UI187项、OpenIM逻辑256项全部通过；两层类型检查、lint、SDK构建与Web导出通过。PC/390px H5入口实际复核通过，详见 [整理计划与结果](../superpowers/plans/2026-11-17-sdk-style-cleanup.md)。
