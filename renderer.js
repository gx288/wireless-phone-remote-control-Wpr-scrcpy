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

// --- Tab Details Map ---
const tabDetails = {
  'devices-tab': {
    title: 'Thiết Bị & Phản Chiếu',
    desc: 'Quản lý kết nối điện thoại và tùy chỉnh các thông số Scrcpy nâng cao'
  },
  'wifi-tab': {
    title: 'Kết Nối Không Dây (Wi-Fi Debugging)',
    desc: 'Thiết lập kết nối ADB không dây nhanh chóng qua Mã QR hoặc Địa chỉ IP'
  },
  'terminal-tab': {
    title: 'Terminal CMD',
    desc: 'Giao diện dòng lệnh tương tác trực tiếp với các tiến trình ADB và Shell hệ thống'
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
    adbStatusText.innerText = 'Đang chạy';
  } else {
    adbStatusDot.className = 'dot stopped';
    adbStatusText.innerText = 'Đã dừng';
  }
}

btnKillServer.addEventListener('click', async () => {
  appendTerminalLine('[Hệ Thống] Đang tắt ADB server...', 'system-line');
  const res = await window.api.executeCommand('adb kill-server');
  if (res.success) {
    appendTerminalLine('ADB Server đã tắt thành công.', 'success-line');
  } else {
    appendTerminalLine('Có lỗi xảy ra: ' + res.stderr, 'error-line');
  }
  checkAdbStatus();
  refreshDevicesList();
});

btnStartServer.addEventListener('click', async () => {
  appendTerminalLine('[Hệ Thống] Đang bật ADB server...', 'system-line');
  const res = await window.api.executeCommand('adb start-server');
  if (res.success) {
    appendTerminalLine('ADB Server đã bật thành công.', 'success-line');
  } else {
    appendTerminalLine('Có lỗi xảy ra: ' + res.stderr, 'error-line');
  }
  checkAdbStatus();
  refreshDevicesList();
});

// Periodically check ADB status
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
  btnRefreshDevices.innerText = '🔄 Đang tìm...';
  
  const res = await window.api.executeCommand('adb devices');
  devicesList.innerHTML = '';
  
  if (!res.success) {
    noDevicesMsg.style.display = 'flex';
    deviceCountBadge.innerText = '0 thiết bị';
    btnRefreshDevices.disabled = false;
    btnRefreshDevices.innerText = '🔄 Làm Mới Thiết Bị';
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
      
      parsedDevices.push({ id, status, model: 'Đang tải thông tin...' });
    }
  }
  
  devices = parsedDevices;
  
  if (devices.length === 0) {
    noDevicesMsg.style.display = 'flex';
    deviceCountBadge.innerText = '0 thiết bị';
  } else {
    noDevicesMsg.style.display = 'none';
    deviceCountBadge.innerText = `${devices.length} thiết bị`;
    
    // Render placeholders
    devices.forEach((dev, idx) => {
      renderDeviceItem(dev, idx);
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
          firstCard.style.border = '1px solid var(--accent-color)';
          firstCard.style.backgroundColor = 'rgba(56, 189, 248, 0.05)';
        }
      }, 1200);
    }
  }
  
  btnRefreshDevices.disabled = false;
  btnRefreshDevices.innerText = '🔄 Làm Mới Thiết Bị';
}

function renderDeviceItem(dev, index) {
  const isOnline = dev.status === 'device';
  const statusClass = isOnline ? 'online' : 'unauthorized';
  const statusLabel = isOnline ? 'Hoạt động' : dev.status;

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
    <div class="device-item-right">
      <button class="btn btn-primary btn-glow" id="btn-mirror-${index}" ${!isOnline ? 'disabled' : ''}>
        ⚡ Phản Chiếu
      </button>
    </div>
  `;
  
  devicesList.appendChild(item);
  
  // Highlight card and select device on click
  item.style.cursor = 'pointer';
  item.addEventListener('click', (e) => {
    if (e.target.id && e.target.id.startsWith('btn-mirror')) return;
    selectDevice(dev.id, dev.model);
    
    // Update active highlight style
    document.querySelectorAll('.device-item').forEach(el => {
      el.style.border = '1px solid var(--glass-border)';
      el.style.backgroundColor = 'rgba(30, 41, 59, 0.4)';
    });
    item.style.border = '1px solid var(--accent-color)';
    item.style.backgroundColor = 'rgba(56, 189, 248, 0.05)';
  });
  
  const mirrorBtn = item.querySelector(`#btn-mirror-${index}`);
  mirrorBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Avoid triggering card selection click
    startScrcpyMirror(dev.id);
  });
}

async function fetchDeviceModel(id, index) {
  const modelRes = await window.api.executeCommand(`adb -s ${id} shell getprop ro.product.model`);
  const brandRes = await window.api.executeCommand(`adb -s ${id} shell getprop ro.product.brand`);
  
  let modelName = 'Thiết bị Android';
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
}

// Start Scrcpy Command Builder
async function startScrcpyMirror(deviceId) {
  // Ensure we select the device so activeDeviceId is updated in main.js and floating bar knows it
  selectDevice(deviceId, selectedDeviceName || deviceId);

  const args = ['-s', deviceId, '--window-title', 'DeviceMirrorSession', '--no-mouse-hover'];
  
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
    appendTerminalLine(`[Scrcpy] Đang ghi hình phản chiếu vào file: ${filename}`, 'system-line');
  }
  
  appendTerminalLine(`[Scrcpy] Khởi chạy phản chiếu thiết bị: ${deviceId} với tham số: ${args.join(' ')}`, 'system-line');
  
  const mirrorRes = await window.api.startScrcpy(args);
  if (mirrorRes.success) {
    isMirroringActive = true;
    appendTerminalLine(`Đã mở cửa sổ phản chiếu cho thiết bị ${deviceId}`, 'success-line');
    // Automatically launch the floating controller bar after a brief delay to sit strictly on top of scrcpy window
    setTimeout(() => {
      if (window.api && window.api.toggleControllerWindow) {
        window.api.toggleControllerWindow(true);
      }
    }, 1500);
  } else {
    appendTerminalLine(`Lỗi khởi chạy phản chiếu: ${mirrorRes.error}`, 'error-line');
  }
}

// ==========================================
// 4. WI-FI DEBUGGING QR CODE PAIRING (TAB 2)
// ==========================================
btnRegenerateQr.addEventListener('click', generateWirelessQR);

// Send intent to phone via ADB to open Wireless Debugging settings directly
async function openWirelessSettingsOnPhone() {
  appendTerminalLine('[Hệ Thống] Đang gửi tín hiệu yêu cầu mở màn hình Gỡ Lỗi Không Dây trên điện thoại...', 'system-line');
  const res = await window.api.executeCommand('adb shell am start -a android.settings.WIRELESS_DEBUGGING_SETTINGS');
  
  if (res.success && !res.stderr.includes('Error') && !res.stdout.includes('Error')) {
    appendTerminalLine('Đã kích hoạt mở màn hình Gỡ Lỗi Không Dây thành công trên điện thoại của bạn!', 'success-line');
  } else {
    appendTerminalLine('Không thể mở màn hình cài đặt trên điện thoại. Vui lòng đảm bảo đã cắm cáp USB ban đầu!', 'error-line');
    alert('Không thể mở màn hình cài đặt trên điện thoại!\n\nBạn vui lòng đảm bảo điện thoại đang được cắm cáp USB vào máy tính để ứng dụng có thể truyền tín hiệu ban đầu này sang điện thoại của bạn nhé!');
  }
}

if (btnOpenSettingsQr) btnOpenSettingsQr.addEventListener('click', openWirelessSettingsOnPhone);

async function generateWirelessQR() {
  qrLoading.style.display = 'block';
  qrImage.style.display = 'none';
  
  // 1. Create random service and pairing code
  const randCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6 digits
  const randSuffix = Math.floor(100000 + Math.random() * 900000).toString();
  const servName = `aero-${randSuffix}`;
  
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
    qrLoading.innerText = 'Lỗi tạo QR!';
  }
}

function startScanningMdns() {
  if (isScanningQR) {
    stopScanningMdns();
  }
  
  isScanningQR = true;
  qrMdnsLog.innerHTML = `[System] Đang chờ bạn quét QR Code...\n[mDNS] Đang lắng nghe dịch vụ ghép nối: "${currentPairingService}" trên mạng...\n`;
  
  qrScanIntervalId = setInterval(async () => {
    if (!isScanningQR) return;
    
    // Scan mDNS using the local adb services command
    const res = await window.api.executeCommand('adb mdns services');
    if (!res.success) return;
    
    const lines = res.stdout.split('\n');
    for (let line of lines) {
      // e.g., "_adb_secure_pairing._tcp.    aero-123456.   192.168.1.100:43211"
      if (line.includes('_adb_secure_pairing._tcp') && line.includes(currentPairingService)) {
        stopScanningMdns();
        
        qrMdnsLog.innerHTML += `\n[FOUND] Phát hiện thiết bị ghép nối!\nChi tiết: ${line.trim()}\n`;
        
        // Extract IP & Port
        const match = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
        if (match) {
          const ipPort = match[0];
          performPairAndConnect(ipPort);
        } else {
          qrMdnsLog.innerHTML += `[Error] Không thể giải mã IP/Port từ: ${line}\n`;
        }
        break;
      }
    }
  }, 2000);
}

function stopScanningMdns() {
  isScanningQR = false;
  if (qrScanIntervalId) {
    clearInterval(qrScanIntervalId);
    qrScanIntervalId = null;
  }
}

async function performPairAndConnect(ipPort) {
  qrMdnsLog.innerHTML += `\n[ADB] Tiến hành ghép nối...\n`;
  
  const pairRes = await executeStreamingCommand(`adb pair ${ipPort} ${currentPairingPassword}`, qrMdnsLog);
  
  if (pairRes.success || pairRes.stdout.includes('Successfully paired') || pairRes.stdout.includes('already paired')) {
    qrMdnsLog.innerHTML += `\n[SUCCESS] Ghép nối THÀNH CÔNG!\n`;
    qrMdnsLog.innerHTML += `\n[ADB] Đang tìm kiếm cổng kết nối (Connect Port) của thiết bị...\n`;
    
    // Now look for _adb_secure_connect._tcp to get the connect port
    let searchCount = 0;
    const connectInterval = setInterval(async () => {
      searchCount++;
      const mdnsRes = await window.api.executeCommand('adb mdns services');
      if (mdnsRes.success) {
        const lines = mdnsRes.stdout.split('\n');
        for (let line of lines) {
          // Identify connect service
          if (line.includes('_adb_secure_connect._tcp')) {
            const ipMatch = line.match(/(\d+\.\d+\.\d+\.\d+):(\d+)/);
            if (ipMatch) {
              clearInterval(connectInterval);
              const connectIpPort = ipMatch[0];
              
              qrMdnsLog.innerHTML += `\n[FOUND] Phát hiện cổng kết nối: ${connectIpPort}\n`;
              
              const connRes = await executeStreamingCommand(`adb connect ${connectIpPort}`, qrMdnsLog);
              if (connRes.success || connRes.stdout.includes('connected to')) {
                const ipAddress = ipMatch[1];
                qrMdnsLog.innerHTML += `\n[ADB] Kết nối ban đầu thành công. Đang chuyển đổi cổng cố định sang 5555 (tcpip 5555)...\n`;
                
                const tcpipRes = await executeStreamingCommand(`adb tcpip 5555`, qrMdnsLog);
                if (tcpipRes.success) {
                  qrMdnsLog.innerHTML += `\n[Chờ] Chờ 2 giây để điện thoại cấu hình lại cổng mạng...\n`;
                  await new Promise(r => setTimeout(r, 2000));
                  
                  qrMdnsLog.innerHTML += `\n[ADB] Thực hiện kết nối vĩnh viễn đến cổng chuẩn 5555...\n`;
                  const finalConnRes = await executeStreamingCommand(`adb connect ${ipAddress}:5555`, qrMdnsLog);
                  
                  if (finalConnRes.success || finalConnRes.stdout.includes('connected to') || finalConnRes.stdout.includes('already connected')) {
                    qrMdnsLog.innerHTML += `\n🎉 KẾT NỐI WIFI 5555 VĨNH VIỄN THÀNH CÔNG!\n`;
                    saveConnectedIp(ipAddress);
                    refreshDevicesList();
                  } else {
                    qrMdnsLog.innerHTML += `\n[FAIL] Kết nối vĩnh viễn cổng 5555 thất bại. Đang giữ kết nối tạm thời ở cổng ${connectIpPort}.\n`;
                    saveConnectedIp(ipAddress);
                    refreshDevicesList();
                  }
                } else {
                  qrMdnsLog.innerHTML += `\n[WARNING] Không thể chuyển sang cổng 5555. Đang giữ kết nối tạm thời ở cổng ${connectIpPort}.\n`;
                  saveConnectedIp(ipAddress);
                  refreshDevicesList();
                }
              } else {
                qrMdnsLog.innerHTML += `\n[FAIL] Kết nối lỗi!\n`;
              }
              return;
            }
          }
        }
      }
      
      if (searchCount > 10) {
        clearInterval(connectInterval);
        qrMdnsLog.innerHTML += `\n[WARNING] Không tự động quét được cổng kết nối.\nHãy vào kịch bản IP hoặc xem IP:Port trên đt để tự connect.\n`;
      }
    }, 2000);
    
  } else {
    qrMdnsLog.innerHTML += `\n[FAIL] Ghép nối Thất Bại!\n`;
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
  btnScanLan.innerText = '🔍 Đang Quét...';
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
    lanIpsList.innerHTML = '<span style="font-size: 11px; color: #f43f5e; padding: 4px 0;">Không phát hiện thấy IP động nào khác. Hãy đảm bảo điện thoại đang bật Wifi cùng mạng!</span>';
  } else {
    foundIps.forEach(ip => {
      const chip = document.createElement('button');
      chip.className = 'badge';
      chip.style.cursor = 'pointer';
      chip.style.margin = '2px';
      chip.style.border = '1px solid var(--accent-color)';
      chip.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
      chip.style.color = 'var(--accent-color)';
      chip.style.fontFamily = 'var(--font-mono)';
      chip.innerText = ip;
      
      chip.addEventListener('click', (ev) => {
        ev.preventDefault();
        wizIp.value = ip;
        updateWizardPlaceholders();
        
        // Automatically copy the IP to the clipboard
        navigator.clipboard.writeText(ip);
        appendTerminalLine(`[Hệ Thống] Đã tự động sao chép IP ${ip} vào Clipboard!`, 'success-line');
        
        // Brief visual success animation
        chip.style.backgroundColor = 'var(--accent-success)';
        chip.style.color = '#000';
        chip.style.borderColor = 'var(--accent-success)';
        setTimeout(() => {
          chip.style.backgroundColor = 'rgba(56, 189, 248, 0.08)';
          chip.style.color = 'var(--accent-color)';
          chip.style.borderColor = 'var(--accent-color)';
        }, 1500);
      });
      
      lanIpsList.appendChild(chip);
    });
  }
  
  btnScanLan.disabled = false;
  btnScanLan.innerText = '🔍 Quét LAN';
});

// Scan active wireless debugging services via ADB mDNS auto-scanner
btnScanMdns.addEventListener('click', async (e) => {
  e.preventDefault();
  btnScanMdns.disabled = true;
  btnScanMdns.innerText = '📡 Đang Dò mDNS...';
  lanIpsList.innerHTML = '';
  lanScanTitle.innerText = 'Dịch vụ mDNS phát hiện (Click để tự động điền toàn bộ):';
  lanDevicesContainer.style.display = 'block';
  
  appendTerminalLine('[mDNS] Đang thực hiện dò quét các thiết bị Android bật Wireless Debugging trong mạng...', 'system-line');
  
  const res = await window.api.executeCommand('adb mdns services');
  
  if (!res.success || res.stdout.trim() === '' || res.stdout.includes('No active services')) {
    lanIpsList.innerHTML = '<span style="font-size: 11px; color: #f43f5e; padding: 4px 0;">Không tìm thấy dịch vụ mDNS nào đang hoạt động. Hãy đảm bảo Gỡ lỗi không dây đang bật trên điện thoại!</span>';
    btnScanMdns.disabled = false;
    btnScanMdns.innerText = '📡 Dò Quét mDNS (Tự Động)';
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
        const typeLabel = isConnect ? 'Cổng Kết Nối (Connect)' : 'Cổng Ghép Nối (Pair)';
        
        const chip = document.createElement('button');
        chip.className = 'badge';
        chip.style.cursor = 'pointer';
        chip.style.margin = '4px';
        chip.style.padding = '8px 12px';
        chip.style.border = isConnect ? '1.5px solid var(--accent-color)' : '1px dashed var(--accent-muted)';
        chip.style.backgroundColor = isConnect ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)';
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
            appendTerminalLine(`[mDNS] Đã tự động điền IP: ${ip} và Cổng Kết Nối (Connect Port): ${port}!`, 'success-line');
          } else {
            wizPairPort.value = port;
            appendTerminalLine(`[mDNS] Đã tự động điền IP: ${ip} và Cổng Ghép Nối (Pair Port): ${port}!`, 'success-line');
          }
          updateWizardPlaceholders();
          
          // Automatically copy to clipboard
          navigator.clipboard.writeText(`${ip}:${port}`);
          
          // Brief visual success animation
          chip.style.backgroundColor = 'var(--accent-success)';
          chip.style.borderColor = 'var(--accent-success)';
          setTimeout(() => {
            chip.style.backgroundColor = isConnect ? 'rgba(56, 189, 248, 0.15)' : 'rgba(255, 255, 255, 0.05)';
            chip.style.borderColor = isConnect ? 'var(--accent-color)' : 'var(--accent-muted)';
          }, 1500);
        });
        
        lanIpsList.appendChild(chip);
      }
    }
  }
  
  if (!foundAny) {
    lanIpsList.innerHTML = '<span style="font-size: 11px; color: #f43f5e; padding: 4px 0;">Không phát hiện thấy dịch vụ Gỡ lỗi không dây nào. Hãy mở màn hình Wireless Debugging trên điện thoại!</span>';
  }
  
  btnScanMdns.disabled = false;
  btnScanMdns.innerText = '📡 Dò Quét mDNS (Tự Động)';
});

// Execute command and stream output directly to a log element in real-time
function executeStreamingCommand(command, logElement) {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).substring(7);
    let stdoutData = '';
    let stderrData = '';
    
    logElement.innerHTML += `\n⚙️ <strong>Chạy:</strong> ${command}\n`;
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
        logElement.innerHTML += `<span style="color: #f43f5e">\n❌ Lỗi khởi chạy lệnh!</span>\n`;
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
    alert('Vui lòng nhập địa chỉ IP thiết bị!');
    wizIp.focus();
    return;
  }
  
  const hasPairInfo = pairPort && pairCode;
  const hasConnectPort = connectPort;
  
  if (!hasPairInfo && !hasConnectPort) {
    alert('Vui lòng điền thông tin để chạy:\n- Điền Cổng Ghép Nối & Mã Ghép Nối để thực hiện Ghép Nối (Pair)\n- HOẶC Điền Cổng Kết Nối để thực hiện Kết Nối (Connect)');
    return;
  }

  btnRunWizard.disabled = true;
  btnRunWizard.innerText = '⚙️ Đang chạy kịch bản...';
  
  // Clear steps styles
  for (let i = 1; i <= 5; i++) {
    const stepEl = document.getElementById(`step-${i}`);
    stepEl.className = 'step-progress-item';
    stepEl.querySelector('.step-status').innerText = 'Đang chờ';
  }
  
  wizardLog.innerHTML = `[Bắt đầu] Khởi động kịch bản kết nối WiFi Debugging tuần tự...\n`;
  
  try {
    // -------------------------------------------------------------
    // STEP 1: Restart ADB server
    // -------------------------------------------------------------
    setStepState(1, 'active', 'Đang chạy');
    wizardLog.innerHTML += `[Bước 1] Khởi động lại máy chủ ADB...\n`;
    
    await executeStreamingCommand('adb kill-server', wizardLog);
    const res1 = await executeStreamingCommand('adb start-server', wizardLog);
    
    if (res1.success) {
      setStepState(1, 'success', 'Thành công');
      wizardLog.innerHTML += `[Bước 1] Khởi tạo ADB sạch sẽ.\n`;
    } else {
      setStepState(1, 'error', 'Thất bại');
      throw new Error('Không thể khởi chạy máy chủ ADB');
    }

    // Wait 1 second
    await new Promise(r => setTimeout(r, 1000));

    // -------------------------------------------------------------
    // STEP 2: ADB Pair
    // -------------------------------------------------------------
    if (hasPairInfo) {
      setStepState(2, 'active', 'Đang chạy');
      wizardLog.innerHTML += `[Bước 2] Tiến hành ghép nối thiết bị...\n`;
      
      const res2 = await executeStreamingCommand(`adb pair ${ip}:${pairPort} ${pairCode}`, wizardLog);
      
      if (res2.success || res2.stdout.includes('Successfully paired') || res2.stdout.includes('already paired')) {
        setStepState(2, 'success', 'Thành công');
        wizardLog.innerHTML += `[Bước 2] Ghép nối THÀNH CÔNG.\n`;
      } else {
        // Warning but non-blocking: The device might already be paired from a previous run!
        setStepState(2, 'success', 'Đã Pair/Bỏ Qua');
        wizardLog.innerHTML += `[Bước 2] Lưu ý: Ghép nối có thể đã thành công từ trước hoặc mã bị hết hạn. Tiếp tục bước kết nối...\n`;
      }
      await new Promise(r => setTimeout(r, 1000));
    } else {
      setStepState(2, 'success', 'Bỏ qua');
      wizardLog.innerHTML += `[Bước 2] Bỏ qua bước Ghép Nối (Đã có thông tin kết nối trực tiếp).\n`;
    }

    // -------------------------------------------------------------
    // STEP 3: ADB Connect (Dynamically allocated port)
    // -------------------------------------------------------------
    let cPort = connectPort;
    if (!cPort) {
      // Pause and prompt user in real-time to enter the Connect Port
      const userInput = prompt("🎉 Ghép nối (Pair) thiết bị thành công!\n\nBây giờ hãy tắt hộp thoại ghép nối trên điện thoại để quay lại màn hình Gỡ lỗi không dây chính.\n\nHãy nhập Cổng Kết Nối (Connect Port) gồm 5 chữ số đang hiển thị tại đó:");
      
      if (!userInput || userInput.trim() === '') {
        setStepState(3, 'error', 'Hủy bởi người dùng');
        throw new Error('Bạn đã hủy kịch bản kết nối do chưa nhập Cổng Kết Nối (Connect Port).');
      }
      
      cPort = userInput.trim();
      wizConnectPort.value = cPort; // Fill back into the input field
      updateWizardPlaceholders();
    }

    setStepState(3, 'active', 'Đang chạy');
    wizardLog.innerHTML += `[Bước 3] Thực hiện kết nối ban đầu qua cổng: ${cPort}...\n`;
    
    const res3 = await executeStreamingCommand(`adb connect ${ip}:${cPort}`, wizardLog);
    
    if (res3.success || res3.stdout.includes('connected to')) {
      setStepState(3, 'success', 'Thành công');
      wizardLog.innerHTML += `[Bước 3] Kết nối ban đầu THÀNH CÔNG.\n`;
    } else {
      setStepState(3, 'error', 'Thất bại');
      throw new Error('Kết nối thiết bị qua cổng kết nối thất bại!');
    }

    await new Promise(r => setTimeout(r, 1000));

    // -------------------------------------------------------------
    // STEP 4: Switch to Port 5555
    // -------------------------------------------------------------
    setStepState(4, 'active', 'Đang chạy');
    wizardLog.innerHTML += `[Bước 4] Chuyển đổi sang cổng WiFi 5555...\n`;
    
    const res4 = await executeStreamingCommand(`adb tcpip 5555`, wizardLog);
    
    if (res4.success) {
      setStepState(4, 'success', 'Thành công');
      wizardLog.innerHTML += `[Bước 4] Đã chuyển đổi điện thoại sang lắng nghe trên cổng 5555.\n`;
    } else {
      setStepState(4, 'error', 'Thất bại');
      throw new Error('Không thể chuyển đổi thiết bị sang chế độ tcpip 5555!');
    }

    // Wait 2 seconds for device to re-register on port 5555
    wizardLog.innerHTML += `[Chờ] Chờ 2 giây để điện thoại cấu hình lại cổng mạng...\n`;
    await new Promise(r => setTimeout(r, 2000));

    // -------------------------------------------------------------
    // STEP 5: Final Reconnect to Port 5555
    // -------------------------------------------------------------
    setStepState(5, 'active', 'Đang chạy');
    wizardLog.innerHTML += `[Bước 5] Thực hiện kết nối cố định trên cổng chuẩn 5555...\n`;
    
    const res5 = await executeStreamingCommand(`adb connect ${ip}:5555`, wizardLog);
    
    if (res5.success || res5.stdout.includes('connected to') || res5.stdout.includes('already connected')) {
      setStepState(5, 'success', 'Thành công');
      wizardLog.innerHTML += `\n🎉 KỊCH BẢN KẾT NỐI WIFI 5555 HOÀN TẤT THÀNH CÔNG VÀ VĨNH VIỄN!\n`;
      wizardLog.innerHTML += `Bây giờ bạn có thể kết nối WiFi thoải mái ở cổng 5555 không cần Pair nữa!\n`;
      
      // Save IP for auto connect
      saveConnectedIp(ip);
      
      // Auto refresh devices
      refreshDevicesList();
    } else {
      setStepState(5, 'error', 'Thất bại');
      throw new Error('Kết nối cố định đến cổng 5555 thất bại!');
    }

  } catch (error) {
    wizardLog.innerHTML += `\n❌ LỖI KỊCH BẢN: ${error.message}\n`;
  } finally {
    btnRunWizard.disabled = false;
    btnRunWizard.innerText = '🚀 Chạy Kịch Bản Kết Nối Tự Động';
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
terminalInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    runTerminalCommandFromInput();
  }
});

btnSendCmd.addEventListener('click', runTerminalCommandFromInput);

btnClearTerminal.addEventListener('click', () => {
  terminalScreen.innerHTML = '<div class="term-line system-line">[AeroScrcpy] Màn hình dòng lệnh đã được làm sạch.</div>';
});

// Run command entered in input
async function runTerminalCommandFromInput() {
  const rawCmd = terminalInput.value.trim();
  if (rawCmd === '') return;

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
  
  // Set up live listeners for output streaming
  const removeListener = window.api.onTerminalOutput(id, (payload) => {
    if (payload.type === 'stdout') {
      appendTerminalLine(payload.data, 'output-line');
    } else if (payload.type === 'stderr') {
      appendTerminalLine(payload.data, 'error-line');
    } else if (payload.type === 'exit') {
      removeListener();
      // Scroll to bottom
      terminalScreen.scrollTop = terminalScreen.scrollHeight;
    }
  });

  const res = await window.api.runTerminalCommand(processedCmd, id);
  if (!res.success) {
    appendTerminalLine('Không thể chạy tiến trình phụ!', 'error-line');
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
  const saved = localStorage.getItem(`aero_device_settings_${id}`);
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
  }

  // Load saved password specifically
  if (deviceSavedPassword) {
    deviceSavedPassword.value = localStorage.getItem(`aero_device_password_${id}`) || '';
  }

  // Update audio connection state in main process to synchronize the floating controller
  if (window.api && window.api.updateAudioState) {
    window.api.updateAudioState(optAudioForward.checked);
  }
}

function saveDeviceSettings(id) {
  if (!id) return;
  const optTurnScreenOff = document.getElementById('opt-turn-screen-off');
  const settings = {
    resolution: scrcpyResolution.value,
    bitrate: scrcpyBitrate.value,
    fps: scrcpyFps.value,
    alwaysOnTop: optAlwaysOnTop.checked,
    stayAwake: optStayAwake.checked,
    audioForward: optAudioForward.checked,
    showTouches: optShowTouches.checked,
    record: optRecord.checked,
    turnScreenOff: optTurnScreenOff ? optTurnScreenOff.checked : false
  };
  localStorage.setItem(`aero_device_settings_${id}`, JSON.stringify(settings));
}

// Automatically relaunch mirroring to apply audio/video settings dynamically
async function relaunchScrcpy() {
  if (selectedDeviceId && isMirroringActive) {
    appendTerminalLine(`[Hệ Thống] Đang khởi động lại phản chiếu để áp dụng cài đặt mới...`, 'system-line');
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
  [scrcpyResolution, scrcpyBitrate, scrcpyFps, optAlwaysOnTop, optStayAwake, optAudioForward, optShowTouches, optRecord, optTurnScreenOff].forEach(input => {
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
        localStorage.setItem(`aero_device_password_${selectedDeviceId}`, deviceSavedPassword.value);
      }
    });
  }
}, 1000);

// Function to select active device in UI for quick control actions
function selectDevice(id, name) {
  selectedDeviceId = id;
  selectedDeviceName = name;
  
  // Inform the Electron main process of device selection for the floating bar
  if (window.api && window.api.setSelectedDevice) {
    window.api.setSelectedDevice(id);
  }
  
  // Load settings specifically for this device
  loadDeviceSettings(id);
  
  const label = document.getElementById('control-active-device-name');
  if (label) {
    label.innerText = name || id;
    label.style.borderColor = 'var(--accent-color)';
    label.style.color = 'var(--accent-color)';
  }
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
        alert('Vui lòng click chọn 1 điện thoại kết nối ở danh sách bên trái trước!');
        return;
      }
      appendTerminalLine(`[Điều Khiển] Gửi phím ${btn.innerText} (key: ${key}) đến thiết bị ${selectedDeviceId}...`, 'info-line');
      await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input keyevent ${key}`);
    });
  }
});

if (btnUnlock) {
  btnUnlock.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      alert('Vui lòng chọn 1 thiết bị!');
      return;
    }
    appendTerminalLine(`[Điều Khiển] Gửi thao tác vuốt lên để mở khóa điện thoại ${selectedDeviceId}...`, 'info-line');
    // Simulate a swipe gesture from bottom to middle of screen
    await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input swipe 500 1500 500 500 350`);
  });
}

if (btnScreenOff) {
  btnScreenOff.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      alert('Vui lòng chọn 1 thiết bị!');
      return;
    }
    appendTerminalLine(`[Điều Khiển] Tắt màn hình vật lý điện thoại ${selectedDeviceId} (Mirror vẫn hoạt động)...`, 'info-line');
    // Keyevent 223 turns screen off (SLEEP)
    await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input keyevent 223`);
  });
}

if (btnScreenshot) {
  btnScreenshot.addEventListener('click', async (e) => {
    e.preventDefault();
    if (!selectedDeviceId) {
      alert('Vui lòng chọn 1 thiết bị!');
      return;
    }
    appendTerminalLine(`[Điều Khiển] Chụp ảnh màn hình trên điện thoại ${selectedDeviceId}...`, 'info-line');
    // Keyevent 120 snaps screenshot
    await window.api.executeCommand(`adb -s ${selectedDeviceId} shell input keyevent 120`);
  });
}

// Auto-connect previously saved devices on startup
async function autoConnectSavedDevices() {
  const saved = localStorage.getItem('aero_saved_ips');
  if (!saved) return;
  
  try {
    const ipList = JSON.parse(saved);
    if (!Array.isArray(ipList) || ipList.length === 0) return;
    
    appendTerminalLine(`[Tự Động] Phát hiện ${ipList.length} thiết bị đã từng kết nối. Đang thử kết nối lại...`, 'info-line');
    
    for (const ip of ipList) {
      appendTerminalLine(`[Tự Động] Đang kết nối lại: adb connect ${ip}:5555`, 'system-line');
      const res = await window.api.executeCommand(`adb connect ${ip}:5555`);
      if (res.success && res.stdout.includes('connected to')) {
        appendTerminalLine(`[Tự Động] Kết nối lại thành công đến ${ip}:5555!`, 'success-line');
      } else {
        appendTerminalLine(`[Tự Động] Thử kết nối đến ${ip}:5555 chưa thành công (thiết bị có thể đang ngoại tuyến).`, 'error-line');
      }
    }
    // Refresh devices list after trying all reconnections
    refreshDevicesList();
  } catch (err) {
    console.error('Error auto-connecting:', err);
  }
}

// Function to save IP address
function saveConnectedIp(ip) {
  if (!ip) return;
  try {
    const saved = localStorage.getItem('aero_saved_ips');
    let ipList = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(ipList)) ipList = [];
    
    if (!ipList.includes(ip)) {
      ipList.push(ip);
      localStorage.setItem('aero_saved_ips', JSON.stringify(ipList));
      appendTerminalLine(`[Hệ Thống] Đã lưu IP ${ip} vào bộ nhớ để tự động kết nối lần sau.`, 'success-line');
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
      alert('Vui lòng chọn hoặc điền đầy đủ địa chỉ IP của điện thoại ở ô nhập phía trên trước!');
      wizIp.focus();
      return;
    }
    
    const connectPort = wizConnectPort.value.trim();
    const pairPort = wizPairPort.value.trim();
    const pairCode = wizPairCode.value.trim();
    
    const template = btn.getAttribute('data-template');
    
    if (template.includes('{connect_port}') && !connectPort) {
      alert('Vui lòng điền Cổng Kết Nối (Connect Port) ở ô nhập phía trên trước!\n\nMẹo: Bạn có thể bấm "Dò Quét mDNS" để tự động dò quét cổng động và điền nhanh!');
      wizConnectPort.focus();
      return;
    }
    
    if (template.includes('{pair_port}') && !pairPort) {
      alert('Vui lòng điền Cổng Ghép Nối (Pair Port) ở ô nhập phía trên trước!');
      wizPairPort.focus();
      return;
    }
    
    if (template.includes('{pair_code}') && !pairCode) {
      alert('Vui lòng điền Mã Ghép Nối (Pairing Code) ở ô nhập phía trên trước!');
      wizPairCode.focus();
      return;
    }
    
    const command = template.replace(/{ip}/g, ip)
                            .replace(/{connect_port}/g, connectPort)
                            .replace(/{pair_port}/g, pairPort)
                            .replace(/{pair_code}/g, pairCode);
    
    // Clear previous logs
    wizardLog.innerHTML = `[Bắt đầu] Đang chạy lệnh nhanh theo IP...\n`;
    
    btn.disabled = true;
    const originalText = btn.innerText;
    btn.innerText = '⚙️ Đang chạy...';
    
    try {
      await executeStreamingCommand(command, wizardLog);
    } catch (err) {
      wizardLog.innerHTML += `\n❌ Lỗi: ${err.message}\n`;
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
  btnToggleFloatBar.addEventListener('click', (e) => {
    e.preventDefault();
    if (window.api && window.api.toggleControllerWindow) {
      window.api.toggleControllerWindow();
    }
  });
}

// Listen to show password prompt event from main process/controller
if (window.api && window.api.onShowPasswordPrompt) {
  window.api.onShowPasswordPrompt(() => {
    if (selectedDeviceId) {
      const savedPass = localStorage.getItem(`aero_device_password_${selectedDeviceId}`) || '';
      if (savedPass) {
        appendTerminalLine(`[Điều Khiển] Đang tự động nhập mật khẩu để mở khóa...`, 'info-line');
        window.api.executeControllerKey('input-password:' + savedPass);
      } else {
        alert("Bạn chưa lưu Mật khẩu / PIN điện thoại!\n\nHãy chọn thiết bị, sau đó nhập Mật khẩu vào ô 'Mật khẩu / PIN điện thoại' ở tab Thiết Bị Kết Nối, rồi ấn F5 để tự mở khóa.");
      }
    } else {
      alert("Chưa chọn thiết bị để mở khóa!");
    }
  });
}

// Listen to system output logs (e.g. inactivity battery-saving disconnects)
if (window.api && window.api.onTerminalOutputSystem) {
  window.api.onTerminalOutputSystem((payload) => {
    appendTerminalLine(payload.data, 'system-line');
  });
}

// Initial Devices Refresh
refreshDevicesList();
updateWizardPlaceholders();
autoConnectSavedDevices();
