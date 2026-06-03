# WprScrcpy v2 — Wireless Phone Remote Control (ADB & Scrcpy GUI)

[**English**](#english) | [**Tiếng Việt**](#tiếng-việt)

---

## English

WprScrcpy v2 is a Windows GUI for managing, mirroring, and controlling Android devices wirelessly using ADB and scrcpy. It features quick QR code pairing, a smart transparent overlay HUD, and automatic global F-key shortcut handling.

### Key Features
1. **Wireless Connection**:
   * **QR Code Pairing**: Scan a dynamically generated QR code to automatically parse IP, port, and PIN from Android's *Wireless Debugging* screen.
   * **Manual Connect**: Step-by-step inputs optimized for Android's connection flow (Connect Port, Pair Port, and PIN code).
   * **Connection History**: Remembers recently connected devices for instant reconnection.
2. **Transparent HUD Overlay**:
   * **Dynamic Alignment**: Vertically aligned sidebar overlay that automatically snaps and resizes to the scrcpy mirror window.
   * **Smart Collapse**: Collapse the control panel into a compact 60px vertical tab that hugs the window border to prevent screen obstruction.
   * **Auto Show/Hide (Z-Order Sync)**: Automatically hides the control panel when the scrcpy mirror window loses focus and shows it when active.
   * **Pin Mirror 📌**: Keeps both the mirror window and the control panel pinned always-on-top.
3. **F-Keys Shortcut Management**:
   * Map standard `F1` to `F12` keys for quick operations (Home, Back, Recents, Rotate, Screen Off, Volume Controls, Screen Record, etc.).
   * Automatically registers shortcuts when the mirror window is active and releases them globally when switching to other apps.
4. **Extra Utilities**:
   * **Audio Forwarding**: Streams Android audio to PC in real-time.
   * **Screen Recording & Physical Screen Off**: Records mirroring sessions and turns off the physical phone screen to save battery.

---

## Tiếng Việt

WprScrcpy v2 là giao diện đồ họa (GUI) quản lý kết nối và điều khiển thiết bị Android qua máy tính chạy Windows, sử dụng giao thức ADB và scrcpy. Ứng dụng hỗ trợ kết nối không dây thuận tiện thông qua mã QR và quản lý tương tác bằng thanh điều khiển overlay trong suốt cùng các phím tắt chức năng.

### Tính năng chính
1. **Wireless Connection (Kết nối không dây)**:
   * **Kết nối qua mã QR**: Hỗ trợ quét mã QR để lấy địa chỉ IP, cổng (port) và mã PIN ghép nối tự động từ chế độ *Gỡ lỗi không dây (Wireless Debugging)* trên thiết bị Android.
   * **Ghép nối thủ công**: Form nhập liệu được phân tách rõ ràng theo đúng quy trình của Android (nhập cổng Kết nối trước, sau đó ghép nối qua cổng Pair và mã PIN).
   * **Quản lý lịch sử kết nối**: Tự động lưu thông tin thiết bị đã kết nối để hỗ trợ tái kết nối nhanh trong các phiên làm việc sau.
2. **Transparent HUD Overlay (Bảng điều khiển trong suốt)**:
   * **Định vị động**: Thanh điều khiển dạng dọc tự động cập nhật vị trí và kích thước đồng bộ theo cửa sổ mirror của scrcpy.
   * **Thu gọn thông minh**: Hỗ trợ thu gọn thanh điều khiển thành một nút tab nhỏ (chiều cao 60px) nép sát cạnh cửa sổ mirror để tránh che khuất nội dung hiển thị của điện thoại.
   * **Tự động ẩn/hiện**: Tự động ẩn thanh điều khiển khi cửa sổ mirror mất focus (khi người dùng thao tác ở cửa sổ ứng dụng khác) và hiện lại khi cửa sổ mirror hoạt động.
   * **Ghim cửa sổ (Pin Mirror) 📌**: Ghim đồng thời cả cửa sổ mirror và bảng điều khiển luôn nổi trên cùng các cửa sổ khác.
3. **Phím tắt chức năng (F-Keys)**:
   * Kích hoạt bộ phím tắt từ `F1` đến `F12` để thực hiện nhanh các tác vụ (Home, Back, ứng dụng gần đây, xoay màn hình, tắt/mở màn hình, điều chỉnh âm lượng, chụp ảnh, ghi màn hình...).
   * Cơ chế tự động giải phóng phím tắt hệ thống ngay khi cửa sổ mirror không hoạt động để tránh ảnh hưởng đến các ứng dụng khác trên PC.
4. **Tiện ích bổ sung**:
   * **Audio Forwarding**: Truyền phát âm thanh trực tiếp từ thiết bị Android lên máy tính thời gian thực.
   * **Ghi màn hình & Tắt màn hình vật lý**: Ghi lại phiên làm việc thành định dạng video lưu trên máy tính, hỗ trợ tắt màn hình thiết bị Android trong lúc mirror để tiết kiệm pin.

---

## Hướng dẫn cài đặt & phát triển / Setup & Development

### 1. Yêu cầu hệ thống / System Requirements
* Windows 10 / Windows 11.
* [Node.js](https://nodejs.org/) (v18+).

### 2. Cài đặt các gói phụ thuộc / Install Dependencies
```bash
npm install
```

### 3. Tích hợp Scrcpy & ADB / Integrations
Tải về bản [Scrcpy Win64](https://github.com/Genymobile/scrcpy) và giải nén toàn bộ file thực thi vào thư mục:
```text
wireless-phone-remote-control-Wpr-scrcpy/scrcpy-bin/
```

### 4. Khởi chạy / Run Dev mode
```bash
npm start
```

### 5. Đóng gói di động / Build Portable EXE
```bash
npx electron-packager . WprScrcpy --platform=win32 --arch=x64 --icon=smartphone.ico --overwrite --out=dist
```
Bản build di động hoàn chỉnh sẽ được lưu trong thư mục `dist/WprScrcpy-win32-x64/`.



