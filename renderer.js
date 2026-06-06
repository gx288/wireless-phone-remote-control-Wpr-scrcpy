// Select DOM Elements
const navButtons = document.querySelectorAll('.nav-btn');
const tabPanels = document.querySelectorAll('.tab-panel');
const currentTabTitle = document.getElementById('current-tab-title');
const currentTabDesc = document.getElementById('current-tab-desc');

// ADB Global Status Elements
const adbStatusDot = document.querySelector('.status-indicator .dot');
const adbStatusText = document.getElementById('adb-service-status');
const btnKillServer = document.getElementById('btn-kill-server');
const btnStartServer = document.getElementById('btn-start-server');

// Tab 1: Devices List Elements
const btnToggleFloatBar = document.getElementById('btn-toggle-float-bar');
const btnRefreshDevices = document.getElementById('btn-refresh-devices');
const noDevicesMsg = document.getElementById('no-devices-msg');
const devicesList = document.getElementById('devices-list');
const deviceCountBadge = document.getElementById('device-count');

// Scrcpy Configuration Elements
const scrcpyResolution = document.getElementById('scrcpy-resolution');
const scrcpyBitrate = document.getElementById('scrcpy-bitrate');
const scrcpyFps = document.getElementById('scrcpy-fps');
const optAlwaysOnTop = document.getElementById('opt-always-on-top');
const optStayAwake = document.getElementById('opt-stay-awake');
const optAudioForward = document.getElementById('opt-audio-forward');
const optShowTouches = document.getElementById('opt-show-touches');
const optRecord = document.getElementById('opt-record');
const deviceSavedPassword = document.getElementById('device-saved-password');

// Tab 2: QR Wireless Debugging Elements
const qrImage = document.getElementById('qr-image');
const qrLoading = document.getElementById('qr-loading');
const qrServiceName = document.getElementById('qr-service-name');
const qrPairingCode = document.getElementById('qr-pairing-code');
const btnRegenerateQr = document.getElementById('btn-regenerate-qr');
const btnOpenSettingsQr = document.getElementById('btn-open-settings-qr');
const qrMdnsLog = document.getElementById('qr-mdns-log');

// Tab 3: Auto IP Wizard Elements
const wizIp = document.getElementById('wiz-ip');
const btnScanLan = document.getElementById('btn-scan-lan');
const btnScanMdns = document.getElementById('btn-scan-mdns');
const lanDevicesContainer = document.getElementById('lan-devices-container');
const lanScanTitle = document.getElementById('lan-scan-title');
const lanIpsList = document.getElementById('lan-ips-list');
const wizPairPort = document.getElementById('wiz-pair-port');
const wizPairCode = document.getElementById('wiz-pair-code');
const wizConnectPort = document.getElementById('wiz-connect-port');
const btnRunWizard = document.getElementById('btn-run-wizard');
const wizardLog = document.getElementById('wizard-log');

// Tab 4: Terminal Elements
const terminalScreen = document.getElementById('terminal-screen');
const terminalInput = document.getElementById('terminal-input');
const btnSendCmd = document.getElementById('btn-send-cmd');
const btnClearTerminal = document.getElementById('btn-clear-terminal');
const snippetButtons = document.querySelectorAll('.snippet-btn');
const btnQuitApp = document.getElementById('btn-quit-app');
const termSelectDevice = document.getElementById('term-select-device');

// --- Tab Details Map ---
const tabDetails = {
  'devices-tab': {
    title: 'Devices & Mirroring',
    desc: 'Manage phone connections and customize advanced Scrcpy settings'
  },
  'wifi-tab': {
    title: 'Wireless Connection (Wi-Fi Debugging)',
    desc: 'Set up quick wireless ADB connection via QR Code or IP Address'
  },
  'terminal-tab': {
    title: 'Terminal CMD',
    desc: 'Interactive command line interface to communicate directly with ADB and system shell'
  }
};

// --- General State Variables ---
let devices = [];
let currentPairingService = '';
let currentPairingPassword = '';
let isScanningQR = false;
let qrScanIntervalId = null;
let selectedDeviceId = null;
let selectedDeviceName = '';
let isMirroringActive = false;

// ==========================================
// 1. TABS NAVIGATION & INITIALIZATION
// ==========================================
navButtons.forEach(button => {
  button.addEventListener('click', () => {
    const targetTab = button.getAttribute('data-tab');
    
    // Toggle Nav Buttons Active
    navButtons.forEach(btn => btn.classList.remove('active'));
    button.classList.add('active');
    
    // Toggle Panels Active
    tabPanels.forEach(panel => panel.classList.remove('active'));
    document.getElementById(targetTab).classList.add('active');
    
    // Update Title & Desc
    currentTabTitle.innerText = tabDetails[targetTab].title;
    currentTabDesc.innerText = tabDetails[targetTab].desc;

    // Trigger tab specific actions
    if (targetTab === 'devices-tab') {
      refreshDevicesList();
    } else if (targetTab === 'wifi-tab') {
      generateWirelessQR();
    } else if (targetTab === 'terminal-tab') {
      terminalInput.focus();
    }
  });
});

// ==========================================
// 2. ADB STATUS MANAGEMENT
// ==========================================
async function checkAdbStatus() {
  const res = await window.api.executeCommand('adb devices');
  if (res.success) {
    adbStatusDot.className = 'dot running';
    adbStatusText.innerText = 'Running';
  } else {
    adbStatusDot.className = 'dot stopped';
    adbStatusText.innerText = 'Stopped';
  }
}

btnKillServer.addEventListener('click', async () => {
  appendTerminalLine('[System] Stopping ADB server...', 'system-line');
  const res = await window.api.executeCommand('adb kill-server');
  if (res.success) {
    appendTerminalLine('ADB Server stopped successfully.', 'success-line');
  } else {
    appendTerminalLine('An error occurred: ' + res.stderr, 'error-line');
  }
  checkAdbStatus();
  refreshDevicesList();
});

btnStartServer.addEventListener('click', async () => {
  appendTerminalLine('[System] Starting ADB server...', 'system-line');
  const res = await window.api.executeCommand('adb start-server');
  if (res.success) {
    appendTerminalLine('ADB Server started successfully.', 'success-line');
  } else {
    appendTerminalLine('An error occurred: ' + res.stderr, 'error-line');
  }
  checkAdbStatus();
  refreshDevicesList();
});

// Periodically check ADB status
// Let's use a 5-second interval
setInterval(checkAdbStatus, 5000);
checkAdbStatus();

// ==========================================
// 3. DEVICE MANAGER (TAB 1)
// ==========================================
btnRefreshDevices.addEventListener('click', refreshDevicesList);
if (btnQuitApp) {
  btnQuitApp.addEventListener('click', (e) => {
    e.preventDefault();
    window.api.quitAppClean();
  });
}

async function refreshDevicesList() {
  btnRefreshDevices.disabled = true;
  btnRefreshDevices.innerText = '🔄 Refreshing...';
  
  const res = await window.api.executeCommand('adb devices');
  devicesList.innerHTML = '';
  
  if (termSelectDevice) {
    termSelectDevice.innerHTML = '<option value="">-- No active selection --</option>';
  }
  
  if (!res.success) {
    noDevicesMsg.style.display = 'flex';
    deviceCountBadge.innerText = '0 devices';
    btnRefreshDevices.disabled = false;
    btnRefreshDevices.innerText = '🔄 Refresh Devices';
    return;
  }
  
  const lines = res.stdout.split('\n');
  const parsedDevices = [];
  
  for (let line of lines) {
    line = line.trim();
    if (line === '' || line.startsWith('List of devices') || line.startsWith('* daemon')) {
      continue;
    }
    
    const parts = line.split(/\s+/);
    if (parts.length >= 2) {
      const id = parts[0];
      const status = parts[1]; // device, unauthorized, offline
      
      // Filter out offline devices from the list and automatically disconnect them to clean up ADB cache
      if (status === 'offline') {
        if (id.includes(':')) {
          window.api.executeCommand(`adb disconnect ${id}`);
        }
        continue;
      }
      
      parsedDevices.push({ id, status, model: 'Loading details...' });
    }
  }
  
  devices = parsedDevices;
  
  if (devices.length === 0) {
    noDevicesMsg.style.display = 'flex';
    deviceCountBadge.innerText = '0 devices';
  } else {
    noDevicesMsg.style.display = 'none';
    deviceCountBadge.innerText = `${devices.length} device(s)`;
    
    // Render placeholders
    devices.forEach((dev, idx) => {
      renderDeviceItem(dev, idx);
      
      // Populate Terminal dropdown
      if (termSelectDevice) {
        const opt = document.createElement('option');
        opt.value = dev.id;
        opt.innerText = `${dev.model || 'Device'} (${dev.id})`;
        if (selectedDeviceId === dev.id) {
          opt.selected = true;
        }
        termSelectDevice.appendChild(opt);
      }
      
      // Fetch async device human name
      fetchDeviceModel(dev.id, idx);
    });

    // Auto select first device automatically on refresh
    if (parsedDevices.length > 0) {
      setTimeout(() => {
        const firstDev = parsedDevices[0];
        selectDevice(firstDev.id, firstDev.model);
        const firstCard = document.getElementById('device-item-0');
        if (firstCard) {
          firstCard.style.border = '1px solid rgba(136, 19, 55, 0.35)';
          firstCard.style.backgroundColor = 'rgba(136, 19, 55, 0.03)';
        }
      }, 1200);
    }
  }
  
  btnRefreshDevices.disabled = false;
  btnRefreshDevices.innerText = '🔄 Refresh Devices';
}

function renderDeviceItem(dev, index) {
  const isOnline = dev.status === 'device';
  const statusClass = isOnline ? 'online' : 'unauthorized';
  const statusLabel = isOnline ? 'Active' : dev.status;
  const isWifi = dev.id.includes(':') || dev.id.includes('._tcp') || dev.id.startsWith('adb-');
  
  const forgetButtonHtml = isWifi ? `
    <button class="btn btn-secondary btn-glow" id="btn-forget-${index}" title="Forget device history (Disconnect)" style="margin-right: 6px; padding: 6px 10px; color: var(--accent-error); border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.03);">
      🗑️
    </button>
  ` : '';

  const item = document.createElement('div');
  item.className = 'device-item';
  item.id = `device-item-${index}`;
  item.innerHTML = `
    <div class="device-item-left">
      <div class="device-item-icon">📱</div>
      <div class="device-item-info">
        <h4 id="device-model-${index}">${dev.model}</h4>
        <p>${dev.id}</p>
        <span class="device-item-status-pill ${statusClass}">${statusLabel}</span>
      </div>
    </div>
    <div class="device-item-right" style="display: flex; align-items: center;">
      ${forgetButtonHtml}
      <button class="btn btn-primary btn-glow" id="btn-mirror-${index}" ${!isOnline ? 'disabled' : ''}>
        ⚡ Mirror
      </button>
    </div>
  `;
  
  devicesList.appendChild(item);
  
  // Highlight card and select device on click
  item.style.cursor = 'pointer';
  item.addEventListener('click', (e) => {
    if (e.target.id && (e.target.id.startsWith('btn-mirror') || e.target.id.startsWith('btn-forget'))) return;
    selectDevice(dev.id, dev.model);
    
    // Update active highlight style
    document.querySelectorAll('.device-item').forEach(el => {
      el.style.border = '1px solid var(--glass-border)';
      el.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
    });
    item.style.border = '1px solid rgba(136, 19, 55, 0.35)';
    item.style.backgroundColor = 'rgba(136, 19, 55, 0.03)';
  });
  
  const mirrorBtn = item.querySelector(`#btn-mirror-${index}`);
  mirrorBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid triggering card selection click
    startScrcpyMirror(dev.id);
  });

  if (isWifi) {
    const forgetBtn = item.querySelector(`#btn-forget-${index}`);
    forgetBtn.addEventListener('click', async (e) => {
      e.stopPropagation(); // Avoid triggering card selection click
      
      const ip = dev.id.split(':')[0];
      appendTerminalLine(`[System] Disconnecting and forgetting IP: ${ip}`, 'info-line');
      
      await window.api.executeCommand(`adb disconnect ${dev.id}`);
      
      // Clean from lists
      ['wpr_saved_ips', 'aero_saved_ips'].forEach(key => {
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            let ipList = JSON.parse(saved);
            if (Array.isArray(ipList)) {
              ipList = ipList.filter(item => item !== ip && item !== dev.id);
              localStorage.setItem(key, JSON.stringify(ipList));
            }
          } catch (_) {}
        }
      });
      
      refreshDevicesList();
    });
  }
}

async function fetchDeviceModel(id, index) {
  const modelRes = await window.api.executeCommand(`adb -s ${id} shell getprop ro.product.model`);
  const brandRes = await window.api.executeCommand(`adb -s ${id} shell getprop ro.product.brand`);
  
  let modelName = 'Android Device';
  if (modelRes.success && modelRes.stdout.trim() !== '') {
    const brand = brandRes.success ? brandRes.stdout.trim() : '';
    const model = modelRes.stdout.trim();
    modelName = `${brand.toUpperCase()} ${model}`;
  } else {
    modelName = id.includes('.') ? 'WiFi Device' : 'USB Device';
  }
  
  const label = document.getElementById(`device-model-${index}`);
  if (label) {
    label.innerText = modelName;
  }
  
  // Save in local state
  devices[index].model = modelName;

  // Update option label in Terminal selector dropdown
  if (termSelectDevice) {
    const opt = Array.from(termSelectDevice.options).find(o => o.value === id);
    if (opt) {
      opt.innerText = `${modelName} (${id})`;
    }
  }
}

// Start Scrcpy Command Builder
async function startScrcpyMirror(deviceId) {
  // Ensure we select the device so activeDeviceId is updated in main.js and floating bar knows it
  selectDevice(deviceId, selectedDeviceName || deviceId);

  const args = ['-s', deviceId, '--window-title', 'DeviceMirrorSession', '--no-mouse-hover'];
  
  // Restore window position and size if previously saved
  try {
    const savedBoundsStr = localStorage.getItem('wpr_mirror_bounds');
    if (savedBoundsStr) {
      const bounds = JSON.parse(savedBoundsStr);
      if (bounds && bounds.x !== undefined && bounds.y !== undefined) {
        // Clamp Y coordinate to 0 or greater to stick the window to the top edge and prevent title bar from going off-screen
        let yCoord = bounds.y;
        if (yCoord < 0) {
          yCoord = 0;
        }
        args.push('--window-x', String(bounds.x), '--window-y', String(yCoord));
        if (bounds.width && bounds.height) {
          args.push('--window-width', String(bounds.width), '--window-height', String(bounds.height));
        }
      }
    }
  } catch (e) {
    console.error('Error loading saved mirror bounds:', e);
  }
  
  // Bitrate
  const br = scrcpyBitrate.value;
  if (br !== '0') {
    args.push('-b', br);
  }
  
  // Resolution (Max size)
  const res = scrcpyResolution.value;
  if (res !== '0') {
    args.push('-m', res);
  }
  
  // FPS
  const fps = scrcpyFps.value;
  if (fps !== '0') {
    args.push('--max-fps', fps);
  }
  
  // Always on top
  if (optAlwaysOnTop.checked) {
    args.push('--always-on-top');
  }
  
  // Stay Awake
  if (optStayAwake.checked) {
    args.push('--stay-awake');
  }
  
  // Audio Forwarding (scrcpy v2+ defaults to audio, disable via --no-audio)
  if (!optAudioForward.checked) {
    args.push('--no-audio');
  }
  
  // Show touches
  if (optShowTouches.checked) {
    args.push('--show-touches');
  }

  // Turn off physical screen (keep mirror bright)
  const optTurnScreenOff = document.getElementById('opt-turn-screen-off');
  if (optTurnScreenOff && optTurnScreenOff.checked) {
    args.push('--turn-screen-off');
  }
  
  // Record Video
  if (optRecord.checked) {
    const dateStr = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `record_${deviceId}_${dateStr}.mp4`;
    args.push('-r', filename);
    appendTerminalLine(`[Scrcpy] Recording mirror session to file: ${filename}`, 'system-line');
  }
  
  appendTerminalLine(`[Scrcpy] Launching mirror session for device: ${deviceId} with parameters: ${args.join(' ')}`, 'system-line');
  
  const mirrorRes = await window.api.startScrcpy(args);
  if (mirrorRes.success) {
    isMirroringActive = true;
    appendTerminalLine(`Opened mirror window for device ${deviceId}`, 'success-line');
    
    // Auto-start Audio Share if option checked
    const optAutoAudio = document.getElementById('opt-auto-audio-share');
    if (optAutoAudio && optAutoAudio.checked) {
      startAudioShare();
    }

    // Automatically launch the floating controller bar after a brief delay to sit strictly on top of scrcpy window
    setTimeout(() => {
      if (window.api && window.api.toggleControllerWindow) {
        window.api.toggleControllerWindow(true);
      }
    }, 1500);
  } else {
    appendTerminalLine(`Failed to launch mirror: ${mirrorRes.error}`, 'error-line');
  }
}

// ==========================================
// 4. WI-FI DEBUGGING QR CODE PAIRING (TAB 2)
// ==========================================
btnRegenerateQr.addEventListener('click', generateWirelessQR);

// Send intent to phone via ADB to open Wireless Debugging settings directly
async function openWirelessSettingsOnPhone() {
  appendTerminalLine('[System] Sending request to open Wireless Debugging settings on the phone...', 'system-line');
  const res = await window.api.executeCommand('adb shell am start -a android.settings.WIRELESS_DEBUGGING_SETTINGS');
  
  if (res.success && !res.stderr.includes('Error') && !res.stdout.includes('Error')) {
    appendTerminalLine('Wireless Debugging settings screen opened successfully on your phone!', 'success-line');
  } else {
    appendTerminalLine('Failed to open settings on phone. Please ensure it is initially connected via USB!', 'error-line');
    alert('Could not open settings on phone!\n\nPlease make sure your phone is connected to the PC via USB so that the application can send the initial command.');
  }
}

if (btnOpenSettingsQr) btnOpenSettingsQr.addEventListener('click', openWirelessSettingsOnPhone);

async function generateWirelessQR() {
  qrLoading.style.display = 'block';
  qrImage.style.display = 'none';
  
  // 1. Create random service and pairing code
  const randCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  const randSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  const servName = `wpr-${randSuffix}`;
  
  currentPairingService = servName;
  currentPairingPassword = randCode;
  
  qrServiceName.innerText = servName;
  qrPairingCode.innerText = randCode;
  
  // Format: WIFI:T:ADB;S:<service_name>;P:<pairing_code>;;
  const qrPayload = `WIFI:T:ADB;S:${servName};P:${randCode};;`;
  
  // 2. Generate QR Code via Electron IPC using QRCode npm library
  const qrDataUrl = await window.api.generateQR(qrPayload);
  
  if (qrDataUrl) {
    qrImage.src = qrDataUrl;
    qrLoading.style.display = 'none';
    qrImage.style.display = 'block';
    
    // Start mDNS listener to catch device pairing request
    startScanningMdns();
  } else {
    qrLoading.innerText = 'Error generating QR!';
  }
}

let qrScanTimeoutId = null;
let connectTimeoutId = null;

function startScanningMdns() {
  stopScanningMdns();
  
  isScanningQR = true;
  qrMdnsLog.innerHTML = `[System] Waiting for QR Code scan...\n[mDNS] Listening for pairing service: "${currentPairingService}" on the network...\n`;
  
  async function scanMdnsLoop() {
    if (!isScanningQR) return;
    
    try {
      // Scan mDNS using the local adb services command
      const res = await window.api.executeCommand('adb mdns services');
      if (!isScanningQR) return;
      
      if (res.success) {
        const lines = res.stdout.split('\n');
        for (let line of lines) {
          // e.g., "_adb_secure_pairing._tcp.    wpr-123456.   192.168.1.100:43211"
          if (line.includes('_adb_secure_pairing._tcp') && line.includes(currentPairingService)) {
            stopScanningMdns();
            
            qrMdnsLog.innerHTML += `\n[FOUND] Pairing device detected!\nDetails: ${line.trim()}\n`;
            
            // Extract IP & Port
            const match = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
            if (match) {
              const ipPort = match[0];
              performPairAndConnect(ipPort);
            } else {
              qrMdnsLog.innerHTML += `[Error] Cannot extract IP/Port from: ${line}\n`;
            }
            return;
          }
        }
      }
    } catch (err) {
      console.error('mDNS scan error:', err);
    }
    
    // Schedule next scan only after the current one has finished
    if (isScanningQR) {
      qrScanTimeoutId = setTimeout(scanMdnsLoop, 2500);
    }
  }
  
  scanMdnsLoop();
}

function stopScanningMdns() {
  isScanningQR = false;
  if (qrScanTimeoutId) {
    clearTimeout(qrScanTimeoutId);
    qrScanTimeoutId = null;
  }
}

async function performPairAndConnect(ipPort) {
  qrMdnsLog.innerHTML += `\n[ADB] Pairing...\n`;
  
  const pairRes = await executeStreamingCommand(`adb pair ${ipPort} ${currentPairingPassword}`, qrMdnsLog);
  
  if (pairRes.success || pairRes.stdout.includes('Successfully paired') || pairRes.stdout.includes('already paired')) {
    qrMdnsLog.innerHTML += `\n[SUCCESS] Pairing SUCCESSFUL!\n`;
    qrMdnsLog.innerHTML += `\n[ADB] Searching for connect port of device...\n`;
    
    // Now look for _adb_secure_connect._tcp to get the connect port
    let searchCount = 0;
    
    if (connectTimeoutId) {
      clearTimeout(connectTimeoutId);
      connectTimeoutId = null;
    }
    
    async function scanConnectLoop() {
      searchCount++;
      try {
        const mdnsRes = await window.api.executeCommand('adb mdns services');
        if (mdnsRes.success) {
          const lines = mdnsRes.stdout.split('\n');
          for (let line of lines) {
            // Identify connect service
            if (line.includes('_adb_secure_connect._tcp')) {
              const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
              if (ipMatch) {
                const connectIpPort = ipMatch[0];
                
                qrMdnsLog.innerHTML += `\n[FOUND] Detected connect port: ${connectIpPort}\n`;
                
                const connRes = await executeStreamingCommand(`adb connect ${connectIpPort}`, qrMdnsLog);
                if (connRes.success || connRes.stdout.includes('connected to')) {
                  const ipAddress = ipMatch[1];
                  qrMdnsLog.innerHTML += `\n[ADB] Connection successful. Switching permanent port to 5555 (tcpip 5555)...\n`;
                  
                  const tcpipRes = await executeStreamingCommand(`adb -s ${connectIpPort} tcpip 5555`, qrMdnsLog);
                  if (tcpipRes.success) {
                    qrMdnsLog.innerHTML += `\n[Wait] Waiting 2 seconds for phone to reconfigure network port...\n`;
                    await new Promise(r => setTimeout(r, 2000));
                    
                    qrMdnsLog.innerHTML += `\n[ADB] Connecting permanently to standard port 5555...\n`;
                    const finalConnRes = await executeStreamingCommand(`adb connect ${ipAddress}:5555`, qrMdnsLog);
                    
                    if (finalConnRes.success || finalConnRes.stdout.includes('connected to') || finalConnRes.stdout.includes('already connected')) {
                      qrMdnsLog.innerHTML += `\n🎉 PERMANENT WI-FI 5555 CONNECTION SUCCESSFUL!\n`;
                      saveConnectedIp(ipAddress);
                      refreshDevicesList();
                    } else {
                      qrMdnsLog.innerHTML += `\n[FAIL] Permanent port 5555 connection failed. Maintaining temporary connection on port ${connectIpPort}.\n`;
                      saveConnectedIp(ipAddress);
                      refreshDevicesList();
                    }
                  } else {
                    qrMdnsLog.innerHTML += `\n[WARNING] Cannot switch to port 5555. Maintaining temporary connection on port ${connectIpPort}.\n`;
                    saveConnectedIp(ipAddress);
                    refreshDevicesList();
                  }
                } else {
                  qrMdnsLog.innerHTML += `\n[FAIL] Connection error!\n`;
                }
                return;
              }
            }
          }
        }
      } catch (err) {
        console.error('mDNS connect scan error:', err);
      }
      
      if (searchCount > 10) {
        qrMdnsLog.innerHTML += `\n[WARNING] Could not automatically scan connect port.\nPlease use IP manual script or check IP:Port shown on phone to connect manually.\n`;
      } else {
        connectTimeoutId = setTimeout(scanConnectLoop, 2500);
      }
    }
    
    scanConnectLoop();
    
  } else {
    qrMdnsLog.innerHTML += `\n[FAIL] Pairing Failed!\n`;
  }
}

// Clean up scan when window is closed/navigated
window.addEventListener('beforeunload', stopScanningMdns);

// ==========================================
// 5. AUTO IP SCRIPT WIZARD (TAB 3)
// ==========================================
// Fill variable placeholders in description on input
function updateWizardPlaceholders() {
  const ip = wizIp.value || 'IP';
  const pPort = wizPairPort.value || 'Pair_Port';
  const pCode = wizPairCode.value || 'Code';
  const cPort = wizConnectPort.value || 'Connect_Port';
  
  document.querySelectorAll('.var-ip').forEach(el => el.innerText = ip);
  document.querySelectorAll('.var-pair-port').forEach(el => el.innerText = pPort);
  document.querySelectorAll('.var-pair-code').forEach(el => el.innerText = pCode);
  document.querySelectorAll('.var-connect-port').forEach(el => el.innerText = cPort);
}

[wizIp, wizPairPort, wizPairCode, wizConnectPort].forEach(input => {
  input.addEventListener('input', updateWizardPlaceholders);
});

// Set auto values on load based on typical local IPs to aid testing
window.api.executeCommand('ipconfig').then(res => {
  if (res.success) {
    const match = res.stdout.match(/IPv4 Address[\s.:]+(192\.168\.\d+)\.\d+/);
    if (match) {
      wizIp.value = match[1] + '.';
      updateWizardPlaceholders();
    }
  }
});

// Scan LAN networks for active IPs using ARP table
btnScanLan.addEventListener('click', async (e) => {
  e.preventDefault();
  btnScanLan.disabled = true;
  btnScanLan.innerText = '🔍 Scanning...';
  lanIpsList.innerHTML = '';
  lanDevicesContainer.style.display = 'block';
  
  // 1. Run arp -a to get local active IPs instantly from system ARP cache
  const arpRes = await window.api.executeCommand('arp -a');
  
  // 2. Find our own local IP to filter it out
  const ipconfigRes = await window.api.executeCommand('ipconfig');
  let localIp = '';
  if (ipconfigRes.success) {
    const match = ipconfigRes.stdout.match(/IPv4 Address[\s.:]+(192\.168\.\d+\.\d+)/);
    if (match) {
      localIp = match[1];
    }
  }
  
  const foundIps = new Set();
  
  if (arpRes.success) {
    const lines = arpRes.stdout.split('\n');
    for (let line of lines) {
      // Find matches for local class C IPv4 addresses
      const ipMatch = line.match(/(192\.168\.\d+\.\d+)/);
      if (ipMatch) {
        const ip = ipMatch[1];
        // Skip PC itself, router (.1) and broadcast (.255)
        if (ip !== localIp && !ip.endsWith('.255') && !ip.endsWith('.1')) {
          foundIps.add(ip);
        }
      }
    }
  }
  
  if (foundIps.size === 0) {
    lanIpsList.innerHTML = '<span style="font-size: 11px; color: #f43f5e; padding: 4px 0;">No other dynamic IPs detected. Make sure your phone has Wi-Fi enabled on the same network!</span>';
  } else {
    foundIps.forEach(ip => {
      const chip = document.createElement('button');
      chip.className = 'badge';
      chip.style.cursor = 'pointer';
      chip.style.margin = '2px';
      chip.style.border = '1px solid rgba(136, 19, 55, 0.35)';
      chip.style.backgroundColor = 'rgba(136, 19, 55, 0.03)';
      chip.style.color = 'var(--accent-color)';
      chip.style.fontFamily = 'var(--font-mono)';
      chip.innerText = ip;
      
      chip.addEventListener('click', (ev) => {
        ev.preventDefault();
        wizIp.value = ip;
        updateWizardPlaceholders();
        
        // Automatically copy the IP to the clipboard
        navigator.clipboard.writeText(ip);
        appendTerminalLine(`[System] Automatically copied IP ${ip} to clipboard!`, 'success-line');
        
        // Brief visual success animation
        chip.style.backgroundColor = 'var(--accent-success)';
        chip.style.color = '#000';
        chip.style.borderColor = 'var(--accent-success)';
        setTimeout(() => {
          chip.style.backgroundColor = 'rgba(136, 19, 55, 0.03)';
          chip.style.color = 'var(--accent-color)';
          chip.style.borderColor = 'var(--accent-color)';
        }, 1500);
      });
      
      lanIpsList.appendChild(chip);
    });
  }
  
  btnScanLan.disabled = false;
  btnScanLan.innerText = '🔍 LAN Scan';
});

// Scan active wireless debugging services via ADB mDNS auto-scanner
btnScanMdns.addEventListener('click', async (e) => {
  e.preventDefault();
  btnScanMdns.disabled = true;
  btnScanMdns.innerText = '📡 Scanning mDNS...';
  lanIpsList.innerHTML = '';
  lanScanTitle.innerText = 'mDNS Services Discovered (Click to auto-fill):';
  lanDevicesContainer.style.display = 'block';
  
  appendTerminalLine('[mDNS] Scanning for Android devices with Wireless Debugging enabled on the network...', 'system-line');
  
  const res = await window.api.executeCommand('adb mdns services');
  
  if (!res.success || res.stdout.trim() === '' || res.stdout.includes('No active services')) {
    lanIpsList.innerHTML = '<span style="font-size: 11px; color: #f43f5e; padding: 4px 0;">No active mDNS services found. Make sure Wireless Debugging is enabled on the phone!</span>';
    btnScanMdns.disabled = false;
    btnScanMdns.innerText = '📡 Auto Scan mDNS';
    return;
  }
  
  const lines = res.stdout.split('\n');
  let foundAny = false;
  
  const seenServices = new Set();
  
  for (let line of lines) {
    line = line.trim();
    if (!line) continue;
    
    // Check if it's pairing or connect service
    const isPairing = line.includes('_adb_secure_pairing._tcp');
    const isConnect = line.includes('_adb_secure_connect._tcp');
    
    if (isPairing || isConnect) {
      const match = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
      if (match) {
        const ip = match[1];
        const port = match[2];
        const uniqueKey = `${ip}:${port}:${isConnect}`;
        
        if (seenServices.has(uniqueKey)) continue;
        seenServices.add(uniqueKey);
        
        foundAny = true;
        const typeLabel = isConnect ? 'Connect Port' : 'Pair Port';
        
        const chip = document.createElement('button');
        chip.className = 'badge';
        chip.style.cursor = 'pointer';
        chip.style.margin = '4px';
        chip.style.padding = '8px 12px';
        chip.style.border = isConnect ? '1.5px solid var(--accent-color)' : '1px dashed var(--accent-muted)';
        chip.style.backgroundColor = isConnect ? 'rgba(136, 19, 55, 0.05)' : 'rgba(255, 255, 255, 0.05)';
        chip.style.color = '#fff';
        chip.style.fontFamily = 'var(--font-mono)';
        chip.style.display = 'inline-flex';
        chip.style.flexDirection = 'column';
        chip.style.alignItems = 'flex-start';
        chip.style.borderRadius = '8px';
        
        chip.innerHTML = `
          <strong style="color: var(--accent-color); font-size: 13.5px;">📱 ${ip}:${port}</strong>
          <span style="font-size: 10px; color: var(--text-muted); margin-top: 2px;">⚡ ${typeLabel}</span>
        `;
        
        chip.addEventListener('click', (ev) => {
          ev.preventDefault();
          wizIp.value = ip;
          if (isConnect) {
            wizConnectPort.value = port;
            appendTerminalLine(`[mDNS] Auto-filled IP: ${ip} and Connect Port: ${port}!`, 'success-line');
          } else {
            wizPairPort.value = port;
            appendTerminalLine(`[mDNS] Auto-filled IP: ${ip} and Pair Port: ${port}!`, 'success-line');
          }
          updateWizardPlaceholders();
          
          // Automatically copy to clipboard
          navigator.clipboard.writeText(`${ip}:${port}`);
          
          // Brief visual success animation
          chip.style.backgroundColor = 'var(--accent-success)';
          chip.style.borderColor = 'var(--accent-success)';
          setTimeout(() => {
            chip.style.backgroundColor = isConnect ? 'rgba(136, 19, 55, 0.05)' : 'rgba(255, 255, 255, 0.05)';
            chip.style.borderColor = isConnect ? 'var(--accent-color)' : 'var(--accent-muted)';
          }, 1500);
        });
        
        lanIpsList.appendChild(chip);
      }
    }
  }
  
  if (!foundAny) {
    lanIpsList.innerHTML = '<span style="font-size: 11px; color: #f43f5e; padding: 4px 0;">No wireless debugging services detected. Open the Wireless Debugging screen on your phone!</span>';
  }
  
  btnScanMdns.disabled = false;
  btnScanMdns.innerText = '📡 Auto Scan mDNS';
});

// Execute command and stream output directly to a log element in real-time
function executeStreamingCommand(command, logElement) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).substring(7);
    let stdoutData = '';
    let stderrData = '';
    
    logElement.innerHTML += `\n⚙️ <strong>Running:</strong> ${command}\n`;
    logElement.scrollTop = logElement.scrollHeight;
    
    const removeListener = window.api.onTerminalOutput(id, (payload) => {
      if (payload.type === 'stdout') {
        stdoutData += payload.data;
        // Clean output or style it slightly
        logElement.innerHTML += payload.data;
        logElement.scrollTop = logElement.scrollHeight;
      } else if (payload.type === 'stderr') {
        stderrData += payload.data;
        logElement.innerHTML += `<span style="color: #f43f5e">${payload.data}</span>`;
        logElement.scrollTop = logElement.scrollHeight;
      } else if (payload.type === 'exit') {
        removeListener();
        resolve({
          success: payload.code === 0 || stdoutData.includes('Successfully paired') || stdoutData.includes('connected to') || stdoutData.includes('already connected'),
          stdout: stdoutData,
          stderr: stderrData,
          code: payload.code
        });
      }
    });
    
    window.api.runTerminalCommand(command, id).then(res => {
      if (!res.success) {
        logElement.innerHTML += `<span style="color: #f43f5e">\n❌ Failed to execute command!</span>\n`;
        removeListener();
        resolve({ success: false, stdout: '', stderr: 'Failed to spawn', code: -1 });
      }
    });
  });
}

btnRunWizard.addEventListener('click', async () => {
  const ip = wizIp.value.trim();
  const pairPort = wizPairPort.value.trim();
  const pairCode = wizPairCode.value.trim();
  const connectPort = wizConnectPort.value.trim();

  // Validate inputs
  if (!ip) {
    alert('Please enter the device IP address!');
    wizIp.focus();
    return;
  }
  
  const hasPairInfo = pairPort && pairCode;
  const hasConnectPort = connectPort;
  
  if (!hasPairInfo && !hasConnectPort) {
    alert('Please enter required information:\n- Enter Pair Port & Pairing PIN to perform Pairing\n- OR Enter Connection Port to perform Connection');
    return;
  }

  btnRunWizard.disabled = true;
  btnRunWizard.innerText = '⚙️ Running script...';
  
  // Clear steps styles
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    stepEl.className = 'step-progress-item';
    stepEl.querySelector('.step-status').innerText = 'Waiting';
  }
  
  wizardLog.innerHTML = `[Start] Initiating Wi-Fi Debugging sequential connection script...\n`;
  
  try {
    // -------------------------------------------------------------
    // STEP 1: Restart ADB server
    // -------------------------------------------------------------
    setStepState(1, 'active', 'Running');
    wizardLog.innerHTML += `[Step 1] Restarting ADB server...\n`;
    
    await executeStreamingCommand('adb kill-server', wizardLog);
    const res1 = await executeStreamingCommand('adb start-server', wizardLog);
    
    if (res1.success) {
      setStepState(1, 'success', 'Success');
      wizardLog.innerHTML += `[Step 1] Clean ADB initialization.\n`;
    } else {
      setStepState(1, 'error', 'Failed');
      throw new Error('Could not start ADB server');
    }

    // Wait 1 second
    await new Promise(r => setTimeout(r, 1000));

    // -------------------------------------------------------------
    // STEP 2: ADB Pair
    // -------------------------------------------------------------
    if (hasPairInfo) {
      setStepState(2, 'active', 'Running');
      wizardLog.innerHTML += `[Step 2] Pairing device...\n`;
      
      const res2 = await executeStreamingCommand(`adb pair ${ip}:${pairPort} ${pairCode}`, wizardLog);
      
      if (res2.success || res2.stdout.includes('Successfully paired') || res2.stdout.includes('already paired')) {
        setStepState(2, 'success', 'Success');
        wizardLog.innerHTML += `[Step 2] Pairing SUCCESSFUL.\n`;
      } else {
        // Warning but non-blocking: The device might already be paired from a previous run!
        setStepState(2, 'success', 'Paired/Skipped');
        wizardLog.innerHTML += `[Step 2] Note: Pairing may have already succeeded or code expired. Proceeding to connect...\n`;
      }
      await new Promise(r => setTimeout(r, 1000));
    } else {
      setStepState(2, 'success', 'Skipped');
      wizardLog.innerHTML += `[Step 2] Skipping pairing step (direct connection info provided).\n`;
    }

    // -------------------------------------------------------------
    // STEP 3: ADB Connect (Dynamically allocated port)
    // -------------------------------------------------------------
    let cPort = connectPort;
    if (!cPort) {
      // Pause and prompt user in real-time to enter the Connect Port
      const userInput = prompt("🎉 Device pairing successful!\n\nNow close the pairing dialog on your phone to return to the main Wireless Debugging screen.\n\nEnter the 5-digit Connection Port shown there:");
      
      if (!userInput || userInput.trim() === '') {
        setStepState(3, 'error', 'Cancelled by user');
        throw new Error('You cancelled the connection script by not entering the Connection Port.');
      }
      
      cPort = userInput.trim();
      wizConnectPort.value = cPort; // Fill back into the input field
      updateWizardPlaceholders();
    }

    setStepState(3, 'active', 'Running');
    wizardLog.innerHTML += `[Step 3] Performing initial connection on port: ${cPort}...\n`;
    
    const res3 = await executeStreamingCommand(`adb connect ${ip}:${cPort}`, wizardLog);
    
    if (res3.success || res3.stdout.includes('connected to')) {
      setStepState(3, 'success', 'Success');
      wizardLog.innerHTML += `[Step 3] Initial connection SUCCESSFUL.\n`;
    } else {
      setStepState(3, 'error', 'Failed');
      throw new Error('Connection via connection port failed!');
    }

    await new Promise(r => setTimeout(r, 1000));

    // -------------------------------------------------------------
    // STEP 4: Switch to Port 5555
    // -------------------------------------------------------------
    setStepState(4, 'active', 'Running');
    wizardLog.innerHTML += `[Step 4] Switching to Wi-Fi port 5555...\n`;
    
    const res4 = await executeStreamingCommand(`adb -s ${ip}:${cPort} tcpip 5555`, wizardLog);
    
    if (res4.success) {
      setStepState(4, 'success', 'Success');
      wizardLog.innerHTML += `[Step 4] Phone configured to listen on port 5555.\n`;
    } else {
      setStepState(4, 'error', 'Failed');
      throw new Error('Could not switch device to tcpip port 5555!');
    }

    // Wait 2 seconds for device to re-register on port 5555
    wizardLog.innerHTML += `[Wait] Waiting 2 seconds for phone to reconfigure network port...\n`;
    await new Promise(r => setTimeout(r, 2000));

    // -------------------------------------------------------------
    // STEP 5: Final Reconnect to Port 5555
    // -------------------------------------------------------------
    setStepState(5, 'active', 'Running');
    wizardLog.innerHTML += `[Step 5] Connecting permanently to standard port 5555...\n`;
    
    const res5 = await executeStreamingCommand(`adb connect ${ip}:5555`, wizardLog);
    
    if (res5.success || res5.stdout.includes('connected to') || finalConnRes.stdout.includes('already connected')) {
      setStepState(5, 'success', 'Success');
      wizardLog.innerHTML += `\n🎉 PERMANENT WI-FI 5555 CONNECTION SCRIPT COMPLETED SUCCESSFULLY!\n`;
      wizardLog.innerHTML += `You can now connect via Wi-Fi on port 5555 without pairing again!\n`;
      
      // Save IP for auto connect
      saveConnectedIp(ip);
      
      // Auto refresh devices
      refreshDevicesList();
    } else {
      setStepState(5, 'error', 'Failed');
      throw new Error('Permanent connection to port 5555 failed!');
    }

  } catch (error) {
    wizardLog.innerHTML += `\n❌ SCRIPT ERROR: ${error.message}\n`;
  } finally {
    btnRunWizard.disabled = false;
    btnRunWizard.innerText = '🚀 Run Auto Connection Script';
    checkAdbStatus();
  }
});

function setStepState(stepNum, className, label) {
  const stepEl = document.getElementById(`step-${stepNum}`);
  if (stepEl) {
    stepEl.className = `step-progress-item ${className}`;
    stepEl.querySelector('.step-status').innerText = label;
  }
}

// ==========================================
// 6. INTERACTIVE TERMINAL (TAB 4)
// ==========================================
let terminalHistory = [];
let terminalHistoryIndex = -1;

terminalInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    runTerminalCommandFromInput();
  } else if (event.key === 'ArrowUp') {
    event.preventDefault();
    if (terminalHistory.length > 0 && terminalHistoryIndex < terminalHistory.length - 1) {
      terminalHistoryIndex++;
      terminalInput.value = terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
    }
  } else if (event.key === 'ArrowDown') {
    event.preventDefault();
    if (terminalHistoryIndex > 0) {
      terminalHistoryIndex--;
      terminalInput.value = terminalHistory[terminalHistory.length - 1 - terminalHistoryIndex];
    } else if (terminalHistoryIndex === 0) {
      terminalHistoryIndex = -1;
      terminalInput.value = '';
    }
  }
});

btnSendCmd.addEventListener('click', runTerminalCommandFromInput);

btnClearTerminal.addEventListener('click', () => {
  terminalScreen.innerHTML = '<div class="term-line system-line">[WprScrcpy] Console cleared.</div>';
});

// Run command entered in input
async function runTerminalCommandFromInput() {
  const rawCmd = terminalInput.value.trim();
  if (rawCmd === '') return;

  terminalHistory.push(rawCmd);
  terminalHistoryIndex = -1;

  terminalInput.value = '';
  executeShellCommand(rawCmd);
}

// Preset Snippets Buttons
snippetButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    const cmd = btn.getAttribute('data-cmd');
    executeShellCommand(cmd);
  });
});

async function executeShellCommand(command) {
  let processedCmd = command;
  
  // Auto-inject selected device ID for adb commands if one is selected and it is not a global adb command
  if (selectedDeviceId && command.trim().startsWith('adb') && !command.includes(' -s ')) {
    const trimmed = command.trim();
    const isGlobal = trimmed.includes('devices') || 
                     trimmed.includes('kill-server') || 
                     trimmed.includes('start-server') || 
                     trimmed.includes('mdns') || 
                     trimmed.includes('disconnect') || 
                     trimmed.includes('cleanup');
                     
    if (!isGlobal) {
      // Insert -s <selectedDeviceId> directly after 'adb'
      processedCmd = trimmed.replace(/^adb\b/, `adb -s ${selectedDeviceId}`);
    }
  }

    appendTerminalLine(processedCmd, 'input-line');

    const id = Math.random().toString(36).substring(7);
    let stdoutData = '';
    
    // Set up live listeners for output streaming
    const removeListener = window.api.onTerminalOutput(id, (payload) => {
      if (payload.type === 'stdout') {
        appendTerminalLine(payload.data, 'output-line');
        stdoutData += payload.data;
      } else if (payload.type === 'stderr') {
        appendTerminalLine(payload.data, 'error-line');
      } else if (payload.type === 'exit') {
        removeListener();
        // Scroll to bottom
        terminalScreen.scrollTop = terminalScreen.scrollHeight;
        
        // Save IP if adb connect succeeded
        if (processedCmd.trim().startsWith('adb connect')) {
          const match = processedCmd.match(/adb connect\s+([0-9.]+)/);
          if (match && (stdoutData.includes('connected to') || stdoutData.includes('already connected'))) {
            saveConnectedIp(match[1]);
          }
        }
        refreshDevicesList();
      }
    });

    const res = await window.api.runTerminalCommand(processedCmd, id);
    if (!res.success) {
      appendTerminalLine('Could not start subprocess!', 'error-line');
      removeListener();
    }
  }

  function appendTerminalLine(text, className) {
    // Create clean formatted line
    const line = document.createElement('div');
    line.className = `term-line ${className}`;
    line.innerText = text;
    
    terminalScreen.appendChild(line);
    
    // Scroll to bottom
    terminalScreen.scrollTop = terminalScreen.scrollHeight;
  }

  // Helper to write lines to Terminal console from system components
  function appendSystemLogToTerminal(text) {
    appendTerminalLine(`[System] ${text}`, 'system-line');
  }

  // Device-specific settings persistence
  function loadDeviceSettings(id) {
    if (!id) return;
    let saved = localStorage.getItem(`wpr_device_settings_${id}`);
    if (!saved) saved = localStorage.getItem(`aero_device_settings_${id}`);
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        if (settings.resolution !== undefined) scrcpyResolution.value = settings.resolution;
        if (settings.bitrate !== undefined) scrcpyBitrate.value = settings.bitrate;
        if (settings.fps !== undefined) scrcpyFps.value = settings.fps;
        if (settings.alwaysOnTop !== undefined) optAlwaysOnTop.checked = settings.alwaysOnTop;
        if (settings.stayAwake !== undefined) optStayAwake.checked = settings.stayAwake;
        if (settings.audioForward !== undefined) optAudioForward.checked = settings.audioForward;
        if (settings.showTouches !== undefined) optShowTouches.checked = settings.showTouches;
        if (settings.record !== undefined) optRecord.checked = settings.record;
        
        const optTurnScreenOff = document.getElementById('opt-turn-screen-off');
        if (optTurnScreenOff && settings.turnScreenOff !== undefined) {
          optTurnScreenOff.checked = settings.turnScreenOff;
        }
        
        const optAutoAudio = document.getElementById('opt-auto-audio-share');
        if (optAutoAudio) {
          optAutoAudio.checked = settings.autoAudioShare !== undefined ? settings.autoAudioShare : false;
        }
      } catch (e) {
        console.error('Error parsing device settings:', e);
      }
    } else {
      // Reset to defaults if no saved profile exists
      scrcpyResolution.value = "1080";
      scrcpyBitrate.value = "8000000";
      scrcpyFps.value = "60";
      optAlwaysOnTop.checked = true;
      optStayAwake.checked = true;
      optAudioForward.checked = false; // default to disabled as requested
      optShowTouches.checked = false;
      optRecord.checked = false;
      const optTurnScreenOff = document.getElementById('opt-turn-screen-off');
      if (optTurnScreenOff) optTurnScreenOff.checked = false;
      
      const optAutoAudio = document.getElementById('opt-auto-audio-share');
      if (optAutoAudio) optAutoAudio.checked = false;
    }

    // Load saved password specifically
    if (deviceSavedPassword) {
      deviceSavedPassword.value = localStorage.getItem(`wpr_device_password_${id}`) || localStorage.getItem(`aero_device_password_${id}`) || '';
    }

    // Update audio connection state in main process to synchronize the floating controller
    if (window.api && window.api.updateAudioState) {
      window.api.updateAudioState(optAudioForward.checked);
    }
  }

  function saveDeviceSettings(id) {
    if (!id) return;
    const optTurnScreenOff = document.getElementById('opt-turn-screen-off');
    const optAutoAudio = document.getElementById('opt-auto-audio-share');
    const settings = {
      resolution: scrcpyResolution.value,
      bitrate: scrcpyBitrate.value,
      fps: scrcpyFps.value,
      alwaysOnTop: optAlwaysOnTop.checked,
      stayAwake: optStayAwake.checked,
      audioForward: optAudioForward.checked,
      showTouches: optShowTouches.checked,
      record: optRecord.checked,
      turnScreenOff: optTurnScreenOff ? optTurnScreenOff.checked : false,
      autoAudioShare: optAutoAudio ? optAutoAudio.checked : false
    };
    localStorage.setItem(`wpr_device_settings_${id}`, JSON.stringify(settings));
  }

  // Automatically relaunch mirroring to apply audio/video settings dynamically
  async function relaunchScrcpy() {
    if (selectedDeviceId && isMirroringActive) {
      appendTerminalLine(`[System] Restarting mirror to apply new settings...`, 'system-line');
      // Terminate existing scrcpy instances
      await window.api.executeCommand('taskkill /F /IM scrcpy.exe');
      // Relaunch mirror after a brief delay
      setTimeout(() => {
        startScrcpyMirror(selectedDeviceId);
      }, 600);
    }
  }

  // Bind change listeners to save settings automatically on user interaction
  setTimeout(() => {
    const optTurnScreenOff = document.getElementById('opt-turn-screen-off');
    const optAutoAudio = document.getElementById('opt-auto-audio-share');
    [scrcpyResolution, scrcpyBitrate, scrcpyFps, optAlwaysOnTop, optStayAwake, optAudioForward, optShowTouches, optRecord, optTurnScreenOff, optAutoAudio].forEach(input => {
      if (input) {
        input.addEventListener('change', () => {
          if (selectedDeviceId) {
            saveDeviceSettings(selectedDeviceId);
          }
          // If audioForward changes, synchronize it with the main process / floating controller bar
          if (input === optAudioForward && window.api && window.api.updateAudioState) {
            window.api.updateAudioState(optAudioForward.checked);
            relaunchScrcpy(); // Hot-reload mirror on audio toggle
          }
        });
      }
    });

    // Listen to toggle events from the floating controller bar to update main checkbox and save settings
    if (window.api && window.api.onToggleAudioCheckbox) {
      window.api.onToggleAudioCheckbox((enabled) => {
        optAudioForward.checked = enabled;
        if (selectedDeviceId) {
          saveDeviceSettings(selectedDeviceId);
          relaunchScrcpy(); // Hot-reload mirror on audio toggle from floating bar!
        }
      });
    }

    // Save password on input
    if (deviceSavedPassword) {
      deviceSavedPassword.addEventListener('input', () => {
        if (selectedDeviceId) {
          localStorage.setItem(`wpr_device_password_${selectedDeviceId}`, deviceSavedPassword.value);
        }
      });
    }
  }, 1000);

  // Function to select active device in UI for quick control actions
  // Load settings specifically for this device
  function selectDevice(id, name) {
    selectedDeviceId = id;
    selectedDeviceName = name;
    
    // Inform the Electron main process of device selection for the floating bar
    if (window.api && window.api.setSelectedDevice) {
      window.api.setSelectedDevice(id);
    }
    
    // Load settings specifically for this device
    loadDeviceSettings(id);
    
    // Sync the terminal select dropdown value
    if (termSelectDevice) {
      termSelectDevice.value = id || '';
    }
    
    const label = document.getElementById('control-active-device-name');
    if (label) {
      label.innerText = name || id;
      label.style.borderColor = 'var(--accent-color)';
      label.style.color = 'var(--accent-color)';
    }
  }

  // Bind change event to Terminal device selector
  if (termSelectDevice) {
    termSelectDevice.addEventListener('change', () => {
      const val = termSelectDevice.value;
      const opt = termSelectDevice.options[termSelectDevice.selectedIndex];
      const text = opt ? opt.text : '';
      const name = val ? text.split(' (')[0] : '';
      selectDevice(val, name);
    });
  }

  // Device Controller Buttons Event Listeners
  const ctrlButtons = document.querySelectorAll('.ctrl-btn');
  const btnUnlock = document.getElementById('ctrl-btn-unlock');
  const btnScreenOff = document.getElementById('ctrl-btn-screen-off');
  const btnScreenshot = document.getElementById('ctrl-btn-screenshot');

  ctrlButtons.forEach(btn => {
    const key = btn.getAttribute('data-key');
    if (key) {
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        if (!selectedDeviceId) {
          alert('Please click to select a connected phone from the list on the left first!');
          return;
        }
        appendTerminalLine(`[Control] Sending key ${btn.innerText} (key: ${key}) to device ${selectedDeviceId}...`, 'info-line');
        await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input keyevent ${key}`);
      });
    }
  });

  if (btnUnlock) {
    btnUnlock.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!selectedDeviceId) {
        alert('Please select a device!');
        return;
      }
      appendTerminalLine(`[Control] Sending swipe up to unlock phone ${selectedDeviceId}...`, 'info-line');
      // Simulate a swipe gesture from bottom to middle of screen
      await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input swipe 500 1500 500 500 350`);
    });
  }

  if (btnScreenOff) {
    btnScreenOff.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!selectedDeviceId) {
        alert('Please select a device!');
        return;
      }
      appendTerminalLine(`[Control] Turning off physical screen of device ${selectedDeviceId} (mirror remains active)...`, 'info-line');
      // Keyevent 223 turns screen off (SLEEP)
      await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input keyevent 223`);
    });
  }

  if (btnScreenshot) {
    btnScreenshot.addEventListener('click', async (e) => {
      e.preventDefault();
      if (!selectedDeviceId) {
        alert('Please select a device!');
        return;
      }
      appendTerminalLine(`[Control] Taking screenshot on phone ${selectedDeviceId}...`, 'info-line');
      // Keyevent 120 snaps screenshot
      await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input keyevent 120`);
    });
  }

  // Auto-connect previously saved devices on startup
  async function autoConnectSavedDevices() {
    let saved = localStorage.getItem('wpr_saved_ips');
    if (!saved) saved = localStorage.getItem('aero_saved_ips');
    if (!saved || saved === '[]') {
      appendTerminalLine('[Auto] No previously connected devices found in history.', 'info-line');
      return;
    }
    
    try {
      const ipList = JSON.parse(saved);
      if (!Array.isArray(ipList) || ipList.length === 0) {
        appendTerminalLine('[Auto] No previously connected devices found in history.', 'info-line');
        return;
      }
      
      appendTerminalLine(`[Auto] Detected ${ipList.length} previously connected device(s) in history: ${ipList.join(', ')}. Reconnecting...`, 'info-line');
      
      for (const ip of ipList) {
        appendTerminalLine(`[Auto] Running: adb connect ${ip}:5555`, 'system-line');
        const res = await window.api.executeCommand(`adb connect ${ip}:5555`);
        if (res.success && (res.stdout.includes('connected to') || res.stdout.includes('already connected'))) {
          appendTerminalLine(`[Auto] Successfully reconnected to ${ip}:5555!`, 'success-line');
        } else {
          appendTerminalLine(`[Auto] Failed to reconnect to ${ip}:5555 (device may be offline or IP changed).`, 'error-line');
        }
      }
      // Refresh devices list after trying all reconnections
      refreshDevicesList();
    } catch (err) {
      console.error('Error auto-connecting:', err);
      appendTerminalLine(`[Auto] Error parsing saved devices history: ${err.message}`, 'error-line');
    }
  }

  // Function to save IP address
  function saveConnectedIp(ip) {
    if (!ip) return;
    try {
      let saved = localStorage.getItem('wpr_saved_ips');
      if (!saved) saved = localStorage.getItem('aero_saved_ips');
      let ipList = saved ? JSON.parse(saved) : [];
      if (!Array.isArray(ipList)) ipList = [];
      
      if (!ipList.includes(ip)) {
        ipList.push(ip);
        localStorage.setItem('wpr_saved_ips', JSON.stringify(ipList));
        appendTerminalLine(`[System] Saved IP ${ip} for auto-connection on next launch.`, 'success-line');
      }
    } catch (err) {
      console.error('Error saving IP:', err);
    }
  }

  // Setup Quick IP Commands Button Listeners
  const quickIpButtons = document.querySelectorAll('.quick-ip-btn');
  quickIpButtons.forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();
      const ip = wizIp.value.trim();
      if (!ip || ip === '192.168.1.' || ip.endsWith('.')) {
        alert('Please enter a valid phone IP address in the field above first!');
        wizIp.focus();
        return;
      }
      
      const connectPort = wizConnectPort.value.trim();
      const pairPort = wizPairPort.value.trim();
      const pairCode = wizPairCode.value.trim();
      
      const template = btn.getAttribute('data-template');
      
      if (template.includes('{connect_port}') && !connectPort) {
        alert('Please enter the Connection Port first!\n\nTip: You can use "mDNS Scan" to automatically discover and auto-fill the port.');
        wizConnectPort.focus();
        return;
      }
      
      if (template.includes('{pair_port}') && !pairPort) {
        alert('Please enter the Pair Port first!');
        wizPairPort.focus();
        return;
      }
      
      if (template.includes('{pair_code}') && !pairCode) {
        alert('Please enter the Pairing PIN first!');
        wizPairCode.focus();
        return;
      }
      
      const command = template.replace(/{ip}/g, ip)
                              .replace(/{connect_port}/g, connectPort)
                              .replace(/{pair_port}/g, pairPort)
                              .replace(/{pair_code}/g, pairCode);
      
      // Clear previous logs
      wizardLog.innerHTML = `[Start] Running quick command by IP...\n`;
      
      btn.disabled = true;
      const originalText = btn.innerText;
      btn.innerText = '⚙️ Running...';
      
      try {
        const res = await executeStreamingCommand(command, wizardLog);
        if (template.includes('connect') && (res.success || res.stdout.includes('connected to') || res.stdout.includes('already connected'))) {
          saveConnectedIp(ip);
        }
      } catch (err) {
        wizardLog.innerHTML += `\n❌ Error: ${err.message}\n`;
      } finally {
        btn.disabled = false;
        btn.innerText = originalText;
        refreshDevicesList();
        checkAdbStatus();
      }
    });
  });

// Bind click to toggle float controller panel
if (btnToggleFloatBar) {
  btnToggleFloatBar.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!isMirroringActive) {
      alert("Please start mirroring a device first before opening the overlay controller!");
      return;
    }
    if (window.api && window.api.toggleControllerWindow) {
      const res = await window.api.toggleControllerWindow();
      if (!res.success && res.error) {
        alert(res.error);
      }
    }
  });
}

// Listen to show password prompt event from main process/controller
if (window.api && window.api.onShowPasswordPrompt) {
  window.api.onShowPasswordPrompt(() => {
    if (selectedDeviceId) {
      const savedPass = localStorage.getItem(`wpr_device_password_${selectedDeviceId}`) || localStorage.getItem(`aero_device_password_${selectedDeviceId}`) || '';
      if (savedPass) {
        appendTerminalLine(`[Control] Auto-entering password to unlock...`, 'info-line');
        window.api.executeControllerKey('input-password:' + savedPass);
      } else {
        alert("You haven't saved a Phone Password / PIN!\n\nPlease select the device, enter the password in the PIN / Password field under Settings, then press F5 to auto-unlock.");
      }
    } else {
      alert("No device selected to unlock!");
    }
  });
}

// Listen to system output logs (e.g. inactivity battery-saving disconnects)
if (window.api && window.api.onTerminalOutputSystem) {
  window.api.onTerminalOutputSystem((payload) => {
    appendTerminalLine(payload.data, 'system-line');
  });
}

// Listen to mirror status changes from main process
if (window.api && window.api.onMirrorStatusChanged) {
  window.api.onMirrorStatusChanged((active) => {
    isMirroringActive = active;
    if (!active) {
      // Auto-stop Audio Share if option checked
      const optAutoAudio = document.getElementById('opt-auto-audio-share');
      if (optAutoAudio && optAutoAudio.checked) {
        stopAudioShare();
      }
    }
  });
}

// Listen to trigger-relaunch-mirror event to reconnect/relaunch mirroring
if (window.api && window.api.onTriggerRelaunchMirror) {
  window.api.onTriggerRelaunchMirror(() => {
    if (selectedDeviceId) {
      appendTerminalLine(`[System] Reconnecting / Relaunching mirror session to restore display...`, 'system-line');
      window.api.executeCommand('taskkill /F /IM scrcpy.exe').then(() => {
        setTimeout(() => {
          startScrcpyMirror(selectedDeviceId);
        }, 600);
      });
    }
  });
}

// Listen to mirror window bounds updates and save them to local storage
if (window.api && window.api.onScrcpyBoundsUpdated) {
  window.api.onScrcpyBoundsUpdated((bounds) => {
    if (bounds) {
      localStorage.setItem('wpr_mirror_bounds', JSON.stringify(bounds));
    }
  });
}


// Initial App Setup in sequential async order
async function initializeApp() {
  // Get and display version dynamically from package.json
  if (window.api && window.api.getAppVersion) {
    window.api.getAppVersion().then(ver => {
      const badge = document.getElementById('app-version');
      if (badge) badge.innerText = `v${ver}`;
      document.title = `WprScrcpy v${ver} - Mirror Overlay`;
    });
  }

  updateWizardPlaceholders();
  await checkAdbStatus();
  appendTerminalLine('[Auto] Checking previously connected devices...', 'system-line');
  await autoConnectSavedDevices();
  appendTerminalLine('[Auto] Scanning for currently active devices...', 'system-line');
  await refreshDevicesList();
  appendTerminalLine('[Auto] App initialization finished.', 'success-line');
}
initializeApp();

// ─── PC-to-Phone Audio Share Functions ───
let isAudioSharingActive = false;

async function startAudioShare() {
  const btnStart = document.getElementById('btn-start-audio-share');
  const badge = document.getElementById('audio-share-status');
  
  if (isAudioSharingActive) return;
  
  appendTerminalLine('[Audio Share] Starting AudioShareServer.exe on PC (minimized)...', 'system-line');
  if (btnStart) {
    btnStart.disabled = true;
    btnStart.innerText = 'Starting...';
  }
  
  // Launch server on PC (minimized mode)
  await window.api.executeCommand('powershell -Command "Start-Process -FilePath \'.\\AudioShareServer.exe\' -WindowStyle Minimized"');
  
  // Switch Windows audio output to Virtual Speakers (AudioRelay)
  appendTerminalLine('[Audio Share] Switching Windows playback device to "Virtual Speakers"...', 'system-line');
  await window.api.executeCommand('nircmd.exe setdefaultsounddevice "Virtual Speakers"');
  
  // Start client on target phone
  if (selectedDeviceId) {
    appendTerminalLine(`[Audio Share] Starting client app on target device: ${selectedDeviceId}`, 'system-line');
    await window.api.executeCommand(`adb -s ${selectedDeviceId} shell monkey -p io.github.mkckr0.audio_share_app -c android.intent.category.LAUNCHER 1`);
  } else {
    appendTerminalLine('[Audio Share] Info: No device selected. Start client app manually on your phone.', 'info-line');
  }
  
  isAudioSharingActive = true;
  if (btnStart) {
    btnStart.disabled = false;
    btnStart.innerText = '🔊 Start Audio';
  }
  if (badge) {
    badge.innerText = 'Active';
    badge.style.backgroundColor = 'rgba(16, 185, 129, 0.08)';
    badge.style.color = '#10b981';
    badge.style.borderColor = 'rgba(16, 185, 129, 0.15)';
  }
}

async function stopAudioShare() {
  const badge = document.getElementById('audio-share-status');
  
  appendTerminalLine('[Audio Share] Stopping audio stream...', 'system-line');
  
  // Close server on PC
  await window.api.executeCommand('taskkill /f /im AudioShareServer.exe');
  
  // Switch Windows audio output back to Speakers (USB Audio Device)
  appendTerminalLine('[Audio Share] Restoring Windows playback device to "Speakers (USB Audio Device)"...', 'system-line');
  await window.api.executeCommand('nircmd.exe setdefaultsounddevice \"Speakers (USB Audio Device)\"');
  
  // Force stop client on phone
  if (selectedDeviceId) {
    await window.api.executeCommand(`adb -s ${selectedDeviceId} shell am force-stop io.github.mkckr0.audio_share_app`);
  }
  
  isAudioSharingActive = false;
  if (badge) {
    badge.innerText = 'Stopped';
    badge.style.backgroundColor = 'rgba(136, 19, 55, 0.05)';
    badge.style.color = '#881337';
    badge.style.borderColor = 'rgba(136, 19, 55, 0.15)';
  }
}

// Bind Button Listeners
setTimeout(() => {
  const btnStartAudio = document.getElementById('btn-start-audio-share');
  const btnStopAudio = document.getElementById('btn-stop-audio-share');
  
  if (btnStartAudio) {
    btnStartAudio.addEventListener('click', (e) => {
      e.preventDefault();
      startAudioShare();
    });
  }
  if (btnStopAudio) {
    btnStopAudio.addEventListener('click', (e) => {
      e.preventDefault();
      stopAudioShare();
    });
  }
}, 1000);
