# AeroScrcpy v2 — Trình điều khiển & Gương màn hình Android không dây (ADB & Scrcpy GUI)

AeroScrcpy v2 là giao diện đồ họa (GUI) quản lý kết nối và điều khiển thiết bị Android qua máy tính chạy Windows, sử dụng giao thức ADB và scrcpy. Ứng dụng hỗ trợ kết nối không dây thuận tiện thông qua mã QR và quản lý tương tác bằng thanh điều khiển overlay trong suốt cùng các phím tắt chức năng.

---

## Tính năng chính

### 1. Wireless Connection (Kết nối không dây)
* **Kết nối qua mã QR**: Hỗ trợ quét mã QR để lấy địa chỉ IP, cổng (port) và mã PIN ghép nối tự động từ chế độ *Gỡ lỗi không dây (Wireless Debugging)* trên thiết bị Android.
* **Ghép nối thủ công**: Form nhập liệu được phân tách rõ ràng theo đúng quy trình của Android (nhập cổng Kết nối trước, sau đó ghép nối qua cổng Pair và mã PIN).
* **Quản lý lịch sử kết nối**: Tự động lưu thông tin thiết bị đã kết nối để hỗ trợ tái kết nối nhanh trong các phiên làm việc sau.

### 2. Transparent HUD Overlay (Bảng điều khiển trong suốt)
* **Định vị động**: Thanh điều khiển dạng dọc tự động cập nhật vị trí và kích thước đồng bộ theo cửa sổ mirror của scrcpy.
* **Thu gọn thông minh**: Hỗ trợ thu gọn thanh điều khiển thành một nút tab nhỏ (chiều cao 60px) nép sát cạnh cửa sổ mirror để tránh che khuất nội dung hiển thị của điện thoại.
* **Tự động ẩn/hiện**: Tự động ẩn thanh điều khiển khi cửa sổ mirror mất focus (khi người dùng thao tác ở cửa sổ ứng dụng khác) và hiện lại khi cửa sổ mirror hoạt động.
* **Ghim cửa sổ (Pin Mirror) 📌**: Ghim đồng thời cả cửa sổ mirror và bảng điều khiển luôn nổi trên cùng các cửa sổ khác.

### 3. Phím tắt chức năng (F-Keys)
* Kích hoạt bộ phím tắt từ `F1` đến `F12` để thực hiện nhanh các tác vụ (Home, Back, ứng dụng gần đây, xoay màn hình, tắt/mở màn hình, điều chỉnh âm lượng, chụp ảnh, ghi màn hình...).
* Cơ chế tự động giải phóng phím tắt hệ thống ngay khi cửa sổ mirror không hoạt động để tránh ảnh hưởng đến các ứng dụng khác trên PC.

### 4. Tiện ích bổ sung
* **Audio Forwarding**: Truyền phát âm thanh trực tiếp từ thiết bị Android lên máy tính thời gian thực.
* **Ghi màn hình & Tắt màn hình vật lý**: Ghi lại phiên làm việc thành định dạng video lưu trên máy tính, hỗ trợ tắt màn hình thiết bị Android trong lúc mirror để tiết kiệm pin.

---

## Hướng dẫn cài đặt & phát triển

### 1. Yêu cầu hệ thống
* Hệ điều hành: Windows 10 hoặc Windows 11.
* Môi trường: [Node.js](https://nodejs.org/) (phiên bản khuyến nghị từ 18 trở lên).

### 2. Cài đặt các gói phụ thuộc
Tải mã nguồn về máy và cài đặt các thư viện liên quan:
```bash
npm install
```

### 3. Tích hợp Scrcpy & ADB
Để ứng dụng có thể chạy, tải về phiên bản [Scrcpy Win64](https://github.com/Genymobile/scrcpy) và copy toàn bộ các file thực thi (gồm `adb.exe`, `scrcpy.exe` và các file DLL) vào thư mục:
```text
aero-scrcpy-v2/scrcpy-bin/
```

### 4. Khởi chạy ở chế độ phát triển
```bash
npm start
```

### 5. Đóng gói ứng dụng thành phiên bản di động (Portable EXE)
Chạy lệnh sau để tạo thư mục đóng gói di động độc lập:
```bash
npx electron-packager . AeroScrcpy --platform=win32 --arch=x64 --icon=smartphone.ico --overwrite --out=dist
```
Gói ứng dụng di động hoàn chỉnh sẽ được lưu trong thư mục `dist/AeroScrcpy-win32-x64/`.

