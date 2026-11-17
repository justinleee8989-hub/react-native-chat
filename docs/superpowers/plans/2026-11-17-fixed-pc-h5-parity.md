# PC 与手机 H5 固定范围对齐验收计划

> 使用 executing-plans / subagent-driven-development 执行；用户已授权连续检查修复，不再逐步询问是否继续。

**Goal:** 将用户附件全部30个页面及可达弹窗/聊天状态对照实际RN前端，分别形成PC和手机H5有证据的通过清单。

**Architecture:** 原型只读，本地静态服务；实际应用保留真实OpenIM，不以原型假数据替换。视觉对照与源码核查分开记录，缺陷先复现和回归，再最小修复。

**Tech Stack:** React Native / Expo Web / OpenIM；CUA浏览器，Jest与TypeScript。

## 固定执行步骤

- [x] 从附件提取全部SCREENS与overlay状态，映射实际路由（/tmp/im-parity-fixed-inventory.json）。
- [x] 对照PC 1280×720：每页标题、栏宽、字体、间距、色彩、按钮、弹窗、导航；逐页记录不继承历史通过。
- [x] 对照手机H5 390×844，并检查320px窄屏长内容、弹窗和菜单。
- [x] 状态覆盖：菜单/确认/输入/选择/空态/已有数据；聊天回复编辑回应转发附件、通话来电拨打、取消、拒接、未接及浮层结束的可见状态（不接通媒体）。
- [x] 差异落到具体组件，补失败回归后最小修复；不改原体验数据。
- [x] 运行受影响UI回归、根lint、example typecheck和Web导出；若SDK修改再跑SDK完整门禁。
- [x] 逐项复测差异；所有固定条目记录通过、业务必要差异或明确阻碍，未检查不得通过。
- [x] 更新 CURRENT_ACCEPTANCE.md 并交付PC/手机H5两列清单。原生设备与真实视频媒体排除，保持既有约定。

## 页面基线

- [x] `chats` — PC已核；手机H5已核。
- [x] `archived` — PC已核；手机H5已核。
- [x] `newChat` — PC已核；手机H5已核。
- [x] `chat` — PC已核；手机H5已核。
- [x] `chatInfo` — PC已核；手机H5已核。
- [x] `search` — PC已核；手机H5已核。
- [x] `media` — PC已核；手机H5已核。
- [x] `readers` — PC已核；手机H5已核。
- [x] `calls` — PC已核；手机H5已核。
- [x] `contacts` — PC已核；手机H5已核。
- [x] `addFriend` — PC已核；手机H5已核。
- [x] `newFriends` — PC已核；手机H5已核。
- [x] `profile` — PC已核；手机H5已核。
- [x] `profileMore` — PC已核；手机H5已核。
- [x] `groups` — PC已核；手机H5已核。
- [x] `groupCreate` — PC已核；手机H5已核。
- [x] `groupJoin` — PC已核；手机H5已核。
- [x] `groupReqs` — PC已核；手机H5已核。
- [x] `group` — PC已核；手机H5已核。
- [x] `groupManage` — PC已核；手机H5已核。
- [x] `members` — PC已核；手机H5已核。
- [x] `groupInvite` — PC已核；手机H5已核。
- [x] `me` — PC已核；手机H5已核。
- [x] `editProfile` — PC已核；手机H5已核。
- [x] `notify` — PC已核；手机H5已核。
- [x] `blacklist` — PC已核；手机H5已核。
- [x] `security` — PC已核；手机H5已核。
- [x] `login` — PC已核；手机H5已核。
- [x] `register` — PC已核；手机H5已核。
- [x] `reset` — PC已核；手机H5已核。

## 交付记录

执行结果与业务必要差异见 [本轮固定清单验收报告](../../openim/PC_H5_PARITY_ACCEPTANCE_2026-11-17.md)。30页×2布局已对照；187项UI/256项逻辑回归通过，类型/lint/Web导出通过。原生设备、视频媒体和用户接手的账户安全改密反馈不冒记为完成。
