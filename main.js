const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const { exec, spawn, execSync } = require('child_process');


// ─── State ───────────────────────────────────────────────────────────────────
let mainWindow       = null;
let overlayWindow    = null;
let activeDeviceId   = '';
let currentAudioForwardState = false;
let isMirrorActive   = false;
let isSidebarExpanded = true;
let inactivityTimeout = null;
let scrcpyTrackInterval = null;
let lastOverlayBounds  = null;
let spawnedPids = [];
let isQuitting = false;
let isMirrorPinned = false;
let pendingWindowX = null;
let pendingWindowY = null;
let wereFKeysRegistered = false;
let isAutoHideEnabled = false;
let hasMouseEntered = false;
let isMirrorHidden = false;
let lastKnownScrcpyBounds = null;
let dockEdge = 'right';

function runBackgroundCleanUp() {
  if (isQuitting) return;
  isQuitting = true;

  // Immediately hide windows so app feels closed
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.hide(); } catch (_) {}
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try { overlayWindow.hide(); } catch (_) {}
  }

  stopScrcpyTracking();
  try { globalShortcut.unregisterAll(); } catch (_) {}

  // Force stop Audio Share client app on connected phone before killing ADB
  if (activeDeviceId) {
    try {
      execSync(`"${ADB_PATH}" -s ${activeDeviceId} shell am force-stop io.github.mkckr0.audio_share_app`, { windowsHide: true, timeout: 1000 });
    } catch (_) {}
  }

  // Force-kill scrcpy, adb, AudioShareServer, and get_scrcpy_bounds processes immediately on exit
  const killCmd = `powershell -NoProfile -Command "Get-Process -Name scrcpy, adb, AudioShareServer, get_scrcpy_bounds -ErrorAction SilentlyContinue | Stop-Process -Force"`;
  exec(killCmd, { windowsHide: true });
  spawnedPids.forEach(pid => {
    try { exec(`taskkill /F /PID ${pid}`, { windowsHide: true }); } catch (_) {}
  });

  // Keep checking and killing in background for 2 seconds
  let elapsed = 0;
  const interval = setInterval(() => {
    exec(killCmd, { windowsHide: true });
    spawnedPids.forEach(pid => {
      try { exec(`taskkill /F /PID ${pid}`, { windowsHide: true }); } catch (_) {}
    });

    elapsed += 1000;
    if (elapsed >= 2000) {
      clearInterval(interval);
      app.exit(0);
    }
  }, 1000);
}

// ─── Paths ───────────────────────────────────────────────────────────────────
const SCRCPY_DIR    = path.join(__dirname, 'scrcpy-bin');
const ADB_PATH      = path.join(SCRCPY_DIR, 'adb.exe');
const SCRCPY_PATH   = path.join(SCRCPY_DIR, 'scrcpy.exe');
const BOUNDS_EXE    = path.join(__dirname, 'get_scrcpy_bounds.exe');

const SIDEBAR_EXPANDED  = 48;
const SIDEBAR_COLLAPSED = 16;

// ─── Inactivity timer ────────────────────────────────────────────────────────
function resetInactivityTimer() {
  if (inactivityTimeout) clearTimeout(inactivityTimeout);
  if (isMirrorActive) return;
  inactivityTimeout = setTimeout(() => {
    exec(`"${ADB_PATH}" disconnect`, { windowsHide: true }, () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('terminal-output-system', {
          type: 'stdout',
          data: '\n[System] Automatically disconnected Wi-Fi after 30 minutes of inactivity.\n'
        });
      }
    });
  }, 30 * 60 * 1000);
}

// ─── Main window ─────────────────────────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    title: `WprScrcpy v${app.getVersion()} - Mirror Overlay`,
    frame: true,
    backgroundColor: '#0f0f15',
    icon: path.join(__dirname, 'smartphone.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  mainWindow.loadFile('index.html');
  // mainWindow.webContents.openDevTools();

  mainWindow.on('close', (e) => {
    if (!isQuitting) {
      e.preventDefault();
      runBackgroundCleanUp();
    }
  });


}

// ─── Overlay window ───────────────────────────────────────────────────────────
function createOverlayWindow() {
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 600,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: false,
    resizable: false,
    skipTaskbar: true,
    focusable: false,   // Don't steal focus from scrcpy
    show: false,
    title: 'AeroScrcpyOverlayWindow',
    icon: path.join(__dirname, 'smartphone.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  overlayWindow.loadFile('overlay.html');

  overlayWindow.on('closed', () => {
    overlayWindow = null;
    stopScrcpyTracking();
  });
}

// ─── scrcpy window position tracking ─────────────────────────────────────────

let boundsProc = null;

function hideMirror() {
  if (!isMirrorActive || isMirrorHidden) return;
  isMirrorHidden = true;
  hasMouseEntered = false;
  exec(`"${BOUNDS_EXE}" --hide`, { windowsHide: true });
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.hide();
  }
}

function showMirrorWindow() {
  if (!isMirrorActive) return;
  isMirrorHidden = false;
  hasMouseEntered = false;
  exec(`"${BOUNDS_EXE}" --show`, { windowsHide: true });
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.show();
  }
}

function startScrcpyTracking() {
  if (boundsProc) {
    try { boundsProc.kill(); } catch (_) {}
  }
  notFoundCount = 0;
  wereFKeysRegistered = false;
  isMirrorHidden = false;
  hasMouseEntered = false;
  lastKnownScrcpyBounds = null;

  // Register F12 and Ctrl+F12 immediately for the active mirror session
  try {
    if (!globalShortcut.isRegistered('F12')) {
      globalShortcut.register('F12', () => {
        toggleAutoHideMode();
      });
    }
  } catch (e) {}
  try {
    if (!globalShortcut.isRegistered('Ctrl+F12')) {
      globalShortcut.register('Ctrl+F12', () => {
        toggleAutoHideMode();
      });
    }
  } catch (e) {}

  // Start the helper as a single long-running background process directly without shell wrapper to allow clean termination
  boundsProc = spawn(BOUNDS_EXE, [], { windowsHide: true });
  
  let buffer = '';
  boundsProc.stdout?.on('data', data => {
    buffer += data.toString();
    const lines = buffer.split('\n');
    buffer = lines.pop() || ''; // Hold onto incomplete line if any

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === 'NOT_FOUND') {
        if (isMirrorHidden) {
          // If we intentionally hid the mirror, do not treat NOT_FOUND as error/cleanup
          notFoundCount = 0;
          
          // Still track mouse movement relative to last known bounds
          if (isAutoHideEnabled && lastKnownScrcpyBounds) {
            const mouse = screen.getCursorScreenPoint();
            const isMouseOver = (mouse.x >= lastKnownScrcpyBounds.x &&
                                 mouse.x <= lastKnownScrcpyBounds.x + lastKnownScrcpyBounds.width &&
                                 mouse.y >= lastKnownScrcpyBounds.y &&
                                 mouse.y <= lastKnownScrcpyBounds.y + lastKnownScrcpyBounds.height);
            if (isMouseOver) {
              showMirrorWindow();
              hasMouseEntered = true;
            }
          }
        } else {
          notFoundCount++;
          if (notFoundCount >= 20) {
            if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
              overlayWindow.hide();
            }
            if (isMirrorActive) {
              isMirrorActive = false;
              // Force-kill any background scrcpy process that hung or closed its window
              exec('taskkill /F /IM scrcpy.exe', { windowsHide: true });
            }
            lastOverlayBounds = null;
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('mirror-status-changed', false);
            }
            if (wereFKeysRegistered) {
              const keys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'];
              keys.forEach(k => {
                try { globalShortcut.unregister(k); } catch (_) {}
              });
              wereFKeysRegistered = false;
            }
            stopScrcpyTracking();
          }
        }
      } else {
        const parts = trimmed.split(/\s+/).map(Number);
        if (parts.length >= 7 && parts.slice(0, 4).every(isFinite)) {
          const [L, T, R, B, isFg, isMouseOverUnused, isMinimized] = parts;

          const isWindowMinimized = (isMinimized === 1) || (L <= -32000 || T <= -32000);
          if (isWindowMinimized) {
            if (overlayWindow && !overlayWindow.isDestroyed() && overlayWindow.isVisible()) {
              overlayWindow.hide();
            }
            return;
          }
          
          if (L > -10000 && T > -10000 && R > L && B > T) {
            notFoundCount = 0;
            const W = R - L;
            const H = B - T;

            const sideSize = (dockEdge === 'top' || dockEdge === 'bottom') ? 98 : 48;
            let ob;
            if (dockEdge === 'right') {
              ob = { x: L + W - 8, y: T, width: sideSize, height: H };
            } else if (dockEdge === 'left') {
              ob = { x: L - sideSize + 8, y: T, width: sideSize, height: H };
            } else if (dockEdge === 'top') {
              ob = { x: L + 8, y: T - sideSize + 4, width: W - 16, height: sideSize };
            } else if (dockEdge === 'bottom') {
              ob = { x: L + 8, y: T + H - 8, width: W - 16, height: sideSize };
            }

            if (W > 50 && H > 50) {
              lastKnownScrcpyBounds = { x: L, y: T, width: W, height: H };

              // Auto-hide and Wake check using precise screen coords
              if (isAutoHideEnabled && isMirrorActive) {
                const mouse = screen.getCursorScreenPoint();
                const isOverMirror = (mouse.x >= L && mouse.x <= L + W && mouse.y >= T && mouse.y <= T + H);
                const isOverOverlay = (mouse.x >= ob.x && mouse.x <= ob.x + ob.width && mouse.y >= ob.y && mouse.y <= ob.y + ob.height);
                const isMouseOver = isOverMirror || isOverOverlay;
                
                if (isMirrorHidden) {
                  if (isMouseOver) {
                    showMirrorWindow();
                    hasMouseEntered = true;
                  }
                } else {
                  if (isMouseOver) {
                    hasMouseEntered = true;
                  } else if (hasMouseEntered) {
                    hideMirror();
                    return; // Skip layout updates since we just hid it
                  }
                }
              }
            }

            if (isMirrorHidden) {
              // Skip updating bounds and showing overlay if hidden
              return;
            }

            // Apply pending startup window position to eliminate SDL aspect ratio drift
            if (pendingWindowX !== null && pendingWindowY !== null) {
              const px = pendingWindowX;
              const py = pendingWindowY;
              pendingWindowX = null;
              pendingWindowY = null;
              exec(`"${BOUNDS_EXE}" --set-pos ${px} ${py}`, { windowsHide: true });
              return;
            }

            // Report bounds to renderer so they can be saved/remembered
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send('scrcpy-bounds-updated', { x: L, y: T, width: R - L, height: B - T });
            }

            const isWindowMinimized = (isMinimized === 1);
            const shouldBeVisible = !isWindowMinimized;
            const shouldBeTopmost = (isFg === 1) || isMirrorPinned;

            if (shouldBeVisible) {
              if (shouldBeTopmost) {
                overlayWindow.setAlwaysOnTop(true, 'screen-saver');
              } else {
                overlayWindow.setAlwaysOnTop(false);
              }
              if (!overlayWindow.isVisible()) {
                overlayWindow.show();
              }
            } else {
              if (overlayWindow.isVisible()) {
                overlayWindow.hide();
              }
            }

            if (isFg === 1) {
              if (!wereFKeysRegistered) {
                registerFKeys();
                wereFKeysRegistered = true;
              }
            } else {
              if (wereFKeysRegistered) {
                // Unregister only F1-F11, keeping F12!
                const keys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'];
                keys.forEach(k => {
                  try { globalShortcut.unregister(k); } catch (_) {}
                });
                wereFKeysRegistered = false;
              }
            }

            // Only update overlay bounds if changed noticeably to reduce layout thrashing
            const changed = !lastOverlayBounds ||
              Math.abs(ob.x - lastOverlayBounds.x) > 3 ||
              Math.abs(ob.y - lastOverlayBounds.y) > 3 ||
              Math.abs(ob.width  - lastOverlayBounds.width)  > 5 ||
              Math.abs(ob.height - lastOverlayBounds.height) > 5;

            if (changed && overlayWindow && !overlayWindow.isDestroyed()) {
              lastOverlayBounds = ob;
              overlayWindow.setBounds(ob);
            }
          }
        }
      }
    }
  });
}

function stopScrcpyTracking() {
  if (boundsProc) {
    try { boundsProc.kill(); } catch (_) {}
    boundsProc = null;
  }
  lastOverlayBounds = null;
  notFoundCount = 0;
  isMirrorHidden = false;
  hasMouseEntered = false;
  lastKnownScrcpyBounds = null;
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    try { overlayWindow.hide(); } catch (_) {}
  }
  try {
    globalShortcut.unregister('F12');
  } catch (_) {}
  try {
    globalShortcut.unregister('Ctrl+F12');
  } catch (_) {}
  if (wereFKeysRegistered) {
    const keys = ['F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11'];
    keys.forEach(k => {
      try { globalShortcut.unregister(k); } catch (_) {}
    });
    wereFKeysRegistered = false;
  }
}

// ─── F-key global shortcuts ───────────────────────────────────────────────────
// Dynamic registration based on whether mirror window has active focus.
function registerFKeys() {
  const actions = {
    F1: '3', F2: '4', F3: '187',
    F4: 'rotate', F5: 'password', F6: 'screen-off',
    F7: '26', F8: '25', F9: '24',
    F10: 'audio-toggle', F11: 'show-mirror'
  };

  for (const [key, action] of Object.entries(actions)) {
    try {
      if (!globalShortcut.isRegistered(key)) {
        globalShortcut.register(key, () => {
          if (overlayWindow && !overlayWindow.isDestroyed()) {
            overlayWindow.webContents.send('trigger-fkey-action', action);
          }
        });
      }
    } catch (e) {
      console.error(`Cannot register ${key}:`, e.message);
    }
  }


  // Alt+Shift+S: show/hide entire overlay
  try {
    if (!globalShortcut.isRegistered('Alt+Shift+S')) {
      globalShortcut.register('Alt+Shift+S', () => {
        if (!overlayWindow) return;
        if (overlayWindow.isVisible()) overlayWindow.hide();
        else overlayWindow.show();
      });
    }
  } catch (e) {}
}

// ─── App lifecycle ────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow();
  createOverlayWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('before-quit', (e) => {
  if (!isQuitting) {
    e.preventDefault();
    runBackgroundCleanUp();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

// ─── IPC: QR Code ─────────────────────────────────────────────────────────────
ipcMain.handle('generate-qr', async (event, text) => {
  try {
    const QRCode = require('qrcode');
    return await QRCode.toDataURL(text, {
      width: 320, margin: 1,
      color: { dark: '#000000', light: '#ffffff' }
    });
  } catch { return ''; }
});

// ─── IPC: Execute ADB command (one-shot) ─────────────────────────────────────
ipcMain.handle('execute-command', async (event, command) => {
  resetInactivityTimer();
  return new Promise(resolve => {
    let cmd = command;
    if (command.startsWith('adb')) cmd = command.replace(/^adb\b/, `"${ADB_PATH}"`);
    exec(cmd, { cwd: SCRCPY_DIR, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ success: !error, stdout: stdout || '', stderr: stderr || '', code: error?.code || 0 });
    });
  });
});

// ─── IPC: Run streaming terminal command ─────────────────────────────────────
ipcMain.handle('run-terminal-command', (event, { command, id }) => {
  let processedCmd = command;
  if (command.startsWith('adb')) processedCmd = command.replace(/^adb\b/, `"${ADB_PATH}"`);

  let child;
  const pairMatch = command.match(/^adb\s+pair\s+(\S+)\s+(\S+)$/);

  if (pairMatch) {
    child = spawn(`"${ADB_PATH}"`, ['pair', pairMatch[1]], {
      shell: true, cwd: SCRCPY_DIR, windowsHide: true
    });
    setTimeout(() => {
      try { if (child?.stdin && !child.killed) { child.stdin.write(pairMatch[2] + '\n'); child.stdin.end(); } } catch (_) {}
    }, 500);
  } else {
    child = spawn(processedCmd, [], { shell: true, cwd: SCRCPY_DIR, windowsHide: true });
  }

  child.stdout?.on('data', d => mainWindow?.webContents.send(`terminal-output-${id}`, { type: 'stdout', data: d.toString() }));
  child.stderr?.on('data', d => mainWindow?.webContents.send(`terminal-output-${id}`, { type: 'stderr', data: d.toString() }));
  child.on('close', code => mainWindow?.webContents.send(`terminal-output-${id}`, { type: 'exit', code }));

  return { success: true };
});

// ─── IPC: Start scrcpy ───────────────────────────────────────────────────────
ipcMain.handle('start-scrcpy', async (event, args) => {
  return new Promise(resolve => {
    try {
      // Clean up any existing or hung scrcpy process first to avoid ADB port conflicts
      try {
        execSync('taskkill /F /IM scrcpy.exe', { windowsHide: true });
      } catch (_) {}

      // Intercept and extract window coordinates to position them using Win32 API
      pendingWindowX = null;
      pendingWindowY = null;
      const xIdx = args.indexOf('--window-x');
      if (xIdx !== -1) {
        pendingWindowX = parseInt(args[xIdx + 1]);
      }
      const yIdx = args.indexOf('--window-y');
      if (yIdx !== -1) {
        pendingWindowY = parseInt(args[yIdx + 1]);
      }

      // Filter position and size out from scrcpy native startup args to prevent SDL offset/drift bugs
      const filteredArgs = [];
      for (let i = 0; i < args.length; i++) {
        if (args[i] === '--window-x' || args[i] === '--window-y' || args[i] === '--window-width' || args[i] === '--window-height') {
          i++; // Skip the parameter value as well!
        } else {
          filteredArgs.push(args[i]);
        }
      }

      // Add title so we can find it via Win32
      filteredArgs.push('--window-title', 'DeviceMirrorSession');

      const proc = spawn(SCRCPY_PATH, filteredArgs, {
        cwd: SCRCPY_DIR,
        detached: false,
        stdio: 'ignore',
        windowsHide: false
      });

      spawnedPids.push(proc.pid);
      isMirrorActive = true;
      resetInactivityTimer();

      proc.on('exit', () => {
        spawnedPids = spawnedPids.filter(p => p !== proc.pid);
        resetInactivityTimer();
        if (spawnedPids.length === 0) {
          isMirrorActive = false;
          stopScrcpyTracking();
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('mirror-status-changed', false);
          }
        }
      });

      // Start tracking after scrcpy window has time to appear
      setTimeout(startScrcpyTracking, 1800);

      resolve({ success: true, pid: proc.pid });
    } catch (err) {
      resolve({ success: false, error: err.message });
    }
  });
});

// ─── IPC: Device selection ────────────────────────────────────────────────────
ipcMain.handle('set-selected-device', (event, deviceId) => {
  activeDeviceId = deviceId;
  return { success: true };
});

ipcMain.handle('get-active-device-id', () => activeDeviceId);

// ─── IPC: Audio state ─────────────────────────────────────────────────────────
ipcMain.handle('toggle-audio-forward-state', () => {
  currentAudioForwardState = !currentAudioForwardState;
  mainWindow?.webContents.send('toggle-audio-checkbox', currentAudioForwardState);
  overlayWindow?.webContents.send('update-audio-state', currentAudioForwardState);
  return { success: true };
});

ipcMain.handle('update-audio-state', (event, enabled) => {
  currentAudioForwardState = enabled;
  overlayWindow?.webContents.send('update-audio-state', enabled);
  return { success: true };
});

ipcMain.handle('get-audio-state', () => currentAudioForwardState);

// ─── IPC: Overlay mouse passthrough (called from overlay renderer) ────────────
ipcMain.on('set-ignore-mouse-events', (event, ignore, opts) => {
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.setIgnoreMouseEvents(ignore, opts || {});
  }
});

// ─── IPC: Sidebar state ───────────────────────────────────────────────────────
ipcMain.handle('set-sidebar-state', (event, expanded) => {
  isSidebarExpanded = expanded;
  // Immediately resize overlay to match new sidebar width
  if (lastOverlayBounds) {
    const sideW = isSidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;
    const scrcpyW = lastOverlayBounds.width - (isSidebarExpanded ? SIDEBAR_COLLAPSED : SIDEBAR_EXPANDED);
    const newBounds = { ...lastOverlayBounds, width: scrcpyW + sideW };
    lastOverlayBounds = newBounds;
    overlayWindow?.setBounds(newBounds);
  }
  return { success: true };
});

ipcMain.handle('set-dock-edge', (event, edge) => {
  dockEdge = edge;
  return { success: true };
});

function toggleAutoHideMode() {
  isAutoHideEnabled = !isAutoHideEnabled;
  hasMouseEntered = false;
  if (!isAutoHideEnabled && isMirrorActive) {
    showMirrorWindow();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auto-hide-status-changed', isAutoHideEnabled);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('auto-hide-status-changed', isAutoHideEnabled);
  }
}

ipcMain.handle('set-auto-hide-state', (event, enabled) => {
  isAutoHideEnabled = enabled;
  hasMouseEntered = false;
  if (!enabled && isMirrorActive) {
    showMirrorWindow();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('auto-hide-status-changed', isAutoHideEnabled);
  }
  if (overlayWindow && !overlayWindow.isDestroyed()) {
    overlayWindow.webContents.send('auto-hide-status-changed', isAutoHideEnabled);
  }
  return { success: true };
});

ipcMain.handle('toggle-auto-hide', () => {
  toggleAutoHideMode();
  return { success: true };
});

ipcMain.handle('get-auto-hide-state', () => isAutoHideEnabled);

// ─── IPC: Toggle overlay visibility ──────────────────────────────────────────
ipcMain.handle('toggle-controller-window', (event, show) => {
  if (!overlayWindow) return { success: false };
  if (!isMirrorActive && show !== false) {
    return { success: false, error: 'Mirror session is not active!' };
  }
  if (show !== undefined) {
    show ? overlayWindow.show() : overlayWindow.hide();
  } else {
    if (overlayWindow.isVisible()) overlayWindow.hide(); else overlayWindow.show();
  }
  return { success: true };
});

// ─── IPC: Set scrcpy mirror always-on-top via Win32 SetWindowPos ──────────────
ipcMain.handle('set-mirror-always-on-top', (event, pinned) => {
  return new Promise(resolve => {
    isMirrorPinned = pinned;
    const arg = pinned ? '--pin' : '--unpin';
    exec(`"${BOUNDS_EXE}" ${arg}`, { windowsHide: true }, () => {
      resolve({ success: true });
    });
  });
});

// ─── IPC: Wake / Show scrcpy mirror window ───────────────────────────────────
ipcMain.handle('show-mirror', () => {
  if (isMirrorActive) {
    exec(`"${BOUNDS_EXE}" --show`, { windowsHide: true });
    hasMouseEntered = false;
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
    }
  } else {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('trigger-relaunch-mirror');
    }
  }
  return { success: true };
});

// ─── IPC: Quit clean ──────────────────────────────────────────────────────────
ipcMain.handle('quit-app-clean', () => {
  app.quit();
  return { success: true };
});

// ─── IPC: Execute key from overlay ───────────────────────────────────────────
ipcMain.handle('execute-controller-key', async (event, key) => {
  resetInactivityTimer();
  if (!activeDeviceId) return { success: false, error: 'No device selected!' };

  if (key === 'password') {
    mainWindow?.webContents.send('show-password-prompt');
    return { success: true };
  }

  if (key === 'rotate') {
    return new Promise(resolve => {
      exec(`"${ADB_PATH}" -s ${activeDeviceId} shell settings get system user_rotation`, { windowsHide: true }, (_, stdout) => {
        const next = (stdout?.trim() === '0') ? '1' : '0';
        exec(`"${ADB_PATH}" -s ${activeDeviceId} shell settings put system accelerometer_rotation 0`, { windowsHide: true }, () => {
          exec(`"${ADB_PATH}" -s ${activeDeviceId} shell settings put system user_rotation ${next}`, { windowsHide: true }, () => {
            resolve({ success: true });
          });
        });
      });
    });
  }

  if (key === 'record-start') {
    try {
      const rp = spawn(`"${ADB_PATH}"`, ['-s', activeDeviceId, 'shell', 'screenrecord', '--time-limit', '180', '/sdcard/aero_record.mp4'], {
        shell: true, detached: true, stdio: 'ignore', windowsHide: true
      });
      rp.unref();
      return { success: true };
    } catch (e) { return { success: false, error: e.message }; }
  }

  if (key === 'record-stop') {
    return new Promise(resolve => {
      exec(`"${ADB_PATH}" -s ${activeDeviceId} shell pkill -INT screenrecord`, { windowsHide: true }, () => {
        setTimeout(() => {
          const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
          const dest = path.join(SCRCPY_DIR, `record_${dateStr}.mp4`);
          exec(`"${ADB_PATH}" -s ${activeDeviceId} pull /sdcard/aero_record.mp4 "${dest}"`, { windowsHide: true }, pullErr => {
            exec(`"${ADB_PATH}" -s ${activeDeviceId} shell rm /sdcard/aero_record.mp4`, { windowsHide: true });
            resolve({ success: !pullErr, filePath: dest });
          });
        }, 1500);
      });
    });
  }

  if (key.startsWith('input-password:')) {
    const pass = key.slice('input-password:'.length);
    return new Promise(resolve => {
      exec(`"${ADB_PATH}" -s ${activeDeviceId} shell input swipe 500 1500 500 500 350`, { windowsHide: true }, () => {
        setTimeout(() => {
          exec(`"${ADB_PATH}" -s ${activeDeviceId} shell input text "${pass}"`, { windowsHide: true }, () => {
            setTimeout(() => {
              exec(`"${ADB_PATH}" -s ${activeDeviceId} shell input keyevent 66`, { windowsHide: true }, () => resolve({ success: true }));
            }, 200);
          });
        }, 600);
      });
    });
  }

  if (key === 'screen-off' || key === 'screen-on') {
    return new Promise(resolve => {
      const sc = key === 'screen-off' ? '%o' : '%+o';
      const ps = `powershell -Command "$w=New-Object -ComObject wscript.shell;if($w.AppActivate('DeviceMirrorSession')){Start-Sleep -m 150;$w.SendKeys('${sc}')}"`;
      exec(ps, { windowsHide: true }, () => resolve({ success: true }));
    });
  }

  let cmd = key === 'screenshot'
    ? `"${ADB_PATH}" -s ${activeDeviceId} shell input keyevent 120`
    : key === 'unlock'
    ? `"${ADB_PATH}" -s ${activeDeviceId} shell input swipe 500 1500 500 500 350`
    : `"${ADB_PATH}" -s ${activeDeviceId} shell input keyevent ${key}`;

  return new Promise(resolve => {
    exec(cmd, { cwd: SCRCPY_DIR, windowsHide: true }, (error, stdout, stderr) => {
      resolve({ success: !error, stdout: stdout || '', stderr: stderr || '' });
    });
  });
});

// ─── IPC: Show password prompt from overlay ───────────────────────────────────
ipcMain.handle('show-password-prompt', () => {
  mainWindow?.webContents.send('show-password-prompt');
  return { success: true };
});

// ─── IPC: Execute key from main renderer (legacy compat) ─────────────────────
ipcMain.handle('execute-controller-key-from-main', async (event, key) => {
  return ipcMain.emit('execute-controller-key', event, key);
});

// ─── IPC: Get App Version ────────────────────────────────────────────────────
ipcMain.handle('get-app-version', () => app.getVersion());

