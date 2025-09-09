# QuanLyChiTieu (Firebase Web App)

Một webapp tối giản để quản lý chi tiêu cá nhân + chia hóa đơn cho nhà trọ.

## Tính năng
- Đăng nhập Google (Firebase Auth)
- Trang Dashboard người dùng:
  - Thêm giao dịch (Thu nhập/Chi tiêu), danh mục, ghi chú
  - Tính tổng Thu/Chi/Cân bằng (client-side)
  - Danh sách 100 giao dịch gần nhất (chỉ dữ liệu của chính bạn)
  - Xóa giao dịch của chính mình
- Trang Admin (chỉ UID **rVrRomrCGbPqPcrPddtBTpdcLoh2**):
  - Tạo hóa đơn nhà hằng tháng, chọn thành viên tham gia, **tự động chia đều** vào collection `expenses` của từng người
  - Danh sách hóa đơn, đóng/xóa hóa đơn
- Bảo mật bằng **Firestore Rules** và tối thiểu **indexes** cần thiết

## Cấu trúc
```
/index.html         # Dashboard người dùng
/admin.html         # Trang quản trị
/styles.css
/firebase.js        # Config + init Firebase (đã set ADMIN_UID)
/auth.js            # Đăng nhập/đăng xuất, guard UI
/app.js             # Logic người dùng (thêm/list/xóa giao dịch)
/admin.js           # Logic admin (tạo/chốt/xóa hóa đơn, chia đều)
/rules/firestore.rules
/rules/firestore.indexes.json
```
## Hướng dẫn chạy
1. Triển khai dưới dạng static hosting (Firebase Hosting/Netlify/Vercel).  
2. Cập nhật `firebase.js` nếu có thay đổi config.  
3. Upload `rules/firestore.rules` và `rules/firestore.indexes.json`:
   ```bash
   # nếu dùng Firebase CLI (khuyến nghị)
   firebase init
   firebase deploy --only firestore:rules
   firebase firestore:indexes rules/firestore.indexes.json
   ```
4. Đảm bảo tài khoản admin có UID đúng: **rVrRomrCGbPqPcrPddtBTpdcLoh2**.

## Ghi chú
- Ứng dụng dùng Firebase compat 9 để giản lược (dễ hiểu). Có thể chuyển sang modular tree-shake nếu cần.
- `houseBills` khi tạo sẽ sinh các `expenses` con (chia đều). Nếu xóa hóa đơn, **không xóa** các expense con (giữ lịch sử).
- Bạn có thể mở rộng:
  - Bộ lọc theo tháng/danh mục
  - Xuất CSV
  - Approve/deny request hoàn tiền
  - Phân chia theo hệ số (không đều)
  - Biểu đồ thu/chi
- Ngày build: 2025-09-09 05:40:54
