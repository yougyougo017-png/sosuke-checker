'use strict';

/**
 * SOSUKE Checker — isolated bridge. No Node in the renderer.
 * Built by sosuke.
 */

const { contextBridge, ipcRenderer } = require('electron');

const api = {
  meta: () => ipcRenderer.invoke('app:meta'),
  platforms: () => ipcRenderer.invoke('platforms:list'),
  check: (platform, username, fresh = false) =>
    ipcRenderer.invoke('check:one', { platform, username, fresh }),
  generate: (mode, options = {}) =>
    ipcRenderer.invoke('generator:generate', { mode, ...options }),
  openExternal: (url) => ipcRenderer.invoke('shell:open', url),
  copy: (text) => ipcRenderer.invoke('clipboard:write', text),
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    toggleMaximize: () => ipcRenderer.invoke('window:toggle-max'),
    close: () => ipcRenderer.invoke('window:close'),
    state: () => ipcRenderer.invoke('window:state'),
    onMaximized: (callback) => {
      const handler = (_event, value) => callback(Boolean(value));
      ipcRenderer.on('window:maximized', handler);
      return () => ipcRenderer.removeListener('window:maximized', handler);
    },
  },
  onOpenHelp: (callback) => {
    const handler = () => callback();
    ipcRenderer.on('ui:open-help', handler);
    return () => ipcRenderer.removeListener('ui:open-help', handler);
  },
};

contextBridge.exposeInMainWorld('sosuke', Object.freeze(api));
