# Windows 与 Android 下载包

首页的下载按钮指向 GitHub Releases 中的稳定资源名：

- Windows 64 位安装程序：`pokemon-survivor-setup.exe`
- Android 安装包：`pokemon-survivor-android.apk`

`.github/workflows/native-downloads.yml` 会在 `main` 更新后分别构建 Electron Windows 安装程序和 Capacitor Android APK，并覆盖 `native-downloads` Release 上的最新版文件。Windows 包将游戏源码和素材作为本地资源，桌面版启动时不依赖网站连接。

Android 构建目前使用 Gradle 自动生成的调试签名，可直接安装测试，不用于 Google Play。每次 CI 运行会生成新的调试签名；安装新版前需卸载旧版。要让 APK 原位升级，需要为 Android Release 配置长期保管的签名密钥。

Windows 安装程序目前未做代码签名；Windows SmartScreen 可能显示发布者未知的提示。该包使用 NSIS 当前用户安装方式，不要求管理员权限。
