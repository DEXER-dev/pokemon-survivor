# 宝可梦幸存者

浏览器运行的宝可梦幸存者游戏。

## 本地运行

需要安装 Node.js。在此目录执行：

```powershell
node serve.mjs
```

然后打开 <http://localhost:8123/>。

运行模拟回归检查：

```powershell
node sim-test.mjs 0.01
```

音频素材来源与说明见 `assets/audio/SOURCES.md`。

## 下载 Windows / Android 版本

首页提供 Windows EXE 和 Android APK 下载入口。安装包会在更新 `main` 分支时由 GitHub Actions 构建，并发布到 [最新下载 Release](https://github.com/DEXER-dev/pokemon-survivor/releases/latest)。构建与 Android 签名限制见 [`distribution/README.md`](distribution/README.md)。

## 许可证

原创代码采用 0BSD。该许可不覆盖第三方引擎或素材；详见 `THIRD-PARTY-NOTICES.md`。
