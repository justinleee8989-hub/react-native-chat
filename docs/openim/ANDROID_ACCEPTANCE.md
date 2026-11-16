# Android 真机验收

## 本轮状态（2026-11-16）

- ARM64 调试 APK 构建成功，已安装至 Android 14 真机，原生登录页正常展示，独立 QA 账号登录成功，OpenIM 显示“已连接”。
- 已验收：保存会话冷启动恢复、好友搜索与申请、对端接受后联系人刷新、打开单聊、原生发送文字、接收对端实时文字。对端使用独立 QA 用户会话发消息，服务端返回成功，手机确认显示。
- 已验收文件路线：从系统文件选择器发送新建 TXT（58 B）与仓库自带 PNG（384 KB），两条消息显示发送成功标记；打开 PNG 附件后，浏览器从本地对象存储完成下载。PNG 本轮以文件消息发送，不代表相册图片消息及图片预览路线已验收。
- 全页面及全部原生能力尚未逐项验收；群管理、录音、通话媒体、后台恢复、系统权限拒绝等不能由上述通过项推断。视频由用户自行测试，iOS 不属于本轮验收范围。
- 已修复原生消息附件、头像、待发送附件缓存的文件复制未等待完成问题：SDK 现在仅在复制成功后读取文件路径，复制失败直接返回错误。
- OpenIM RN SDK 的旧 Android 构建插件仅在独立构建该库时加载，应用工程使用自身插件；补丁保存在 example/.yarn/patches，随 yarn.lock 复现。
- 验证：217 项 OpenIM 业务测试（含 6 项原生复制回归）、75 组/460 项组件库测试、34 项快照、根目录及 example 的 lint/typecheck、组件库 build 均通过。

## 本机复现

使用项目要求的 Yarn 4。Java 17、Android SDK/NDK 已安装；仅安装真机工具，没有安装模拟器。SDK 平台包名为 platforms;android-37.0，Build Tools 为 37.0.0，NDK 为 27.1.12297006，CMake 为 3.22.1。

在 example 中生成原生工程（不要手工修改生成目录）：

```sh
yarn expo prebuild --platform android --no-install
```

在生成的 android/local.properties 中设置本机 sdk.dir，然后构建：

```sh
export JAVA_HOME=/opt/homebrew/opt/openjdk@17/libexec/openjdk.jdk/Contents/Home
cd example/android
./gradlew app:assembleDebug -PreactNativeArchitectures=arm64-v8a -PreactNativeDevServerPort=35881 --max-workers=2
```

APK：example/android/app/build/outputs/apk/debug/app-debug.apk。它是调试包，需要电脑上的 Metro 服务，并非脱离电脑独立运行的发行包。

另开终端，在 example 目录启动 Metro：

```sh
yarn expo start --host localhost --port 35881 --max-workers 2 --clear
```

回到仓库根目录执行以下安装命令。手机开启 USB 调试并允许电脑；部分系统自动操作还要求 USB 调试（安全设置）。安装、转发及启动（多设备时显式指定 adb -s）：

```sh
export PATH=/Users/czzz/Library/Android/sdk/platform-tools:$PATH
adb install -r example/android/app/build/outputs/apk/debug/app-debug.apk
for port in 35881 10008 10002 10001 10005 37880 37881; do
  adb reverse tcp:$port tcp:$port
done
adb shell am start -n com.anonymous.example/.MainActivity
```

USB 转发使手机的 127.0.0.1 能访问本机服务；不必开放本地 Docker 的局域网端口。音视频的实际媒体通路仍须独立验收，不能仅凭信令端口连通判定成功。拔线或重启后应检查并重新建立转发。

仅使用独立 QA 账号，本轮账号密码不提交仓库；原有体验账号和群不参与破坏性测试。

开发模式修改源码后，Fast Refresh 曾使原生 SDK 的旧会话未能恢复；正常结束并重启本测试应用后，保存会话自动登录成功。重新插拔 USB 会清空 adb reverse，需先恢复转发再启动应用。
