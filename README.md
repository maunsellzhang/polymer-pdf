# 聚合 PDF · Polymer PDF

在本机预览、排序并合并 PDF 和图片。提供网页和 Windows 桌面版，使用时无需安装 Node.js，也不需要 PDF 处理服务器。

[打开网页版](https://maunsellzhang.github.io/polymer-pdf/) · [下载 Windows EXE](https://github.com/maunsellzhang/polymer-pdf/releases/latest) · [Gitee 镜像](https://gitee.com/zl627/polymer-pdf)

## 功能

- 从文件选择器或拖放区域添加 PDF、PNG、JPG/JPEG。
- 逐页预览 PDF，支持翻页、缩放和适应宽度；图片可直接预览。
- 调整文件顺序、移除单个文件、清空队列。
- 将全部 PDF 页面与图片合成一个 PDF；保留原 PDF 页面尺寸和页面顺序，图片等比例放入横向或纵向 A4 页面。
- 自定义导出名称；网页直接下载，桌面版使用系统保存对话框。
- 检查空文件、损坏文件、加密 PDF 和文件大小，避免带着读取错误导出。
- 文档在当前浏览器或桌面窗口内处理，无账号、无文件上传、无外部字体或统计脚本。

## 使用

### 网页版

打开 [GitHub Pages 网站](https://maunsellzhang.github.io/polymer-pdf/)，添加文件，确认顺序，点击「合并并下载 PDF」。建议使用最新版本 Chrome、Edge 或 Firefox。

网站静态资源由 GitHub Pages 提供；文档内容不发送到服务器。网页首次打开需要网络，离线使用请选择桌面版。刷新或关闭页面后，队列不会保留，导出的文件请自行保存。

### Windows 桌面版

从 [Releases → Assets](https://github.com/maunsellzhang/polymer-pdf/releases/latest) 下载 `Polymer-PDF-1.0.0-windows-x64.exe`，双击运行。支持 Windows 10/11 x64，免安装、可离线运行，不需要另装 Node.js。EXE 内置 Chromium/Electron 运行环境，因此体积比网页文件大。

该社区构建尚未购买代码签名证书，Windows 可能显示未知发布者提示。下载页提供 SHA-256 校验文件。

### 静态网页包

Release 同时提供 `Polymer-PDF-1.0.0-web.zip`。解压后将全部内容部署到任意 HTTP/HTTPS 静态站点即可，无需 Node 服务或数据库。由于浏览器对模块和 Worker 的安全限制，不支持直接双击 `index.html` 以 `file://` 方式使用。

## 当前限制

- 最多 50 个文件，单个不超过 50 MB，总大小不超过 200 MB；处理能力还受设备内存限制。
- 暂不支持加密 PDF，需先使用原软件解除密码保护。
- 合并以页面内容为主，不保证保留书签、附件、交互式表单、文档级脚本和数字签名。需要签名验证的文件请保留原件；表单建议先打印为普通 PDF。
- 暂不提供 OCR、压缩、逐页删除、图片编辑、云存储或自动保存。

## 本地开发

只有开发和打包需要 Node.js 24 或更高版本，使用 npm 和已提交的 `package-lock.json`。

```sh
npm ci
npm run dev
```

开发地址为 `http://127.0.0.1:5173`。

| 命令                    | 用途                                          |
| ----------------------- | --------------------------------------------- |
| `npm test`              | 核心 PDF 逻辑、文件队列及异步生命周期回归测试 |
| `npm run format:check`  | 检查代码格式                                  |
| `npm run format`        | 统一代码格式                                  |
| `npm run build`         | 生成静态网站至 `dist/`                        |
| `npm run preview`       | 在 `http://127.0.0.1:4173` 预览生产构建       |
| `npm run test:browser`  | 对生产构建执行浏览器流程测试                  |
| `npm run desktop`       | 构建并运行 Electron 桌面版                    |
| `npm run desktop:pack`  | 在 Windows 上生成未封装的桌面目录             |
| `npm run desktop:build` | 在 Windows 上生成免安装 EXE 至 `release/`     |

首次运行浏览器测试前执行 `npx playwright install chromium`。也可以将 `PLAYWRIGHT_CHROMIUM_EXECUTABLE` 环境变量设为本机 Chromium/Chrome 的完整路径。先运行 `npm run build`，再运行 `npm run test:browser`；测试使用 4175 端口。设置 `SMOKE_URL` 可检查已部署的网站。

PDF.js 的 Worker、CMaps、标准字体与 WASM 随构建一同发布；`predev` 和 `prebuild` 自动从锁定的依赖复制资源，无需 CDN。

## 项目结构

```text
src/components/    文件选择、队列、PDF/图片预览
src/lib/           PDF 校验/合并与独立的文件队列生命周期
electron/          桌面窗口、沙箱预加载与原生保存接口
scripts/           构建资源准备和浏览器回归检查
tests/             核心逻辑回归测试
.github/workflows/ 持续验证和 GitHub Pages 部署
```

浏览器与桌面共用 Vue 3、PDF.js、pdf-lib 实现。桌面渲染进程启用沙箱、上下文隔离，关闭 Node 集成，仅暴露保存 PDF 的受限接口。

## 发布与同步

GitHub `main` 分支通过 Actions 检查格式、测试、构建和浏览器流程，成功后部署 GitHub Pages。仓库 Pages 的 Source 使用 **GitHub Actions**。

Gitee 保留原来的 `master` 分支与原始提交历史。开发时按需配置两个远程，普通推送即可，无需强制覆盖：

```sh
git remote add github https://github.com/maunsellzhang/polymer-pdf.git
git push origin master
git push github master:main
```

构建产物在 Release Assets 中发布，不提交 `node_modules/`、`dist/` 或 `release/` 到源码分支。具体检查项见 [验证说明](docs/verification.md)。

## 许可证

沿用原项目 [ISC License](LICENSE)，保留原始版权声明。第三方组件遵循各自许可证，发布包保留 PDF.js、Electron 等随附的许可文件。
