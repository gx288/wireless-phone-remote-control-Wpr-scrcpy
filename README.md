# WprScrcpy v3 — Wireless Phone Remote Control (ADB & Scrcpy GUI)

WprScrcpy v3 is a Windows desktop application for managing, mirroring, and controlling Android devices wirelessly using ADB and scrcpy. It features a modern light gray user interface, custom PC-to-phone audio sharing, quick QR code pairing, an overlay HUD control panel, and automated global hotkeys.

---

## Key Features

1. **Wireless Connection**:
   * **QR Code Pairing**: Scan a dynamically generated QR code to automatically parse IP, port, and PIN from Android's *Wireless Debugging* screen.
   * **Manual Connect**: Step-by-step setup optimized for Android's connection flow (Connect Port, Pair Port, and PIN code).
   * **Connection History**: Saves recently connected devices for instant reconnection on next launch.
   * **Forget Device History 🗑️**: Instantly disconnect and wipe specific devices from history to prevent automatic reconnection.

2. **PC-to-Phone Audio Streaming (New in v3.0)**:
   * **Audio Share Integration**: Stream PC audio directly to the target Android phone (use phone as PC speaker).
   * **Independent Controls**: Start and stop the audio streaming service independently at any time.
   * **Auto-Start Sync**: Option to automatically start and stop audio streaming in sync with the screen mirroring session.

3. **Transparent HUD Overlay**:
   * **Dynamic Alignment**: Vertically aligned sidebar overlay that automatically snaps and resizes to the scrcpy mirror window.
   * **Smart Collapse**: Collapse the control panel into a compact 60px vertical tab that hugs the window border.
   * **Auto Show/Hide**: Automatically hides the overlay HUD when the scrcpy mirror window loses focus, and shows it when active.
   * **Pin Mirror 📌**: Keeps both the mirror window and the control panel pinned always-on-top.

4. **F-Keys Shortcut Management**:
   * Map standard `F1` to `F12` keys for quick operations (Home, Back, Recents, Rotate, Screen Off, Volume Controls, Screen Record, etc.).
   * Automatically registers shortcuts when the mirror window is active and releases them globally when switching to other apps.

5. **Extra Utilities**:
   * **Terminal Console CMD**: Integrated shell terminal with arrow up/down command history.
   * **Target Device Selector**: Choose which connected phone to target directly inside the Terminal tab.
   * **Screen Recording & Physical Screen Off**: Record mirroring sessions and turn off the physical phone screen to save battery.

---

## Setup & Development

### 1. System Requirements
* Windows 10 / Windows 11.
* [Node.js](https://nodejs.org/) (v18+).

### 2. Install Dependencies
```bash
npm install
```

### 3. Tích hợp Scrcpy & ADB / Integrations
Download [Scrcpy Win64 binaries](https://github.com/Genymobile/scrcpy) and extract all files into the following folder:
```text
wireless-phone-remote-control-Wpr-scrcpy/scrcpy-bin/
```

### 4. Run Dev Mode
```bash
npm start
```

### 5. Build Portable Release
```bash
npx electron-packager . WprScrcpy --platform=win32 --arch=x64 --icon=smartphone.ico --overwrite --out=dist --app-version=3.0.0
```
The portable output will be saved under the `dist/WprScrcpy-win32-x64/` directory.
