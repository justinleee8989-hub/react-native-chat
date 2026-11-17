# Android Release 性能验收 — 2026-11-17

## 范围

Android 14 / 24053PY09C，ARM64 Release，Hermes、R8 保持启用，应用标志无 DEBUGGABLE。通过 install -r 覆盖安装，未清除数据；移除 Metro 35881 的 ADB reverse 后独立启动成功。本地服务通过其他既有 USB reverse 端口访问。

仅用独立 QA 群 1386688880（Android QA 75e48277）和本轮 QA 账号。长短文本超过 SDK 每页30条，覆盖首次进入后的历史分页；并非万条历史或图片密集会话压测。原体验账号、群、消息未修改。录音、视频按用户要求不测。

## 本轮修复

1. OpenIM RN 原生依赖继承宿主 compileSdk，保留已有 Gradle buildscript 隔离补丁；修复 Release AAR 元数据校验失败。
2. 通过 expo-build-properties 为 WebRTC 的缺失生成桥类加入精确的 R8 dontwarn 规则；未关闭压缩。音视频运行仍由用户自测，不以构建成功替代媒体验收。
3. 本地 QA Release 增加显式启用的回环网络配置，修复扩展接口同步失败。只放行127.0.0.1/localhost，禁止包含子域名，其他地址仍禁用明文。正式构建必须不设置 OPENIM_LOCAL_QA，并重新 clean prebuild，不能复用已生成的 QA 原生目录。
4. SDK 将尾巴颜色动画移到可选尾巴组件中，无尾巴的圆角气泡不再注册这段逐帧 worklet。渐变色、布局及业务接口不变；左右尾巴仍保留原逻辑。新增回归先失败、修改后通过。

## 实测结果

测量工具为系统 dumpsys gfxinfo，表中使用当前 Janky frames，非 legacy 指标。短测各10次100ms滑动（5次上翻、5次下翻）；长测40次交替滑动，每次间隔250ms允许惯性。截图单独执行，不混入计时。未降低手机刷新率。

| 样本 | 总帧 | 卡顿帧 | 比例 | P95 / P99 |
|---|---:|---:|---:|---|
| 优化前首次分页 |217|13|5.99%|19 / 38ms|
| 优化前三轮热滑动合计 |601|32|5.32%|各轮18–19 / 20–25ms|
| 优化后首次分页 |219|14|6.39%|19 / 28ms|
| 优化后三轮热滑动合计 |615|23|3.74%|各轮17–19 / 20ms|
| 优化后连续往返1 |2103|36|1.71%|21 / 23ms|
| 优化后连续往返2 |2095|38|1.81%|22 / 24ms|

短测前后同设备同数据同动作，热滑动观察到改善；首次分页卡顿比例没有下降，不能宣称全部卡顿已消除。长测与短测动作节奏不同，不用于计算优化比例。长测合计4198帧、74个卡顿帧，约1.76%。这些是此设备和此样本的结果，不代表所有设备、消息类型或网络条件。

## 功能与视觉检查

- 冷启动恢复 QA 登录、本地接口同步正常，旧同步失败提示消失。
- 自动分页到 QA-scroll-001 和建群系统消息，无须手点加载；可返回最新消息。
- 六个快速往返截图检查点未见先前大块空白或气泡错位。静态截图不能证明每一帧无瞬时空白。
- 新发 QA-release-verified-20261117 显示在会话，输入框清空；未操作其他会话。
- SDK495项测试/34快照、IM UI212项、root类型、lint、SDK发布编译通过。Jest曾提示退出延迟，随后正常退出0；lint只有既有Node模块类型提示，无ESLint错误或警告。Release构建通过。

## 本地复现

在 example 中运行：

```sh
OPENIM_LOCAL_QA=1 node /tmp/im-tooling/yarn.cjs expo prebuild --platform android --no-install
cd android
JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home ANDROID_HOME=/Users/czzz/Library/Android/sdk ./gradlew app:assembleRelease -PreactNativeArchitectures=arm64-v8a --max-workers=2
```

同一QA配置增量生成可加 --no-clean；切回正式配置需完整重新生成。APK为 example/android/app/build/outputs/apk/release/app-release.apk，本机开发签名，仅用于QA，非正式发布签名。

已安装APK SHA256：80b31b5cf6470d684cb3b0dc4c84d18fd66675fd43a511f1f849765fae7b93e6。

证据在 [android-release目录](evidence/2026-11-17-android-release/)。凭据仅保存在本机临时0600文件，不入库。未提交或推送。
