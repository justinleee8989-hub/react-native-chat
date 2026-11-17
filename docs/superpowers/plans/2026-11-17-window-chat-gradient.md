# 整窗聊天渐变实施计划

**目标：** 接入用户确认的整屏均匀线性渐变，原始端点 RGB(116,113,255) / (0,142,255) 各通道乘0.95取整，得到 #6E6BF2 / #0087F2。
**架构：** 复用 SDK BubbleBackground 和列表共享滚动值，新增可选 window 模式；原 screen/bubble 行为不变。产品主题提供颜色，SDK 不含 OpenIM 或产品色值。窗口是 RN useWindowDimensions 对应应用窗口，包含导航和输入区域。
**范围：** 本轮仅气泡渐变，不调整全局按钮/强调色、不改后端、不操作原体验数据。

- [x] 新增渐变几何测试：窗口偏移、滚动、尺寸变化、旧列表范围及未测量回退；先失败再实现。
- [x] SDK 增加 window 模式，布局阶段测量列表在窗口中的位置；动画沿用共享值，无逐帧 React setState。
- [x] 产品主题开启两端点渐变，更新 README/llms 公共接口说明。
- [x] 运行 SDK/UI 回归、类型、lint、编译验证；保留既有 lib 直到 staging 构建成功。
- [x] 重启当前 Metro 清缓存，浏览器 PC/H5 实际检查。录音/视频/原生真机不在本轮验收范围。

不提交其他既有修改，不重置工作区。

## 实施与验证结果

- SDK复用 `BubbleBackground` 的原有共享滚动动画；增加 `outgoingGradientMode: window`、布局阶段窗口测量Hook及后端无关几何计算。无逐帧React状态更新。
- 产品颜色仅在 `example/features/im/ui/ProductChatTheme.tsx`，端点 #6E6BF2 / #0087F2；原 screen/bubble/solid 默认行为保持。
- SDK87套件492项/34快照、UI47套件207项通过；声明构建（包含根类型检查）、example类型、root lint、check-compiled、Web export通过。既有Node module-type提示仍在。
- 构建先写 /tmp/im-gradient-sdk-build 再合入lib；仅重启35881 Metro清缓存。Web导出 /tmp/im-gradient-web-export。
- PC与390×844 H5使用独立QA账号、已有QA群3798210539查看。实际滚动验证连续取色与响应式布局；未发消息、未清理数据、未更改后端。查看会话可能更新QA已读状态。
- 截图：docs/openim/evidence/2026-11-17-window-gradient/pc.png 与 h5.png。
- 本轮未做Android/iOS真机验收，未做录音/视频；不将H5替代原生验收。未提交/推送。
