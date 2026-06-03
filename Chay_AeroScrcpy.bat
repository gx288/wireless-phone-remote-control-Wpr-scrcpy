@echo off
:: Di chuyển đến thư mục chứa ứng dụng
cd /d "D:\AT\Phone\aero-scrcpy-v2"

:: Khởi chạy ứng dụng và đóng ngay cửa sổ CMD đen, không để lại giao diện đen chạy ngầm
start "" npm start
exit
