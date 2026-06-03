const { app, BrowserWindow, ipcMain, globalShortcut, screen } = require('electron');
const path = require('path');
const { exec, spawn } = require('child_process');

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

  // Force-kill scrcpy, adb, and any other WprScrcpy/AeroScrcpy/electron processes immediately (except current PID)
  const killCmd = `powershell -NoProfile -Command "Get-Process -Name WprScrcpy, AeroScrcpy, electron, scrcpy, adb -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne ${process.pid} } | Stop-Process -Force"`;
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
    title: 'WprScrcpy v2 - Mirror Overlay',
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

  let resizeTimeout;
  mainWindow.on('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.invalidate();
      }
    }, 100);
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
function getScrcpyBounds(callback) {
  exec(
    `"${BOUNDS_EXE}"`,
    { windowsHide: true, timeout: 2000 },
    (err, stdout) => {
      if (err || !stdout.trim()) return callback(null);
      const parts = stdout.trim().split(/\s+/).map(Number);
      if (parts.length === 5 && parts.slice(0, 4).every(isFinite)) {
        const [L, T, R, B, isFg] = parts;
        if (R > L && B > T) return callback({ x: L, y: T, width: R - L, height: B - T, isFg: isFg === 1 });
      }
      callback(null);
    }
  );
}

let notFoundCount = 0;

function startScrcpyTracking() {
  if (scrcpyTrackInterval) clearInterval(scrcpyTrackInterval);
  notFoundCount = 0;
  let wereFKeysRegistered = false;

  scrcpyTrackInterval = setInterval(() => {
    if (!overlayWindow || overlayWindow.isDestroyed()) return;

    getScrcpyBounds(bounds => {
      if (bounds) {
        notFoundCount = 0;
        const sideW = isSidebarExpanded ? SIDEBAR_EXPANDED : SIDEBAR_COLLAPSED;
        const ob = { x: bounds.x, y: bounds.y, width: bounds.width + sideW, height: bounds.height };

        const shouldBeVisible = bounds.isFg || isMirrorPinned;
        const shouldBeTopmost = bounds.isFg || isMirrorPinned;

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

        // Handle overlay shortcuts dynamically based on focus
        if (bounds.isFg) {
          if (!wereFKeysRegistered) {
            registerFKeys();
            wereFKeysRegistered = true;
          }
        } else {
          if (wereFKeysRegistered) {
            globalShortcut.unregisterAll();
            wereFKeysRegistered = false;
          }
        }

        // Only update if moved/resized by more than 3px to avoid jitter
        const changed = !lastOverlayBounds ||
          Math.abs(ob.x - lastOverlayBounds.x) > 3 ||
          Math.abs(ob.y - lastOverlayBounds.y) > 3 ||
          Math.abs(ob.width  - lastOverlayBounds.width)  > 5 ||
          Math.abs(ob.height - lastOverlayBounds.height) > 5;

        if (changed) {
          lastOverlayBounds = ob;
          overlayWindow.setBounds(ob);
        }
      } else {
        notFoundCount++;
        // Hide overlay after 3 missed polls (~900 ms)
        if (notFoundCount >= 3 && overlayWindow.isVisible()) {
          overlayWindow.hide();
          isMirrorActive = false;
          lastOverlayBounds = null;
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('mirror-status-changed', false);
          }
          if (wereFKeysRegistered) {
            globalShortcut.unregisterAll();
            wereFKeysRegistered = false;
          }
        }
      }
    });
  }, 300);
}

function stopScrcpyTracking() {
  if (scrcpyTrackInterval) {
    clearInterval(scrcpyTrackInterval);
    scrcpyTrackInterval = null;
  }
  lastOverlayBounds = null;
  notFoundCount = 0;
}

// ─── F-key global shortcuts ───────────────────────────────────────────────────
// Dynamic registration based on whether mirror window has active focus.
function registerFKeys() {
  const actions = {
    F1: '3', F2: '4', F3: '187',
    F4: 'rotate', F5: 'password', F6: 'screen-off',
    F7: '26', F8: '25', F9: '24',
    F10: 'audio-toggle', F11: 'record-toggle'
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

  // F12 register check
  try {
    if (!globalShortcut.isRegistered('F12')) {
      globalShortcut.register('F12', () => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.webContents.send('toggle-sidebar');
        }
      });
    }
  } catch (e) {}

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
      // Remove any pre-existing window positioning args (overlay handles it now)
      const filteredArgs = args.filter(a =>
        !a.startsWith('--window-x') && !a.startsWith('--window-y')
      );

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
        isMirrorActive = false;
        spawnedPids = spawnedPids.filter(p => p !== proc.pid);
        resetInactivityTimer();
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('mirror-status-changed', false);
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
