# 🏹 Artemis - Quản Lý Bán Hàng & Dòng Tiền

> Ứng dụng quản lý bán hàng, sổ nợ, giao hàng COD và dòng tiền tinh gọn dành cho các chủ shop, quà tặng, phụ kiện và tiểu thương bán lẻ trực tiếp & online.

---

## 📑 Mục Lục
1. [Giới thiệu tổng quan](#1-giới-thiệu-tổng-quan)
2. [Điểm nổi bật & Công nghệ](#2-điểm-nổi-bật--công-nghệ)
3. [Cài đặt & Chạy ứng dụng](#3-cài-đặt--chạy-ứng-dụng)
4. [Cấu hình Database & Biến môi trường](#4-cấu-hình-database--biến-môi-trường)
5. [Hướng dẫn sử dụng chi tiết từng tính năng](#5-hướng-dẫn-sử-dụng-chi-tiết-từng-tính-năng)
   - [5.1. Bán hàng & Chỉnh sửa đơn](#51-bán-hàng--chỉnh-sửa-đơn)
   - [5.2. Ghi chi tiền](#52-ghi-chi-tiền)
   - [5.3. Quản lý Món hàng quen thuộc](#53-quản-lý-món-hàng-quen-thuộc)
   - [5.4. Sổ nợ (Quản lý công nợ & Thu nợ)](#54-sổ-nợ-quản-lý-công-nợ--thu-nợ)
   - [5.5. Quản lý COD (Bưu điện)](#55-quản-lý-cod-bưu-điện)
   - [5.6. Lịch sử đơn hàng](#56-lịch-sử-đơn-hàng)
   - [5.7. Báo cáo dòng tiền & Lợi nhuận](#57-báo-cáo-dòng-tiền--lợi-nhuận)
   - [5.8. Sao lưu & Phục hồi dữ liệu](#58-sao-lưu--phục-hồi-dữ-liệu)
6. [Cấu trúc thư mục dự án](#6-cấu-trúc-thư-mục-dự-án)

---

## 1. Giới thiệu tổng quan

**Artemis (Quản Lý Bán Hàng)** được thiết kế với triết lý:
- **Tối giản - Nhanh chóng - Trực quan**: Thao tác tạo đơn chỉ mất 5-10 giây.
- **Mobile-First & Thân thiện với mọi lứa tuổi**: Phông chữ to, độ tương phản cao, nút bấm lớn, dễ bấm trên màn hình cảm ứng, người lớn tuổi cũng dùng được dễ dàng.
- **Offline-First & Không bao giờ mất dữ liệu**: Hoạt động hoàn hảo ngay cả khi không có kết nối Internet nhờ cơ sở dữ liệu trình duyệt bền vững (IndexedDB). Khi có mạng, dữ liệu tự động đồng bộ hai chiều lên Supabase Cloud.

---

## 2. Điểm nổi bật & Công nghệ

- **Frontend**: React 19, Vite 8, Tailwind CSS v4.
- **Local Database**: **IndexedDB Engine** tích hợp độc lập (`src/db.js`), lưu trữ hàng chục ngàn giao dịch ổn định, khắc phục triệt để giới hạn 5MB và rủi ro bị xóa của localStorage.
- **Cloud Database**: **Supabase** (PostgreSQL + Row Level Security - RLS). Mỗi chủ shop quản lý dữ liệu riêng biệt an toàn.
- **PWA (Progressive Web App)**: Cài đặt trực tiếp lên màn hình điện thoại (iOS / Android) như ứng dụng native mà không cần thông qua App Store/CH Play.
- **Đầy đủ nghiệp vụ CRUD**: Thêm, Sửa, Xóa, Tra cứu, Lọc, Xuất dữ liệu cho Đơn hàng, Món hàng, Khách nợ, COD và Dòng tiền.

---

## 3. Cài đặt & Chạy ứng dụng

### 3.1. Yêu cầu hệ thống
- **Node.js**: Phiên bản 18.0.0 trở lên.
- **Trình quản lý gói**: npm (hoặc yarn / pnpm).

### 3.2. Cài đặt các thư viện
Mở Terminal tại thư mục gốc dự án và chạy:
```bash
npm install
```

### 3.3. Chạy ở môi trường phát triển (Development)
```bash
npm run dev
```
Sau đó truy cập: `http://localhost:5173` trên trình duyệt.

### 3.4. Biên dịch bản sản xuất (Production Build)
```bash
npm run build
```
Thư mục sản phẩm `dist/` sẽ được tạo ra, sẵn sàng triển khai lên Vercel, Netlify, Cloudflare Pages hoặc hosting bất kỳ.

Để chạy thử bản build:
```bash
npm run preview
```

### 3.5. Cài đặt ứng dụng lên điện thoại (PWA)
- **Trên iPhone (Safari)**: Truy cập trang web -> Nhấn nút **Chia sẻ** (icon mũi tên ở cạnh dưới) -> Chọn **Thêm vào MH chính (Add to Home Screen)**.
- **Trên Android (Chrome)**: Truy cập trang web -> Nhấn icon 3 chấm góc phải trên -> Chọn **Cài đặt ứng dụng** hoặc **Thêm vào màn hình chính**.


---

## 4. Cấu hình Database & Biến môi trường

Ứng dụng hỗ trợ cơ chế lưu trữ linh hoạt kép (**Dual Storage Architecture**):

### 4.1. Cơ sở dữ liệu Offline (Mặc định - IndexedDB)
- Ngay khi mở ứng dụng, hệ thống tự động khởi tạo cơ sở dữ liệu `Flowers_QLBH_DB` qua IndexedDB.
- Có đầy đủ các bảng dữ liệu (Object Stores): `transactions`, `customers`, `items`, `meta`.
- **Tự động chuyển đổi (Auto-migration)**: Nếu trước đây người dùng từng lưu dữ liệu ở `localStorage`, hệ thống sẽ tự động sao chép sang IndexedDB mà không làm mất dữ liệu cũ.
- Hoạt động trơn tru không cần cấu hình thêm bất kỳ tài khoản hay server nào.

### 4.2. Cấu hình Supabase Cloud (Đồng bộ đa thiết bị)
Để đồng bộ dữ liệu giữa máy tính và điện thoại, bạn có thể kết nối với Supabase miễn phí:

1. Đăng ký tài khoản tại [supabase.com](https://supabase.com) và tạo một dự án mới (New Project).
2. Vào mục **SQL Editor** ở thanh menu bên trái của Supabase Dashboard.
3. Mở file `supabase_schema.sql` trong mã nguồn dự án, copy toàn bộ nội dung và bấm **Run** (Ctrl + Enter) để tạo bảng và kích hoạt phân quyền Row Level Security (RLS).
4. Vào **Project Settings** -> **API** để lấy:
   - **Project URL**
   - **Anon Public Key**
5. Tạo file `.env` ở thư mục gốc của dự án (sao chép từ `.env.example`):
   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-public-key
   ```
6. **Cách khác không cần sửa file code**: Ngay trên giao diện ứng dụng, nhấn vào nút **"Lưu Cloud"** (hoặc icon 👤 ở thanh dưới) -> chuyển sang tab **Cấu hình** -> nhập trực tiếp URL và Key của Supabase -> bấm **"Lưu & Thử kết nối"**. Sau đó đăng ký tài khoản là bạn có thể đăng nhập trên nhiều thiết bị khác nhau.

---

## 5. Hướng dẫn sử dụng chi tiết từng tính năng

### 5.1. Bán hàng & Chỉnh sửa đơn
- **Tạo đơn mới**:
  1. Tại Trang chủ, nhấn nút lớn màu xanh **`+ BÁN HÀNG`**.
  2. Chọn món hàng từ danh sách món quen thuộc (giá bán và giá vốn tự động điền) hoặc chọn **"Khác..."** để nhập món tự do.
  3. Điều chỉnh giá bán hoặc giá vốn nếu cần.
  4. Chọn 1 trong 3 hình thức thanh toán:
     - 💵 **Tiền mặt / Chuyển khoản**: Khách trả tiền ngay, tiền được ghi nhận vào dòng tiền thực thu của tháng.
     - 📝 **Ghi nợ**: Chọn khách hàng quen hoặc nhập tên & số điện thoại khách mới. Số tiền nợ sẽ tự động được cộng vào Sổ Nợ.
     - 📦 **Bưu điện (COD)**: Nhập tên người nhận, số điện thoại, địa chỉ giao hàng, mã vận đơn và phí ship. Đơn hàng tự động lưu vào tab Bưu điện để theo dõi đối soát.
  5. Nhấn **`✅ HOÀN THÀNH`**.
- **Chỉnh sửa đơn hàng (Update)**:
  - Vào tab **Lịch sử đơn** hoặc **Bưu điện**, bấm icon cây bút **`✏️`** ở bên cạnh đơn hàng cần sửa.
  - Màn hình **`Chỉnh Sửa Đơn Hàng`** hiển thị toàn bộ thông tin cũ. Bạn có thể sửa giá, khách hàng, hình thức thanh toán hoặc địa chỉ. Hệ thống tự động tính toán lại công nợ chính xác!
  - Bấm **`💾 LƯU THAY ĐỔI`**.

### 5.2. Ghi chi tiền
- Tại Trang chủ, nhấn nút màu cam **`+ GHI CHI TIỀN`**.
- Chọn 1 trong 6 danh mục chi tiêu:
  - 📦 Nhập hàng
  - 🚚 Phí ship
  - 🎁 Bao bì/Đóng gói
  - 💡 Tiền điện/Nước
  - 🍜 Ăn uống
  - 📝 Khác...
- Nhập số tiền đã chi và ghi chú (nếu có).
- Bấm **`✅ GHI CHI TIỀN`**. Khoản chi này được khấu trừ trực tiếp vào dòng tiền ròng và báo cáo lợi nhuận.

### 5.3. Quản lý Món hàng quen thuộc
- Tại Trang chủ, bấm nút **`🏷️ Món Hàng`** trên thanh công cụ.
- Bạn có thể:
  - **Thêm món mới**: Nhập tên món, giá bán mặc định, giá vốn mặc định -> bấm "Lưu món".
  - **Sửa món**: Bấm icon `✏️` để sửa giá bán/giá vốn theo thời giá thị trường.
  - **Xóa món**: Bấm icon `🗑️` để xóa món không còn kinh doanh.
  - **Khôi phục mẫu**: Bấm `🔄 Mẫu` để đưa về danh sách sản phẩm mẫu ban đầu.

### 5.4. Sổ nợ (Quản lý công nợ & Thu nợ)
- Vào tab **`👥 Sổ nợ`** ở thanh menu dưới:
  - **Banner Tổng nợ**: Thống kê số tiền khách còn nợ shop theo thời gian thực.
  - **Tìm kiếm**: Tìm nhanh tên khách hoặc số điện thoại.
  - **Lọc theo trạng thái**: "Đang nợ", "Đã thanh toán hết" và "Tất cả".
  - **Thêm khách nợ mới**: Bấm nút **`+ Thêm Khách Nợ`** ở góc trên để tạo hồ sơ khách nợ trực tiếp mà không cần qua đơn bán.
  - **Sửa thông tin khách**: Bấm nút `✏️` cạnh tên khách để cập nhật họ tên, số điện thoại hoặc điều chỉnh nợ thủ công.
  - **Xem lịch sử chi tiết**: Nhấn vào thẻ khách hàng để xem toàn bộ lịch sử mua nợ và các đợt thanh toán có mốc thời gian rõ ràng.
  - **Thu nợ (`💰 + THU NỢ`)**: Nhập số tiền thu (hỗ trợ nút chọn nhanh: 50k, 100k, 200k, hoặc "Trả hết"), nhập ghi chú -> Bấm **`✅ Xác nhận thu`**. Hệ thống tự động trừ nợ và tạo giao dịch thu tiền vào dòng tiền của shop.

### 5.5. Quản lý COD (Bưu điện)
- Vào tab **`📦 Bưu điện`** ở thanh menu dưới:
  - **Theo dõi tiền bưu điện giam**: Xem ngay tổng số tiền đang chờ các hãng giao hàng đối soát chuyển khoản.
  - **Bộ lọc đơn COD**: "⏳ Chờ bưu điện trả tiền" vs "✅ Đã nhận tiền" vs "Tất cả".
  - **Tìm kiếm**: Tìm theo tên người nhận, SĐT, địa chỉ giao hàng hoặc mã vận đơn.
  - **Copy địa chỉ 1 chạm**: Bấm **`📋 Copy Địa Chỉ`** để dán nhanh vào các ứng dụng vận chuyển như Viettel Post, GHTK, GHN, Shopee, v.v.
  - **Tra cứu hành trình vận đơn**: Nhấn nút **`Tra cứu ↗`** cạnh mã vận đơn; ứng dụng tự động nhận diện đơn vị chuyển phát (Viettel Post, GHTK, GHN,...) và mở trang tra cứu lộ trình bưu kiện.
  - **Nhận tiền COD**: Bấm nút **`💰 Nhận tiền COD`** khi bưu điện đối soát. Đơn chuyển sang trạng thái "✅ Đã nhận tiền" và được tính vào doanh thu thực nhận của tháng.
  - **Chỉnh sửa đơn COD**: Bấm nút `✏️` để sửa mã vận đơn, số điện thoại, địa chỉ nhận hàng hoặc phí ship.

### 5.6. Lịch sử đơn hàng
- Vào tab **`📋 Lịch sử đơn`**:
  - Xem danh sách toàn bộ các giao dịch phát sinh: Bán hàng, Chi phí, Thu nợ.
  - **Thanh tìm kiếm**: Lọc tức thì theo món hàng, tên khách, số điện thoại hoặc mã vận đơn.
  - **Phân loại nhanh**: Lọc theo "🛒 Bán hàng", "💸 Chi tiền", "💰 Thu nợ", "📦 COD", "📝 Ghi nợ".
  - **Tóm tắt dòng tiền bộ lọc**: Hiển thị tổng thu, tổng chi và số lượng đơn tương ứng với kết quả lọc.
  - **Sửa đơn hàng**: Bấm `✏️` để sửa đơn.
  - **Xóa giao dịch**: Bấm `🗑️` -> xác nhận "Xóa". Hệ thống tự động hoàn nguyên công nợ tương ứng.

### 5.7. Báo cáo dòng tiền & Lợi nhuận
- Tại Trang chủ, bấm nút **`📊 Dòng Tiền`**:
  - **Bộ chọn tháng**: Bấm `◀ Trước` hoặc `Sau ▶` để xem báo cáo tài chính của bất kỳ tháng nào trong năm.
  - **Dòng tiền ròng thực tế (Net Cash Flow)**: Thể hiện lượng tiền mặt/tài khoản thực tế tăng thêm = (Tiền thu ngay + Tiền COD thực nhận + Tiền khách trả nợ) - (Tổng chi phí).
  - **Phân tích dòng tiền vào - ra**: Chi tiết từng khoản thu và cơ cấu giá vốn hàng bán.
  - **Cơ cấu chi phí**: Biểu đồ thanh tỷ lệ % trực quan theo 6 nhóm chi phí (Nhập hàng, Vận chuyển, Bao bì, Điện nước, Sinh hoạt, Khác).
  - **Khoản chờ thu**: Nợ mới phát sinh và COD đang trên đường.
  - **Xuất file Excel (CSV)**: Bấm nút **`📥 Xuất File Excel (CSV) Báo Cáo Tháng`** để tải bảng tính có sẵn định dạng UTF-8 BOM, mở bằng Microsoft Excel hoặc Google Sheets không bị lỗi font tiếng Việt.

### 5.8. Sao lưu & Phục hồi dữ liệu
- Tại Trang chủ, bấm nút **`💾 Sao Lưu`**:
  - **Tải file sao lưu dự phòng (.JSON)**: Sao lưu toàn bộ dữ liệu đơn hàng, sổ nợ, khách hàng và danh mục món hàng thành một file JSON an toàn trên máy bạn.
  - **Xuất toàn bộ đơn sang Excel (.CSV)**: Tải danh sách tất cả các đơn hàng từ trước tới nay.
  - **Phục hồi dữ liệu từ file (.JSON)**: Bấm "Chọn file" để khôi phục lại dữ liệu bất cứ khi nào bạn đổi máy hoặc muốn phục hồi từ bản sao lưu trước đó.

---

## 6. Cấu trúc thư mục dự án

```text
Flowers_QLBH/
├── public/                     # Tài nguyên tĩnh PWA (favicon, manifest.json, icons)
├── src/
│   ├── components/             # Các khối giao diện chính
│   │   ├── AuthModal.jsx       # Quản lý tài khoản & kết nối Supabase Cloud
│   │   ├── BackupModal.jsx     # Sao lưu JSON, phục hồi & xuất file CSV
│   │   ├── CashFlowModal.jsx   # Báo cáo dòng tiền ròng & phân loại chi phí
│   │   ├── CodManager.jsx      # Quản lý đơn bưu điện COD & tra cứu vận đơn
│   │   ├── CustomerModal.jsx   # Thêm mới & chỉnh sửa khách nợ
│   │   ├── Dashboard.jsx       # Trang chủ, thống kê tháng & các nút thao tác nhanh
│   │   ├── DebtBook.jsx        # Sổ nợ, lịch sử mua nợ & biểu mẫu thu nợ
│   │   ├── ExpenseForm.jsx     # Biểu mẫu ghi chi tiền theo danh mục
│   │   ├── History.jsx         # Lịch sử giao dịch, tìm kiếm, lọc & sửa/xóa
│   │   ├── ItemManagerModal.jsx# Quản lý danh mục món hàng quen thuộc
│   │   ├── SaleForm.jsx        # Biểu mẫu bán hàng & chỉnh sửa đơn
│   │   └── Toast.jsx           # Thông báo hành động nổi (Toast notification)
│   ├── db.js                   # Cơ sở dữ liệu IndexedDB Engine (Persistent Storage)
│   ├── store.js                # Quản trị trạng thái, nghiệp vụ CRUD & tính toán tài chính
│   ├── supabase.js             # Cấu hình & SDK Supabase Cloud
│   ├── App.jsx                 # Điều hướng chính, điều phối modals & layout
│   ├── index.css               # Thiết kế hệ thống (Design system, Tailwind, dark theme)
│   └── main.jsx                # Điểm khởi chạy React app
├── .env.example                # Mẫu biến môi trường Supabase
├── index.html                  # Khung HTML gốc & cấu hình PWA web app
├── package.json                # Danh sách thư viện & scripts
├── supabase_schema.sql         # Script SQL tạo bảng & RLS cho Supabase
└── vite.config.js              # Cấu hình Vite & Tailwind plugin
```

---

## 7. Giấy phép & Đóng góp
Dự án được xây dựng và tối ưu dành cho cộng đồng kinh doanh vừa và nhỏ. Bạn có thể tự do mở rộng, tùy chỉnh thêm các tính năng phù hợp với mô hình kinh doanh của mình!

