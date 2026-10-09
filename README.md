# 星露谷手册

Windows 桌面查询工具，资料来自星露谷物语官方中文 Wiki，界面采用像素风山景、木质边框和羊皮纸面板。

## 运行

双击 `dist/Stardew-Handbook-1.0.0-Windows-x64.exe`，无需安装 Node.js 或 Python。适用于 Windows 10/11 的 x64 电脑。

首次解压启动可能需要数秒。该便携程序未进行商业代码签名，Windows 可能显示未知发布者提示。

也可以使用 `dist/win-unpacked/星露谷手册.exe`；该目录中的运行时文件必须一起保留，不能只拷贝其中的 exe。

## 功能

![首页预览](docs/previews/home.png)

- 中文标题即时建议、官方 Wiki 全文搜索与分页。
- 九类百科导航、季节入口、村民头像快捷查询。
- 词条正文、图片、表格、目录、内部跳转、字号调整和官方原文链接。
- 收藏、最近阅读、前后导航与本机保存。
- 正文自动缓存、图片按需缓存、联网失败时回退到缓存。
- 随程序附带官方标题索引及少量官方基础词条。

基础缓存并非全站离线镜像。首次阅读未缓存词条和在线全文搜索需要网络；离线搜索采用标题匹配。缓存显示抓取时间，并可手动刷新。已下载的图片可以离线使用，没有下载的图片可能暂时缺失。

快捷键：Ctrl + K 聚焦搜索；↑ / ↓ 选择建议；Enter 打开或搜索；Alt + ← / → 前后导航；Esc 收起建议。

收藏、历史、设置、词条和图片缓存保存在 `%APPDATA%/stardew-handbook/`（以 Electron 实际 userData 目录为准）。应用内「离线资料」可以查看、清理下载缓存，收藏和基础资料会保留。

## 开发与构建

```powershell
npm ci
npm start
npm test
npm run test:ui
node scripts/smoke.cjs --packaged
node scripts/portable-smoke.cjs
npm run bootstrap
npm run build
```

需要 Node.js 24+。`bootstrap` 从官方 Wiki 下载标题索引、基础词条和图像，保留来源清单；不要无意义地频繁运行。依赖安装须允许 Electron 下载其运行时。便携版由 electron-builder 生成。

开发者可设置 `HANDBOOK_TEST_DIR` 将测试用户数据隔离到指定目录；`HANDBOOK_TEST_HIDDEN=1` 让自动化测试窗口保持隐藏；`HANDBOOK_TEST_OFFLINE=1` 只用于离线验证。这些变量通常无需设置。

## 资料和许可

本程序为非官方资料工具，不读取游戏存档。原创程序代码与自绘装饰为 MIT；Wiki 内容为 CC BY-NC-SA 3.0；游戏图像归 ConcernedApe。各页面保留原文链接与抓取时间。详细说明见 `THIRD_PARTY_NOTICES.md` 和 `data/sources.json`。

官方中文 Wiki：https://zh.stardewvalleywiki.com/Stardew_Valley_Wiki
