'use strict';

/**
 * SOSUKE Checker — Electron main process.
 * Built by sosuke.
 */

const path = require('node:path');
const {
  app,
  BrowserWindow,
  Menu,
  ipcMain,
  shell,
  session,
  nativeTheme,
  clipboard,
  net,
} = require('electron');
const { publicPlatforms, getPlatform } = require('../lib/platforms');
const { checkUsername, stats } = require('../lib/engine');
const { generateNames } = require('../lib/generator');
const { setFetchImpl } = require('../lib/http');

const isMac = process.platform === 'darwin';
const isDev = process.argv.includes('--dev');

let mainWindow = null;

app.setName('SOSUKE Checker');

if (isMac) {
  app.setAboutPanelOptions({
    applicationName: 'SOSUKE Checker',
    applicationVersion: app.getVersion(),
    version: 'Username intelligence',
    credits: 'Built by sosuke.\nLive username availability across 17 platforms.',
    copyright: '© 2026 sosuke',
  });
}

/* ------------------------------------------------------------------ */
/* ipc                                                                 */
/* ------------------------------------------------------------------ */

function registerIpc() {
  ipcMain.handle('app:meta', () => ({
    name: 'SOSUKE Checker',
    version: app.getVersion(),
    by: 'sosuke',
    platform: process.platform,
    packaged: app.isPackaged,
    stats: stats(),
  }));

  ipcMain.handle('platforms:list', () => publicPlatforms());

  ipcMain.handle('check:one', async (_event, payload) => {
    const platform = getPlatform(String((payload && payload.platform) || ''));
    if (!platform) throw new Error('Unknown platform');
    const username = String((payload && payload.username) || '').slice(0, 64);
    return checkUsername(platform.id, username, {
      fresh: Boolean(payload && payload.fresh),
    });
  });

  ipcMain.handle('generator:generate', (_event, payload) => {
    const source = payload && typeof payload === 'object' ? payload : {};
    return generateNames({
      mode: String(source.mode || ''),
      count: Number(source.count) || 12,
      seed: String(source.seed || '').slice(0, 180),
      exclude: Array.isArray(source.exclude)
        ? source.exclude.slice(0, 600).map((item) => String(item || '').slice(0, 25))
        : [],
    });
  });

  ipcMain.handle('shell:open', async (_event, rawUrl) => {
    try {
      const url = new URL(String(rawUrl));
      if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
      await shell.openExternal(url.toString());
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle('clipboard:write', (_event, text) => {
    clipboard.writeText(String(text || ''));
    return true;
  });

  ipcMain.handle('window:minimize', () => {
    if (mainWindow) mainWindow.minimize();
  });

  ipcMain.handle('window:toggle-max', () => {
    if (!mainWindow) return false;
    if (mainWindow.isMaximized()) mainWindow.unmaximize();
    else mainWindow.maximize();
    return mainWindow.isMaximized();
  });

  ipcMain.handle('window:close', () => {
    if (mainWindow) mainWindow.close();
  });

  ipcMain.handle('window:state', () => ({
    maximized: mainWindow ? mainWindow.isMaximized() : false,
  }));
}

/* ------------------------------------------------------------------ */
/* menu                                                                */
/* ------------------------------------------------------------------ */

function buildMenu() {
  const template = [];

  if (isMac) {
    template.push({
      label: app.name,
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'services' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' },
      ],
    });
  }

  template.push({
    label: 'File',
    submenu: [isMac ? { role: 'close' } : { role: 'quit' }],
  });

  template.push({ role: 'editMenu' });

  template.push({
    label: 'View',
    submenu: [
      ...(isDev
        ? [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }]
        : []),
      { role: 'resetZoom' },
      { role: 'zoomIn' },
      { role: 'zoomOut' },
      { type: 'separator' },
      { role: 'togglefullscreen' },
    ],
  });

  template.push({ role: 'windowMenu' });

  template.push({
    label: 'Help',
    submenu: [
      {
        label: 'SOSUKE Checker Manual',
        accelerator: 'CmdOrCtrl+/',
        click: () => mainWindow && mainWindow.webContents.send('ui:open-help'),
      },
      {
        label: 'About the author',
        click: () => mainWindow && mainWindow.webContents.send('ui:open-help'),
      },
    ],
  });

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

/* ------------------------------------------------------------------ */
/* window                                                              */
/* ------------------------------------------------------------------ */

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1380,
    height: 900,
    minWidth: 1040,
    minHeight: 680,
    show: false,
    title: 'SOSUKE Checker',
    backgroundColor: '#070709',
    ...(isMac
      ? {
          titleBarStyle: 'hiddenInset',
          trafficLightPosition: { x: 18, y: 20 },
        }
      : { frame: false }),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      webSecurity: true,
    },
  });

  if (!isMac) mainWindow.setMenuBarVisibility(false);

  mainWindow.loadFile(path.join(__dirname, 'ui', 'index.html'));

  mainWindow.once('ready-to-show', () => mainWindow.show());

  mainWindow.on('maximize', () => {
    if (mainWindow) mainWindow.webContents.send('window:maximized', true);
  });
  mainWindow.on('unmaximize', () => {
    if (mainWindow) mainWindow.webContents.send('window:maximized', false);
  });
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const target = new URL(url);
      if (target.protocol === 'https:' || target.protocol === 'http:') {
        shell.openExternal(target.toString());
      }
    } catch {
      /* ignore */
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow && mainWindow.webContents.getURL();
    if (url !== current) event.preventDefault();
  });
}

/* ------------------------------------------------------------------ */
/* lifecycle                                                           */
/* ------------------------------------------------------------------ */

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  });

  app.whenReady().then(() => {
    nativeTheme.themeSource = 'dark';
    setFetchImpl((url, options) => net.fetch(url, options));
    if (isMac && !app.isPackaged) {
      try {
        app.dock.setIcon(path.join(__dirname, '..', 'build', 'icon.png'));
      } catch {
        /* dev-only nicety */
      }
    }
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
      callback(false);
    });
    registerIpc();
    buildMenu();
    createWindow();

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
  });

  app.on('window-all-closed', () => {
    if (!isMac) app.quit();
  });
}
