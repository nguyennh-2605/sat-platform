# Google sign-in and teacher approval

Updated October 7, 2026. All interface copy is English; this deployment guide is for the platform owner.

## Luồng đã triển khai

- `/auth` dùng một nút **Continue with Google** cho cả đăng nhập và tạo tài khoản. Không còn mật khẩu hay bộ chọn vai trò.
- Tài khoản mới luôn là `STUDENT`. Client không thể tự yêu cầu vai trò `TEACHER` hoặc `ADMIN` qua auth API.
- Học sinh vào **Profile & settings → Teacher access**, nhập lý do rồi gửi yêu cầu. Trong lúc chờ, tài khoản vẫn là học sinh.
- Admin vào **Teacher access** ở sidebar (`/dashboard/teacher-access`), chọn **Review**, nhập phản hồi nếu cần rồi **Approve** hoặc **Decline**. Quyết định và đổi vai trò được lưu trong cùng transaction; có audit event.
- Nếu bị từ chối, học sinh đọc phản hồi và gửi lại lý do mới. Nếu được duyệt, bấm **Check status** trong Settings để cập nhật session ngay, hoặc đăng nhập lại.
- Giáo viên và admin hiện tại giữ nguyên vai trò, theo quyết định của chủ nền tảng. Migration không thay đổi lớp học, bài thi, bài nộp hay lịch sử học.

## 1. Thiết lập Google Cloud

1. Mở [Google Cloud Console](https://console.cloud.google.com/), chọn project đang dùng cho Sonder SAT.
2. Trong **Google Auth Platform** (hoặc **APIs & Services → Credentials**), chọn/tạo OAuth Client ID loại **Web application**. Điền thông tin ứng dụng và đối tượng sử dụng trên consent screen. Nếu project đang ở chế độ Testing, thêm Gmail dùng kiểm tra vào danh sách test users khi Google yêu cầu.
3. Thêm **Authorized JavaScript origins** tương ứng với frontend thực tế. Theo hướng dẫn Google cho local development, thêm cả `http://localhost` và `http://localhost:5173`; production hiện tại là `https://sonder-sat.vercel.app`. Vite đã cố định port 5173 và báo lỗi nếu port bị chiếm để tránh âm thầm chạy sang origin khác. Nếu dùng `127.0.0.1` hoặc port khác để QA thì phải đăng ký origin đó riêng. Origin không có đường dẫn `/auth`.
4. Luồng này dùng popup và callback JavaScript; không có route OAuth redirect callback mới trong Express. Xem [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid) và [JavaScript reference](https://developers.google.com/identity/gsi/web/reference/js-reference).

### Testing và In production

Chế độ Testing không gây lỗi `The given origin is not allowed for the given client ID`. Đăng nhập hiện tại chỉ dùng Google Identity Services với thông tin nhận dạng cơ bản, không yêu cầu quyền Drive hay Gmail. Theo [Google OAuth app state overview](https://developers.google.com/identity/protocols/oauth2/production-readiness/overview), ứng dụng chỉ yêu cầu `openid`, `email`, `profile` có ngoại lệ đối với danh sách test users. Nếu thêm quyền truy cập API Google khác, phải xét lại scope, giới hạn Testing và yêu cầu verification.

Khi mở ứng dụng công khai, chủ project chuyển **Google Auth Platform → Audience → Publish app / In production**, hoàn thiện Branding và kiểm tra Data Access. Trạng thái publish áp dụng cho project OAuth; dùng chung project cho dev/prod thì dev cũng chịu trạng thái đó. Có thể tiếp tục dùng một Web Client ID nếu origins đúng; không cần tạo client mới để sửa lỗi hiện tại.

### Khi Google login bị lỗi

- **Origin not allowed / Google button 403:** đối chiếu Client ID trong Google Cloud với `VITE_GOOGLE_CLIENT_ID` của frontend thực sự đang chạy; lưu đủ origins ở trên, đợi Google cập nhật cấu hình rồi mở lại trang. Domain, protocol và port phải khớp. Localhost và 127.0.0.1 là hai origin khác nhau.
- **`GOOGLE_VERIFICATION_UNAVAILABLE` (503):** backend không tải được chứng thư công khai từ `https://www.googleapis.com/oauth2/v1/certs`; kiểm tra network/firewall/proxy của tiến trình Node. Backend không bỏ qua xác minh token. Trong phiên sửa lỗi local, API dev do Codex khởi chạy trong sandbox không ra được Google; API đã được chạy lại ngoài sandbox. Nếu tự chạy, dùng terminal local bình thường: `cd server`, `npm run dev`.
- **`GOOGLE_TOKEN_INVALID` (401):** credential không hợp lệ hoặc audience không trùng backend. Đăng nhập lại và kiểm tra hai Client ID; không gửi token cho người khác.
- **`/api/auth/refresh` (401) khi chưa đăng nhập:** trạng thái bình thường vì chưa có refresh session.
- Frontend dev và Vercel có `Cross-Origin-Opener-Policy: same-origin-allow-popups`. Google widget chỉ initialize một lần cho cùng SDK/Client ID; resize, đổi theme hoặc retry chỉ render lại nút.

## 2. Đồng bộ cấu hình frontend/backend

Trong `client/.env` (và biến môi trường của dịch vụ frontend):

```dotenv
VITE_GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
VITE_API_URL=http://localhost:5000
```

Trong `server/.env` (và biến môi trường của dịch vụ backend):

```dotenv
GOOGLE_CLIENT_ID=YOUR_WEB_CLIENT_ID.apps.googleusercontent.com
CORS_ORIGINS=http://localhost:5173,http://localhost:5174
```

Hai Client ID phải giống hệt nhau. Backend kiểm tra audience của Google ID token; không cần OAuth client secret cho cách đăng nhập này. Production dùng API URL HTTPS và thêm origin frontend production vào CORS. Biến `VITE_*` được đóng gói lúc build: sửa biến rồi restart Vite hoặc build/deploy lại frontend. Restart backend sau khi đổi `.env`.

Trong phiên triển khai này, Client ID local của backend đã được đồng bộ với Client ID hợp lệ đang có ở `client/.env`. Cấu hình trong Google Cloud và biến môi trường production vẫn cần chủ project kiểm tra; Codex không truy cập Google Cloud Console để sửa những mục này.

## 3. Migration và triển khai

Chạy trong `server/` trước khi triển khai backend mới:

```powershell
npm run db:migrate:deploy
npx prisma generate
```

Migration `20261007000000_teacher_access_requests` thêm bảng yêu cầu và các khóa ngoại. Database local đã áp dụng migration này và Prisma Client đã được generate. Migration local cũ `20261003090000_add_question_bank_image_usage` vốn chưa áp dụng được giữ nguyên để không thay đổi công việc ngoài phạm vi auth; kiểm tra trạng thái migration của môi trường triển khai bằng `npx prisma migrate status`.

Deploy backend và frontend cùng đợt. `/api/login` và `/api/register` trả `410 GOOGLE_SIGN_IN_REQUIRED`; cả người dùng trên client cũ cũng phải chuyển sang Google. Password sessions không được refresh/upgrade và access token cũ phải xác thực lại. Google sessions cũ có stable subject có thể được refresh sang định dạng mới.

## 4. Tài khoản admin

Admin hiện có có thể đăng nhập Google bằng cùng email nếu đó là Gmail hoặc Google Workspace đã được Google xác minh. Nếu cần tạo admin đầu tiên bằng Gmail thực tế:

1. Đăng nhập Google một lần trên app để tạo tài khoản học sinh.
2. Trên terminal của backend đúng database, chạy:

```powershell
# Local development database
npm run admin:promote -- --email YOUR_GMAIL@gmail.com --environment local

# Production database: CLI sẽ yêu cầu nhập PRODUCTION
npm run admin:promote -- --email YOUR_GMAIL@gmail.com --environment production --confirm-production
```

3. Đăng nhập Google lại, rồi mở trang **Teacher access**. CLI chỉ promote tài khoản đã liên kết Google và không có application password. Không chạy lệnh này cho một email chưa được chủ nền tảng xác nhận.

Không còn tạo admin bằng mật khẩu hay rotate application password. Bảo vệ tài khoản admin qua các thiết lập bảo mật của Google. Các lệnh revoke sessions và demote vẫn hoạt động như trước.

## 5. Tài khoản cũ và email

Google ID token được xác minh trên server; stable `sub` là khóa liên kết, không tin email/name/role do client tự gửi. Tài khoản mật khẩu cũ có email trùng Gmail hoặc Google Workspace có thể chuyển sang Google, giữ nguyên user ID và toàn bộ dữ liệu. Khi liên kết, application password được xóa và các refresh session cũ được thu hồi.

Với email ngoài Gmail/Workspace, Google có thể không còn là nguồn xác minh quyền sở hữu hiện tại. Hệ thống chặn tự liên kết tài khoản cũ trong trường hợp này; chủ nền tảng cần xác minh người sở hữu và xử lý dữ liệu/email trước khi chuyển. Xem [Google ID token verification](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token). Tài khoản mới dùng Google với email verified vẫn có thể đăng ký; hạn chế này áp dụng cho việc ghép vào dữ liệu cũ.

Email dùng thử hoặc email không do người dùng kiểm soát sẽ không thể đăng nhập Google bằng mật khẩu cũ của app. Không xóa dữ liệu hoặc đổi email hàng loạt: xác nhận email Google thực tế của từng người trước khi xử lý tài khoản đó.

## 6. Kiểm tra thủ công sau cấu hình

1. Dùng Gmail mới đăng nhập: thấy dashboard học sinh, không có công cụ giáo viên/admin.
2. Gửi yêu cầu trong Settings; reload vẫn thấy Pending.
3. Đăng nhập admin, duyệt yêu cầu; học sinh bấm Check status hoặc đăng nhập lại và mở được teaching workspace.
4. Thử Decline bằng một tài khoản khác; đọc được note và gửi lại được yêu cầu.
5. Dùng Google email trùng tài khoản cũ để kiểm tra lớp học, bài nộp và lịch sử vẫn giữ nguyên.

Automated browser tests stub Google SDK/credential responses để kiểm tra UI mà không đăng nhập Google thay chủ tài khoản. Kiểm tra consent và token thực tế cần người dùng thực hiện trên Google. Full-stack fixtures dùng CLI `e2e-google-session.js`, chỉ hoạt động với `NODE_ENV=test` và database có tên chứa `test`; không có endpoint bypass auth trong server.

## Validation của thay đổi

- Frontend build và targeted ESLint: đạt; Vite vẫn có cảnh báo bundle lớn có sẵn.
- Backend: 341 tests đạt, 2 tests bỏ qua theo điều kiện của suite, gồm trường hợp kết nối chứng thư Google thất bại trả 503 và không tạo session.
- Browser: 9 tests auth/teacher access đạt khi chạy tuần tự, gồm Google/API lỗi, SDK bị chặn, resize/retry không initialize lại, gửi yêu cầu, phản hồi từ chối, admin duyệt và refresh vai trò ngay. Lượt chạy song song ban đầu có hai ca quá thời gian chờ tải trang; chạy lại một worker đạt cả suite.
- Google SDK thật: kiểm tra layout sáng/tối ở 320, 390, 768 và 1440px, không tràn ngang hoặc lỗi page runtime; chưa thực hiện Google account consent.
- Sau sửa lỗi: Client ID frontend đang chạy và backend local trùng Client ID chủ project xác nhận; backend đã lấy được chứng thư Google ngoài sandbox. Google button thật trên `http://localhost:5173` vẫn trả 403, cần chủ project cập nhật/lưu Authorized JavaScript origins. Chưa xác nhận đăng nhập tài khoản thực tế thành công sau thay đổi Cloud.
- PostgreSQL local: submit, phân quyền, approve, đổi role, audit và chặn duyệt lại đều đạt trong transaction thử nghiệm đã rollback. Không để lại người dùng/yêu cầu/audit giả.
- Full-stack golden-path suite chưa chạy vì không thiết lập database test riêng cho phiên này. Fixture helper đã chuyển khỏi password registration; không dùng database học sinh hiện tại để chạy suite đó.
- `git diff --check`: đạt.
