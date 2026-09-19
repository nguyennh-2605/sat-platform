# SAT Platform

Nền tảng luyện thi Digital SAT dành cho học sinh, giáo viên và quản trị viên. Học sinh có thể làm bài luyện tập/thi thử, xem báo cáo kết quả, ôn từ vựng và theo dõi lỗi sai. Giáo viên quản lý lớp, bài giao, bài kiểm tra và tiến độ học tập; quản trị viên quản lý nội dung và hoạt động của hệ thống.

## Công nghệ và cấu trúc

| Thư mục | Vai trò | Công nghệ chính |
| --- | --- | --- |
| `client/` | Giao diện web | React 19, TypeScript, Vite, React Router, Tailwind CSS |
| `server/` | API và nghiệp vụ | Node.js 24, Express 5, Prisma, PostgreSQL |
| `server/prisma/` | Schema và migrations | Prisma |
| `projects/docs/` | Tài liệu kiến trúc, thiết kế và vận hành | Markdown |

Frontend gọi API qua `VITE_API_URL`; backend xử lý xác thực, phân quyền, dữ liệu và các tích hợp như Google, Gemini, lưu trữ đối tượng. Thông báo thời gian thực sử dụng Server-Sent Events (SSE). Xem [tài liệu kiến trúc](projects/docs/ARCHITECTURE.md) để biết luồng request, routes và mô hình dữ liệu.

## Chạy trên máy cá nhân

Yêu cầu: Node.js **24.x**, npm và một PostgreSQL có thể kết nối được. Repository có `.nvmrc` để chọn đúng phiên bản Node. Mỗi khối lệnh bên dưới bắt đầu từ thư mục gốc repository (và các server chạy ở terminal riêng).

1. Cài dependencies riêng cho hai ứng dụng:

   ```bash
   cd server
   npm ci
   cd ../client
   npm ci
   ```

2. Tạo `server/.env` từ [`server/.env.example`](server/.env.example) và `client/.env` từ [`client/.env.example`](client/.env.example). Tối thiểu, cấu hình `DATABASE_URL` trỏ tới PostgreSQL của bạn, đặt `JWT_SECRET` đủ mạnh và giữ `VITE_API_URL=http://localhost:5000` cho frontend chạy local. Điền thông tin Google, Gemini và object storage khi sử dụng các tính năng tương ứng. Không commit các file `.env` hoặc đưa bí mật vào biến `VITE_*` (các biến này được đóng gói vào trình duyệt).

3. Áp dụng migrations cho **database local** và chạy backend từ `server/`:

   ```bash
   cd server
   npm run db:migrate:deploy
   npm run dev
   ```

4. Mở terminal khác và chạy frontend từ `client/`:

   ```bash
   cd client
   npm run dev
   ```

Vite mặc định phục vụ tại `http://localhost:5173`; API mặc định ở `http://localhost:5000`. Kiểm tra `http://localhost:5000/health` để xác nhận tiến trình API đang chạy và `/ready` để kiểm tra kết nối PostgreSQL. Nếu đổi cổng frontend, cập nhật `CORS_ORIGINS` trong `server/.env`. Không chạy migrations với `DATABASE_URL` của môi trường dùng chung hoặc production khi chưa có kế hoạch triển khai và bản sao lưu.

## Cấu hình tích hợp

- `server/.env.example` liệt kê biến cho PostgreSQL, JWT, Google OAuth, Gemini, object storage và các tuỳ chọn logging/monitoring.
- `client/.env.example` liệt kê địa chỉ API và cấu hình trình duyệt cho Google, Drive, Cloudinary, Desmos và Sentry.
- Tài khoản Admin được quản lý qua CLI, không tạo bằng đăng ký công khai; xem [`server/ADMIN_CLI.md`](server/ADMIN_CLI.md).
- Seed dữ liệu không bắt buộc để khởi động. Chỉ chạy các script seed khi bạn chủ động muốn thêm dữ liệu mẫu vào database đang cấu hình.

## Kiểm tra

Chạy từ đúng thư mục ứng dụng:

| `client/` | `server/` |
| --- | --- |
| `npm run build` — kiểm tra TypeScript và build | `npm test` — chạy test backend |
| `npm run lint` — ESLint | `npm run db:migrate:deploy` — áp dụng migrations |
| `npm test` — Vitest | `npm start` — chạy API không dùng nodemon |
| `npm run test:e2e` — Playwright | |

## Tài liệu thêm

- [Kiến trúc, API và luồng nghiệp vụ](projects/docs/ARCHITECTURE.md)
- [Quy ước lập trình](CODING_CONVENTIONS.md)
- [Hướng dẫn UI](UI_GUIDELINES.md) và [tiến độ chuyển đổi thiết kế](projects/docs/DESIGN_MIGRATION.md)
- [Hướng dẫn triển khai](projects/docs/DEPLOYMENT.md) và [vận hành lưu trữ](projects/docs/STORAGE_OPERATIONS.md)
- [Thông báo bản quyền bên thứ ba](THIRD_PARTY_NOTICES.md)

Triển khai production sử dụng Vercel cho frontend, Render cho API và PostgreSQL được quản lý. Quy trình, biến môi trường và các bước kiểm tra sau triển khai nằm trong [deployment runbook](projects/docs/DEPLOYMENT.md).
