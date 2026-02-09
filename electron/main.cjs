const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

const APP_URL = process.env.WARCHESS_URL || 'https://chesswarkward.fr/#/connexion'
const allowedOrigin = (() => {
  try {
    return new URL(APP_URL).origin
  } catch {
    return 'https://chesswarkward.fr'
  }
})()

const createWindow = () => {
  const win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: '#120c1c',
    show: false,
    autoHideMenuBar: true,
    icon: path.join(__dirname, '../build/icon.png'),
    webPreferences: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  })

  win.once('ready-to-show', () => win.show())

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith(allowedOrigin)) {
      event.preventDefault()
      shell.openExternal(url)
    }
  })

  win.loadURL(APP_URL)
}

app.whenReady().then(() => {
  app.setAppUserModelId('fr.warchess.desktop')
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
