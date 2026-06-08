const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // ── Commands & scrcpy ────────────────────────────────────────────────────
  executeCommand:      (command)        => ipcRenderer.invoke('execute-command', command),
  startScrcpy:         (args)           => ipcRenderer.invoke('start-scrcpy', args),
  runTerminalCommand:  (command, id)    => ipcRenderer.invoke('run-terminal-command', { command, id }),
  generateQR:          (text)           => ipcRenderer.invoke('generate-qr', text),
  showMirror:          ()               => ipcRenderer.invoke('show-mirror'),


  // ── Device ───────────────────────────────────────────────────────────────
  setSelectedDevice:   (deviceId)       => ipcRenderer.invoke('set-selected-device', deviceId),
  getActiveDeviceId:   ()               => ipcRenderer.invoke('get-active-device-id'),

  // ── Overlay controller key dispatch ──────────────────────────────────────
  executeControllerKey: (key)           => ipcRenderer.invoke('execute-controller-key', key),

  // ── Audio state ───────────────────────────────────────────────────────────
  toggleAudioForwardState: ()           => ipcRenderer.invoke('toggle-audio-forward-state'),
  updateAudioState:    (enabled)        => ipcRenderer.invoke('update-audio-state', enabled),
  getAudioState:       ()               => ipcRenderer.invoke('get-audio-state'),

  // ── Overlay window ────────────────────────────────────────────────────────
  toggleControllerWindow: (show)        => ipcRenderer.invoke('toggle-controller-window', show),

  // ── Overlay mouse passthrough (send, not invoke — fire-and-forget) ────────
  setIgnoreMouseEvents: (ignore, opts)  => ipcRenderer.send('set-ignore-mouse-events', ignore, opts),

  // ── Sidebar collapse state ────────────────────────────────────────────────
  setSidebarState:     (expanded)       => ipcRenderer.invoke('set-sidebar-state', expanded),

  // Auto-hide mirror on mouse leave
  setAutoHideState:    (enabled)        => ipcRenderer.invoke('set-auto-hide-state', enabled),
  toggleAutoHide:      ()               => ipcRenderer.invoke('toggle-auto-hide'),
  getAutoHideState:    ()               => ipcRenderer.invoke('get-auto-hide-state'),
  setDockEdge:         (edge)           => ipcRenderer.invoke('set-dock-edge', edge),

  // ── Mirror always-on-top (Win32 SetWindowPos) ─────────────────────────────
  setMirrorAlwaysOnTop: (pinned)        => ipcRenderer.invoke('set-mirror-always-on-top', pinned),

  // ── Clean quit ────────────────────────────────────────────────────────────
  quitAppClean:        ()               => ipcRenderer.invoke('quit-app-clean'),

  // ── Listeners ─────────────────────────────────────────────────────────────
  onTerminalOutput: (id, callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on(`terminal-output-${id}`, listener);
    return () => ipcRenderer.removeListener(`terminal-output-${id}`, listener);
  },
  onToggleAudioCheckbox: (callback) => {
    const listener = (_, enabled) => callback(enabled);
    ipcRenderer.on('toggle-audio-checkbox', listener);
    return () => ipcRenderer.removeListener('toggle-audio-checkbox', listener);
  },
  onUpdateAudioState: (callback) => {
    const listener = (_, enabled) => callback(enabled);
    ipcRenderer.on('update-audio-state', listener);
    return () => ipcRenderer.removeListener('update-audio-state', listener);
  },
  onTriggerFKeyAction: (callback) => {
    const listener = (_, action) => callback(action);
    ipcRenderer.on('trigger-fkey-action', listener);
    return () => ipcRenderer.removeListener('trigger-fkey-action', listener);
  },
  onToggleSidebar: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('toggle-sidebar', listener);
    return () => ipcRenderer.removeListener('toggle-sidebar', listener);
  },
  onShowPasswordPrompt: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('show-password-prompt', listener);
    return () => ipcRenderer.removeListener('show-password-prompt', listener);
  },
  onTerminalOutputSystem: (callback) => {
    const listener = (_, payload) => callback(payload);
    ipcRenderer.on('terminal-output-system', listener);
    return () => ipcRenderer.removeListener('terminal-output-system', listener);
  },
  onMirrorStatusChanged: (callback) => {
    const listener = (_, active) => callback(active);
    ipcRenderer.on('mirror-status-changed', listener);
    return () => ipcRenderer.removeListener('mirror-status-changed', listener);
  },
  onTriggerRelaunchMirror: (callback) => {
    const listener = () => callback();
    ipcRenderer.on('trigger-relaunch-mirror', listener);
    return () => ipcRenderer.removeListener('trigger-relaunch-mirror', listener);
  },
  onScrcpyBoundsUpdated: (callback) => {
    const listener = (_, bounds) => callback(bounds);
    ipcRenderer.on('scrcpy-bounds-updated', listener);
    return () => ipcRenderer.removeListener('scrcpy-bounds-updated', listener);
  },
  onAutoHideStatusChanged: (callback) => {
    const listener = (_, enabled) => callback(enabled);
    ipcRenderer.on('auto-hide-status-changed', listener);
    return () => ipcRenderer.removeListener('auto-hide-status-changed', listener);
  },
  getAppVersion: () => ipcRenderer.invoke('get-app-version')
});
