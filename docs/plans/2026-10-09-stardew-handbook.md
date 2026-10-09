# Stardew Handbook Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 完成可直接在 Windows 10/11 x64 运行的官方 Wiki 查询程序。

**Architecture:** 本地 Electron 页面通过受限 IPC 调用 WikiService。该服务调用官方中文 MediaWiki API、清理正文、维护缓存，Store 持久化个人收藏和最近阅读；附带从 Wiki 抓取的少量启动缓存和标题索引。

**Tech Stack:** Electron 44.7.0、electron-builder 26.15.3、sanitize-html 2.18.0、Node test runner、Playwright 1.64.0。

---

### Task 1: 数据与来源

Create `src/wiki.cjs`, `src/store.cjs`, `src/catalog.cjs`, `scripts/bootstrap.cjs`, `tests/wiki.test.cjs`。

1. 为 URL 白名单、脚本清理、缓存回退和持久化写行为测试；执行 `npm test`，首次应报缺失模块。
2. 实现 `WikiService.search(query)`, `WikiService.page(title, refresh)`, `WikiService.category(title, continueToken)`；请求有超时，保留 Wiki 来源和抓取时间。
3. 实现 `Store` 的原子保存、收藏开关和最近阅读去重；再次执行 `npm test`，预期所有行为测试通过。
4. 执行 `npm run bootstrap` 下载官方标题索引、启动词条缓存和小图标；预期输出来源清单与抓取成功数，失败项必须记录。

### Task 2: 桌面与界面

Create `src/main.cjs`, `src/preload.cjs`, `src/index.html`, `src/styles.css`, `src/renderer.js`, `assets/landscape.svg`。

1. 设置沙箱、上下文隔离、CSP，验证 IPC 来源和输入；只允许打开官方 HTTPS 外链。
2. 实现首页、搜索、分类、阅读目录、收藏、历史、缓存管理和窗口控制；使用 Wiki 图片及自绘像素风装饰。
3. 实现键盘搜索快捷键、前后阅读导航、空状态、错误重试和过期请求屏蔽。
4. 执行 `npm run test:ui`，预期真实搜索、词条阅读、收藏、离线回退、窗口布局通过，无控制台错误；将截图保存到 `test-output/` 并视觉检查。

### Task 3: 交付

Create `README.md`, `LICENSE`, `THIRD_PARTY_NOTICES.md`, `scripts/smoke.cjs`。

1. 说明缓存范围、联网要求、数据许可、构建命令和可执行文件使用方法。
2. 执行 `npm run build`，预期生成 `dist/Stardew-Handbook-1.0.0-Windows-x64.exe`。
3. 通过打包的 `dist/win-unpacked/星露谷手册.exe` 启动验证和便携程序启动验证；截图检查标题、首页和详情页。
4. 写入版本检查报告、SHA256，向用户交付运行文件与源码位置。
