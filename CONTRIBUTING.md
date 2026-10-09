# 开发与更新

开发环境为 Node.js 24、Git 和 Windows 10/11 x64。克隆仓库后运行 `npm ci`、`npm test` 和 `npm start`。

```powershell
git clone https://github.com/shguild/stardew-handbook.git
cd stardew-handbook
npm ci
npm test
npm start
```

## 项目目录

| 目录 | 用途 |
| --- | --- |
| `src/` | Electron 主进程、Wiki 正文转换及界面 |
| `assets/` | 自绘界面装饰、图标与附带的 Wiki 图片 |
| `data/` | 官方标题索引、基础词条与来源记录 |
| `build/` | 中文安装向导配置 |
| `tests/` | 回归测试与带来源的官方样本 |
| `scripts/` | 抓取、审查、界面验收及发布工具 |
| `docs/` | 验收记录、截图和使用说明 |
| `.github/` | 持续集成、自动发布与反馈模板 |
| `dist/` | 本机最新安装包和便携包；历史文件在 `dist/archive/` |
| `test-output/` | 生成的测试结果和官网原始审查响应 |

`dist/`、依赖和测试输出不纳入 Git；可下载安装包在 GitHub Releases 中提供。

## 修改代码

从最新 `main` 创建分支，修改后执行 `npm test`。涉及界面或正文转换时，按需运行相关 `scripts/*smoke.cjs`。安装配置修改后执行 `npm run build:installer` 和 `scripts/installer-smoke.ps1`；该验证会临时注册测试安装，并在结束时卸载。

不要无意义地重复抓取全站数据。新增或更新 Wiki 样本时保留原文链接、修订号和许可说明。程序代码为 MIT，Wiki 文本为 CC BY-NC-SA 3.0，游戏图片按第三方声明处理。

## 发布新版本

1. 更新代码，执行测试，并更新 `CHANGELOG.md` 和必要的使用说明。
2. 使用 `npm version patch --no-git-tag-version` 提升修订版本；新功能可将 `patch` 换成 `minor`。
3. 提交 `package.json`、`package-lock.json`、更新记录及代码，合并到 `main`。
4. 推送与软件版本一致的标签，例如版本为 1.0.3 时：

```powershell
git push origin main
git tag -a v1.0.3 -m "Release 1.0.3"
git push origin v1.0.3
```

`Windows release` 工作流会检查版本、运行测试、构建安装包和便携包、验收安装与重装、验证旧词条缓存，生成源码 ZIP 和 SHA256 校验文件，全部通过后发布 GitHub Release。可在仓库的 Actions 页面查看进度与失败日志。无需上传本机的 `node_modules` 或 `dist` 文件夹。

发布附件使用英文文件名，避免 GitHub 改写中文名称；`Installation-Guide-<版本>.txt` 的内容为中文安装与分享说明。

如果标签版本与 `package.json` 不同，发布会停止。已发布的版本不要覆盖；修复后提高版本并推送新标签。

本机手动准备发布文件时，先提交源码，再运行 `npm run build -- --publish never` 和 `npm run release:prepare`。后一个命令要求工作区干净，产物清单保存在 `dist/release-manifest-<版本>.json`。

此工具通过下载新版安装包更新，尚未实现程序内自动更新。
