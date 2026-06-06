# WprScrcpy — Hướng dẫn Bàn giao & Phát triển Tích hợp (v3.0.6)

Tài liệu này ghi lại chi tiết các yêu cầu, kiến trúc hệ thống, danh sách tính năng, cách phòng tránh lỗi thường gặp và các thông tin triển khai của dự án **WprScrcpy** để bàn giao cho các nhà phát triển hoặc Agent tiếp theo.

---

## 1. Nguồn gốc & Kiến trúc Dự án
* **Ý tưởng & Cấu trúc:** Phát triển dựa trên kiến trúc trải nghiệm người dùng của **QtScrcpy** (bảng điều khiển HUD bám sát cạnh màn hình mirror), nhưng được triển khai bằng công nghệ **Electron (Node.js)** để dễ dàng tùy biến giao diện, phong cách và các tính năng điều khiển.
* **Công nghệ cốt lõi:**
  * **Frontend:** HTML, CSS, JavaScript (Vanilla JS chạy trong Electron).
  * **Công cụ đóng gói:** `electron-packager` (TUYỆT ĐỐI KHÔNG dùng `electron-builder` vì lỗi phân quyền tạo symlink trên môi trường Windows).
  * **Tệp nhị phân tích hợp:** Được đặt trong thư mục `scrcpy-bin/` (bao gồm `adb.exe`, `scrcpy.exe` và các tệp hỗ trợ).

---

## 2. Các Tính năng Đang có

### A. Kết nối Không dây (ADB over Wi-Fi)
* **Ghép nối qua mã QR (Android 11+):** Tạo chuỗi QR dạng `WIFI:T:ADB;S:<service>;P:<pin>;;` và lắng nghe dịch vụ mDNS thông qua lệnh `adb mdns services` để tự động ghép nối và kết nối.
* **Kịch bản kết nối thủ công (Wizard):** Hướng dẫn từng bước trực quan giúp khởi động lại ADB, ghép nối bằng cổng Pair và mã PIN, kết nối cổng tạm thời, cuối cùng là chuyển điện thoại sang cổng cố định `5555` để kết nối vĩnh viễn.
* **Lịch sử kết nối & Tự động kết nối lại:** Lưu lại các IP kết nối Wi-Fi thành công vào `localStorage` và tự động thực hiện lệnh `adb connect <IP>:5555` ngay khi khởi động ứng dụng.
* **Quên lịch sử thiết bị 🗑️:** Nút thùng rác bên cạnh thiết bị không dây hỗ trợ ngắt kết nối (`adb disconnect`) và xóa hẳn thông tin IP khỏi lịch sử bộ nhớ để tránh tự kết nối lại ở lần sau.

### B. Truyền hình ảnh (Scrcpy integration)
* Tùy chỉnh thông số mirror đa dạng (Độ phân giải, Bitrate, FPS, Giữ màn hình luôn bật, Luôn nổi trên cùng, Hiển thị điểm chạm).
* **Wake Mirror (F11):** Gửi phím tắt `Alt+r` (phím tắt gốc của scrcpy để reset luồng truyền và giải mã) để đánh thức luồng hình ảnh mirror nếu điện thoại sleep và khi sáng lại màn hình bị đen.
* **Tắt màn hình vật lý (F6):** Tắt đèn nền màn hình thực tế của điện thoại trong khi màn hình mirror trên PC vẫn sáng để tiết kiệm pin tối đa.

### C. Bảng điều khiển Overlay HUD (`overlay.html`)
* **Giao diện bám dính (Snapping):** Cửa sổ overlay không viền (`overlayWindow`) tự động theo dõi và khớp kích thước theo cửa sổ scrcpy thông qua tệp hỗ trợ Win32 viết bằng C# (`get_scrcpy_bounds.exe`).
* **Đồng bộ hiển thị (Z-Order):** Tự động ẩn bảng điều khiển khi cửa sổ mirror mất tiêu điểm (focus) và hiện lại trên cùng khi cửa sổ hoạt động.
* **Thu gọn thông minh:** Cho phép thu nhỏ bảng điều khiển thành một tab nhỏ 16px nép sát viền gương mirror để tránh che khuất tầm nhìn.
* **Ánh xạ phím tắt (F-Keys):** Lắng nghe phím tắt toàn hệ thống từ `F1` - `F12` khi cửa sổ mirror đang hoạt động để gửi lệnh điều khiển (Home, Back, Apps gần đây, Tắt màn hình, Chụp ảnh, Ghi hình, v.v...).

### D. Truyền âm thanh từ máy tính sang điện thoại (Audio Share)
* **Tích hợp Audio Share:** Chạy máy chủ `AudioShareServer.exe` (PC) và kích hoạt ứng dụng client `io.github.mkckr0.audio_share_app` trên Android để dùng điện thoại làm loa máy tính.
* **Chế độ hoạt động kép:** Có thể bấm nút bật/tắt thủ công (chạy độc lập), hoặc tích chọn tự động bật/tắt đồng bộ theo phiên truyền hình ảnh (Mirroring).

### E. Terminal CMD Tương tác
* Console tương tác trực tiếp chạy lệnh hệ thống và ADB thời gian thực, lưu trữ lịch sử lệnh gõ (phím mũi tên Lên/Xuống).
* **Target Device Dropdown:** Bộ chọn thiết bị đích ở đầu tab Terminal giúp tự động chèn tham số định danh `-s <thiết_bị>` vào trước các lệnh `adb` để tránh xung đột lệnh.

---

## 3. Kiến trúc Luồng Xử lý
1. **`main.js`**: Tiến trình chính quản lý vòng đời ứng dụng Electron, vòng lặp theo dõi vị trí cửa sổ (`startScrcpyTracking()`), đăng ký phím tắt hệ thống khi mirror có focus và dọn dẹp tiến trình rác khi đóng app.
2. **`preload.js`**: Cầu nối API an toàn để giao tiếp giữa tiến trình renderer và main process (gửi lệnh, quản lý trạng thái âm thanh, luôn nổi trên cùng...).
3. **`renderer.js`**: Điều phối giao diện điều khiển, ghi nhớ cấu hình thiết bị, lưu trữ lịch sử kết nối và chạy các lệnh ADB.
4. **Theme màu sắc (`index.css`)**: Giao diện sáng đỏ đô nhạt kết hợp xám và trắng tối giản (`#881337`).

---

## 4. Cách Phòng tránh Lỗi Thường gặp & Ràng buộc Quan trọng

### ⚠️ Ràng buộc 1: Lệnh đóng gói và build
* **LƯU Ý:** Không chạy lệnh đóng gói bằng `electron-builder` hay `npm run build` vì bộ đóng gói này yêu cầu quyền Admin để tạo symlink trên Windows, gây lỗi build thất bại.
* **LỆNH ĐÚNG:** Luôn sử dụng lệnh `electron-packager` sau để đóng gói di động:
  ```bash
  npx electron-packager . WprScrcpy --platform=win32 --arch=x64 --icon=smartphone.ico --overwrite --out=dist --app-version=3.0.0
  ```

### ⚠️ Ràng buộc 2: Lỗi khóa thư mục khi đang chạy (`EBUSY`)
* **LƯU Ý:** Khi build ứng dụng, trình biên dịch sẽ báo lỗi nếu có bất kỳ tiến trình nào của ứng dụng cũ, adb hoặc Audio Share đang chạy ngầm khóa thư mục.
* **CÁCH XỬ LÝ:** Luôn chạy lệnh kết thúc các tiến trình này trước khi bắt đầu đóng gói:
  ```powershell
  taskkill /F /IM WprScrcpy.exe; taskkill /F /IM adb.exe; taskkill /F /IM scrcpy.exe; taskkill /F /IM AudioShareServer.exe
  ```

### ⚠️ Ràng buộc 3: Tránh xung đột nhiều thiết bị (`more than one device/emulator`)
* **LƯU Ý:** Nếu chạy lệnh ADB chung chung như `adb tcpip 5555` khi máy tính đang cắm nhiều thiết bị (hoặc thiết bị unauthorized cũ), ADB sẽ báo lỗi không xác định được đích.
* **CÁCH XỬ LÝ:** Luôn chèn thêm tham số `-s <IP:Port>` để trỏ chính xác thiết bị cần thao tác:
  ```bash
  adb -s 192.168.1.19:39967 tcpip 5555
  ```

### ⚠️ Ràng buộc 4: Tự động ngắt kết nối khi không dùng
* Kết nối không dây sẽ tự động ngắt sau 30 phút không hoạt động để tránh hao nguồn và pin điện thoại của người dùng (quản lý bởi timer trong `main.js`).

### ⚠️ Ràng buộc 5: Đồng bộ phiên bản
* Khi nâng cấp, đảm bảo thay đổi đồng bộ thuộc tính `version` trong `package.json` khớp với tham số `--app-version` khi build. Giao diện nên lấy động thuộc tính này qua IPC thay vì ghi tĩnh trong HTML.

---

## 5. Các Chức năng đã Hoàn thành & Cách hoạt động

### A. Tự động chuyển đổi thiết bị phát âm thanh trên Windows (Audio Loopback Redirect)
* **Trạng thái:** Đã hoàn thành.
* **Hoạt động:** 
  * Đã tích hợp tệp nhị phân siêu nhẹ `nircmd.exe` vào thư mục `scrcpy-bin/`.
  * Khi người dùng bấm **Start Audio** (hoặc tự động bắt đầu thông qua Mirroring): Giao diện gọi `nircmd.exe setdefaultsounddevice "Virtual Speakers"` để chuyển hướng đầu ra âm thanh của Windows sang thiết bị ảo AudioRelay.
  * Khi người dùng bấm **Stop Audio** (hoặc phiên Mirroring kết thúc): Giao diện tự động phục hồi thiết bị âm thanh mặc định bằng cách gọi `nircmd.exe setdefaultsounddevice "Speakers (USB Audio Device)"`.

### B. Cập nhật và tự động xuất bản phím tắt (Shortcut) sau khi đóng gói
* **Trạng thái:** Đã hoàn thành.
* **Hoạt động:**
  * Lệnh build trong `package.json` đã được cập nhật thành:
    ```bash
    npm run build
    ```
    Lệnh này sẽ tự động đóng gói ứng dụng bằng `electron-packager` thành công và tiếp tục gọi lệnh:
    ```powershell
    powershell -ExecutionPolicy Bypass -File create_shortcut.ps1
    ```
    để cập nhật/tạo mới phím tắt `AeroScrcpy.lnk` trực tiếp tại thư mục đích:
    `D:\Data\Du Lieu D\Shortcut\AeroScrcpy.lnk` mà không cần người dùng thao tác thủ công.

### C. Ghi nhớ tùy chọn "Truyền âm thanh" cho từng thiết bị
* **Trạng thái:** Đã hoàn thành.
* **Hoạt động:** Trạng thái checkbox **"Auto-start Audio Share when mirroring"** (`opt-auto-audio-share`) được lưu riêng cho từng thiết bị vào `localStorage` dưới khóa `wpr_device_settings_<Device_ID>`. Trạng thái mặc định nếu thiết bị chưa từng được cấu hình là **Không truyền** (`false`).

### D. Ngắt ứng dụng khách trên Điện thoại khi tắt ứng dụng Wpr
* **Trạng thái:** Đã hoàn thành.
* **Hoạt động:** Khi tắt ứng dụng, trước khi tiến trình ADB trên PC bị đóng hoàn toàn, ứng dụng sẽ chạy lệnh chặn đồng bộ một cách nhanh chóng:
  ```bash
  adb -s <activeDeviceId> shell am force-stop io.github.mkckr0.audio_share_app
  ```
  Lệnh này tắt hẳn ứng dụng Audio Share client trên điện thoại, ngắt hoàn toàn kết nối và giúp tiết kiệm pin tối đa cho thiết bị di động của người dùng.


