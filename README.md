# BoclinkVN Clone - Hệ Thống Bọc Link & Rút Gọn Link Affiliate 100% Free

Hệ thống rút gọn link, bọc link affiliate (Cloaking) và Smart Deeplink cho Shopee, TikTok Shop, Lazada, YouTube tương tự **boclinkvn.net**. 

Được thiết kế độc lập, **100% Miễn phí**, sử dụng Node.js + SQLite tích hợp sẵn dạng file, không phát sinh chi phí mua code bản quyền hay thuê database cloud.

---

## Các tính năng chính

1. **Rút gọn link nhanh & Bí danh tùy chỉnh**:
   - Rút gọn link nhanh ngay tại trang chủ không cần đăng nhập.
   - Hỗ trợ tạo bí danh tùy chọn (ví dụ: `http://localhost:3000/deal-hot`).
   - Tự động tạo mã QR Code quét bằng camera điện thoại.

2. **Cơ chế Bọc link (Cloaking) & Deeplink**:
   - **Bọc Link Cloaking**: Trang đệm ẩn link gốc và gắn header `no-referrer`, chống bot Facebook / TikTok quét chặn link hoặc khóa fanpage.
   - **Smart Deeplink**: Tự động phát hiện sàn thương mại điện tử (Shopee, TikTok, Lazada) và kích hoạt trực tiếp App đã cài trên điện thoại thay vì mở trình duyệt in-app browser.
   - **Direct 302**: Chuyển hướng trực tiếp thông thường.
   - **Mật khẩu bảo vệ**: Cài đặt mật khẩu cho các link riêng tư/nội bộ.

3. **Thống kê & Báo cáo Realtime (Analytics)**:
   - Thống kê tổng lượt click, lượt click trong ngày.
   - Phân tích nguồn truy cập (Facebook, TikTok, Zalo, Direct...).
   - Phân tích loại thiết bị (Mobile vs PC) và hệ điều hành (iOS, Android, Windows...).

4. **Bảng điều khiển quản trị (Dashboard)**:
   - Quản lý danh sách liên kết: xem, sao chép, sửa link đích, đổi chế độ bọc link, bật/tắt link, xóa link.

---

## Hướng dẫn cài đặt & Khởi chạy

### Cách 1: Chạy bằng file `start.bat` (Khuyên dùng trên Windows)
- Nhấp đúp chuột vào file `start.bat`.

### Cách 2: Chạy bằng dòng lệnh
Mở terminal tại thư mục `G:\CODE TOOL\boclink-clone`:
```bash
# Cài đặt thư viện (nếu chưa cài)
npm install

# Khởi chạy server
npm start
```

Sau khi khởi chạy, truy cập trình duyệt tại:
- **Trang chủ**: [http://localhost:3000](http://localhost:3000)
- **Đăng nhập**: [http://localhost:3000/user](http://localhost:3000/user)
- **Dashboard**: [http://localhost:3000/dashboard](http://localhost:3000/dashboard)

### Tài khoản Demo có sẵn:
- **Email**: `admin@boclink.vn`
- **Mật khẩu**: `123456`
*(Bạn cũng có thể tự đăng ký tài khoản mới bất kỳ)*
