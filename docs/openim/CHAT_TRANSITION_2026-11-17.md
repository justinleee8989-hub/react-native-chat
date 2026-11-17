# 会话切换与发送跳动修复 — 2026-11-17

## 原因与实现

- PC 在两个会话之间导航时先 RESET 到消息主列表，再 push 目标会话，出现“选择一个会话”的中间空页。已改为已知会话之间直接 replace；跨栏目导航、账户隔离及移动端返回栈仍保留原机制。
- 会话权限同步期间原输入区被提示条替换，随后恢复，造成高度突变。现在保留同一输入区的布局，待权限确认前禁用输入与操作；真实禁言、非成员等拦截保持原样。
- SDK 原先在发送后固定 10ms 启动滚到底部动画，与异步新消息入列和测量竞争。新增通用 useSendScroll：等待自己的新消息 ID 出现在消息数据中，再调用 LegendList 的非动画 scrollToEnd。提交时机、估算尺寸和 footer 校正由已有列表负责；无 OpenIM 依赖，不再自行订阅尺寸或引入延时。
- 已读/发送状态占位随待发送消息一起切换，避免服务器确认时再移动一次。
- Web 多行输入原先先缩到单行，再下一帧测量；现在在 layout effect 内测量并恢复 DOM 高度，绘制前一次提交最终尺寸。原生仍使用既有 onContentSizeChange。

SDK 只承担通用消息滚动；导航、权限与产品输入区留在 example/features/im。保留气泡、渐变、输入区及页面外观，没有修改后端、数据协议或清理历史数据。

## 实际验收

| 平台 | 本轮操作 | 结果 |
| --- | --- | --- |
| PC 浏览器 | QA 单聊/群聊切换、多行发送、上翻历史后发送 | 无空白主列表中间页；消息完整可见；最终滚动底部差值 0px |
| H5 手机布局 | 返回列表切换 QA 会话、多行发送、连续两条发送、单聊发送 | 输入区保持；新消息完整可见；最终底部差值 0px |
| Android 14 真机 Release | 三条连续发送、两行消息、历史位置发送、新空群首条发送、返回列表并切换 QA 群 | 消息可见且输入清空；键盘保持；返回和会话恢复正常 |

以上为本次两项问题的定向验收，不等于所有功能组合或所有设备零掉帧承诺。H5 使用产品手机预览布局，Android 使用实际 Release APK。录音、视频未测，继续由用户自测。

独立数据：浏览器 QA 6121886020/8539948255、群 3798210539；Android QA 6425355272/5379898012、群 1386688880 及本轮新群 1139200649。只增加 QA 测试消息，原体验数据未操作。

## 自动化与构建

- SDK：89 suites / 498 tests / 34 snapshots，通过。
- IM UI：49 suites / 215 tests，通过。
- OpenIM 业务：266 tests，通过。
- 根 lint、根/应用 TypeScript、SDK 编译、git diff --check，通过。lint 有 Node 既有 MODULE_TYPELESS_PACKAGE_JSON 提示，无 ESLint 错误或警告。
- Android assembleRelease 成功，最终 APK 已 install -r 覆盖安装，保留应用数据。
- APK SHA256：`90c9af186107e0ad1629c7eb8aa689bbb23043d6a436e17065e296622dd85a99`。
- 独立代码审查发现的手动测量通知竞态已通过简化为列表内建提交校正机制消除；最终实现不再使用该临时方案。

本轮日志位于本机 /tmp：im-jump-sdk-final2.log、im-jump-ui-verified.log、im-jump-business.log、im-jump-lint-delivery.log、im-jump-example-types-delivery.log、im-jump-root-types-delivery.log、im-jump-release-delivery.log。
Android 截图：im-jump-android-final-send.png、im-jump-android-history-send.png、im-jump-android-empty-send.png、im-jump-android-switch-final.png（均在 /tmp）。这些是本机临时证据，不随 Git 分发。

本地入口：http://127.0.0.1:35881/ 。没有提交或推送；仓库内其他既有未提交改动保留。
