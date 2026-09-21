# Hướng Dẫn Triển Khai Website Boclink Lên Render.com (100% Free 24/7)

Render.com cho phép bạn lưu trữ ứng dụng Node.js hoàn toàn **Miễn phí**, hoạt động **24/7** không cần mở máy tính cá nhân, có sẵn chứng chỉ **HTTPS (SSL)** và hỗ trợ gắn tên miền riêng miễn phí.

---

## Bước 1: Đẩy mã nguồn lên GitHub cá nhân

1. Truy cập [https://github.com/new](https://github.com/new) và tạo một Repository mới (ví dụ đặt tên: `boclink-clone`, chọn chế độ **Public** hoặc **Private** đều được).
2. Sao chép đường dẫn Repository của bạn (ví dụ: `https://github.com/your-username/boclink-clone.git`).
3. Tại thư mục `G:\CODE TOOL\boclink-clone`:
   - **Cách nhanh**: Nhấp đúp chuột vào file **`push_to_github.bat`**, dán link GitHub vào và nhấn Enter.
   - **Cách thủ công** qua Terminal:
     ```powershell
     cd "G:\CODE TOOL\boclink-clone"
     git remote add origin https://github.com/your-username/boclink-clone.git
     git branch -M main
     git push -u origin main
     ```

---

## Bước 2: Kết nối & Deploy trên Render.com

1. Truy cập [https://dashboard.render.com](https://dashboard.render.com) và đăng nhập bằng tài khoản GitHub của bạn.
2. Bấm vào nút **New +** ở góc trên bên phải -> Chọn **Web Service**.
3. Chọn Repository `boclink-clone` vừa đẩy lên và bấm **Connect**.
4. Điền các thông tin cấu hình (Render đã tự động nhận diện từ file `render.yaml`):
   - **Name**: Đặt tên dịch vụ (ví dụ: `boclink-affiliate` - đây sẽ là tiền tố đường dẫn: `https://boclink-affiliate.onrender.com`).
   - **Region**: Chọn `Singapore` (để tốc độ tải trang về Việt Nam nhanh nhất).
   - **Branch**: `main`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npm run build`
   - **Start Command**: `npm start`
   - **Instance Type**: Chọn **Free** ($0/month).
5. Bấm nút **Deploy Web Service** ở dưới cùng.

---

## Bước 3: Hoàn tất & Sử dụng

- Render sẽ tiến hành cài đặt và khởi chạy trong khoảng 1 - 2 phút.
- Khi màn hình hiển thị trạng thái `Live`, bạn sẽ nhận được đường dẫn công khai, ví dụ:
  👉 **`https://boclink-affiliate.onrender.com`**
- Bạn có thể gửi link này cho bất kỳ ai trên internet để sử dụng hoặc đăng nhập vào Dashboard quản lý link.

> [!TIP]
> **Gắn tên miền riêng miễn phí:**
> Nếu bạn có tên miền riêng (ví dụ: `boclink.vn` hay `link.domain.com`), bạn chỉ cần vào mục **Settings** -> **Custom Domains** trong Render, thêm tên miền và trỏ bản ghi CNAME theo hướng dẫn của Render là website sẽ chạy với tên miền của bạn kèm HTTPS tự động!
