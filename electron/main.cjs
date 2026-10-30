const { app, BrowserWindow, dialog, ipcMain, net, protocol, session } = require('electron')
const { randomUUID } = require('node:crypto')
const { writeFile, rename, unlink } = require('node:fs/promises')
const path = require('node:path')
const { pathToFileURL } = require('node:url')

const appUrl = 'polymer://app/index.html'
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'polymer',
    privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true },
  },
])

function createWindow() {
  const window = new BrowserWindow({
    width: 1360,
    height: 980,
    minWidth: 760,
    minHeight: 600,
    title: '聚合 PDF',
    backgroundColor: '#f5f7fb',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  })
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  window.webContents.on('will-navigate', (event) => event.preventDefault())
  window.webContents.on('will-prevent-unload', (event) => {
    const answer = dialog.showMessageBoxSync(window, {
      type: 'question',
      buttons: ['继续编辑', '关闭'],
      defaultId: 0,
      cancelId: 0,
      message: '关闭聚合 PDF？',
      detail: '当前文件队列不会保留，请确认已保存导出的 PDF。',
    })
    if (answer === 1) event.preventDefault()
  })
  window
    .loadURL(appUrl)
    .catch(() =>
      dialog.showErrorBox('启动失败', '应用文件无法加载，请重新解压或下载完整的桌面版。'),
    )
}

app
  .whenReady()
  .then(() => {
    const distRoot = path.resolve(__dirname, '../dist')
    protocol.handle('polymer', async (request) => {
      try {
        const url = new URL(request.url)
        if (url.hostname !== 'app' || !['GET', 'HEAD'].includes(request.method))
          return new Response('Not found', { status: 404 })
        const filename = path.resolve(distRoot, `.${decodeURIComponent(url.pathname)}`)
        if (!filename.startsWith(distRoot + path.sep))
          return new Response('Not found', { status: 404 })
        const response = await net.fetch(pathToFileURL(filename).href)
        const headers = new Headers(response.headers)
        headers.set(
          'Content-Security-Policy',
          "default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' blob: data:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'none'",
        )
        return new Response(response.body, { status: response.status, headers })
      } catch {
        return new Response('Not found', { status: 404 })
      }
    })
    session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) =>
      callback(false),
    )
    ipcMain.handle('save-pdf', async (event, bytes, name) => {
      if (
        event.senderFrame?.url !== appUrl ||
        !(bytes instanceof Uint8Array) ||
        bytes.length > 512 * 1024 * 1024 ||
        Buffer.from(bytes.subarray(0, 5)).toString() !== '%PDF-'
      ) {
        return { saved: false, error: '导出内容无效，请重新合并文件。' }
      }
      const owner = BrowserWindow.fromWebContents(event.sender)
      const selection = await dialog.showSaveDialog(owner, {
        title: '保存合并后的 PDF',
        defaultPath: path.basename(String(name || '合并文档.pdf')),
        filters: [{ name: 'PDF 文档', extensions: ['pdf'] }],
      })
      if (selection.canceled || !selection.filePath) return { saved: false }
      const temporaryPath = `${selection.filePath}.${randomUUID()}.tmp`
      try {
        await writeFile(temporaryPath, bytes, { flag: 'wx' })
        await rename(temporaryPath, selection.filePath)
        return { saved: true }
      } catch {
        return { saved: false, error: '保存失败，请检查文件是否被占用或保存目录是否可写。' }
      } finally {
        await unlink(temporaryPath).catch(() => {})
      }
    })
    createWindow()
    app.on('activate', () => {
      if (!BrowserWindow.getAllWindows().length) createWindow()
    })
  })
  .catch(() => {
    dialog.showErrorBox('启动失败', '聚合 PDF 未能启动，请重新下载桌面版。')
    app.quit()
  })

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
