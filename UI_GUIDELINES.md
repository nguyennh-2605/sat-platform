# SAT Platform UI Guidelines

Tài liệu này là nguồn quy tắc giao diện mặc định cho mọi thay đổi frontend về sau. Trước khi sửa UI, hãy đọc toàn bộ file này và đối chiếu với source trong `SAT Learning Management System UI.zip`.

## 1. Nguyên tắc chung

- Figma ZIP là nguồn tham chiếu chính về bố cục, tỷ lệ, khoảng cách và trạng thái component.
- Không cố giữ giao diện cũ nếu khác Figma. Ưu tiên tái tạo đúng thiết kế Figma bằng dữ liệu và tính năng thật của hệ thống.
- Không tự thêm feature, KPI, badge, button hay thông tin mà người dùng không yêu cầu hoặc backend chưa hỗ trợ.
- Nếu Figma có feature chưa tồn tại trong hệ thống, bỏ qua feature đó thay vì dùng dữ liệu giả.
- Toàn bộ nội dung hiển thị cho người dùng phải bằng tiếng Anh. Tiếng Việt chỉ được dùng trong comment nội bộ khi thật sự cần thiết.
- Không dùng logo trong Figma.
- Giữ giao diện gọn, chuyên nghiệp, tránh card quá cao, button quá lớn và khoảng trắng dư thừa.
- Ưu tiên sự rõ ràng trước tính trang trí: control, đường viền, vùng nhập liệu và vùng nội dung phải nhận biết được ngay mà không cần người dùng đoán.
- Mặc định dùng contrast đủ rõ và trọng lượng thị giác nhất quán. Chỉ tạo mức đậm–nhạt khi cần thể hiện UI hierarchy cụ thể; không làm mờ thành phần chỉ để giao diện trông “nhẹ”.
- Ưu tiên hiệu năng và phản hồi mượt trên máy học sinh: không tùy tiện dùng `backdrop-filter`, `backdrop-blur`, blur lớn, animation liên tục, shadow nặng hoặc hiệu ứng GPU đắt tiền. Chỉ dùng khi Figma thực sự yêu cầu và lợi ích thị giác rõ ràng; ưu tiên overlay màu bán trong suốt đơn giản cho modal.

## 2. Design tokens

Sử dụng các token đã định nghĩa trong `client/src/index.css` và component trong `client/src/components/ui`.

| Mục đích | Giá trị |
| --- | --- |
| Page background | `#F2F8F5` |
| Card/background | `#FFFFFF` |
| Primary green | `#1B7A5A` |
| Primary hover | `#145F47` |
| Dark green/sidebar | `#0F4D38` |
| Green surface | `#E8F5EF` |
| Green border | `#C2DDD4` |
| Accent gold | `#E8C040` |
| Main text | `#1A1A1A` |
| Muted text | `#6B7280` |
| Border | `#D2DED9` |
| Strong divider | `#C9D8D2` |
| Font | `Inter`, sau đó dùng system sans-serif |
| Card radius | `rounded-xl` |
| Button/input radius | `rounded-lg` |

Không dùng indigo/purple làm màu primary. Màu đỏ, amber và emerald chỉ dùng cho trạng thái semantic như error, warning và success.

### Contrast

- Clarity là mặc định; hierarchy là một quyết định có chủ đích. Trước tiên mọi thành phần phải đọc và phân biệt rõ, sau đó mới giảm độ nổi của metadata hoặc vùng phụ.
- Ưu tiên độ tương phản rõ giữa background, text, border và action; không chọn màu chỉ vì “nhẹ mắt” nếu làm nội dung khó đọc.
- Text chính phải dùng màu đậm trên nền sáng. Text trắng chỉ đặt trên background đủ đậm và phải kiểm tra class nền không bị component mặc định ghi đè.
- KPI hoặc card cần nhấn mạnh nên dùng nền đậm, chữ sáng và border rõ; tránh nền pastel quá nhạt cho thông tin quan trọng.
- Secondary text vẫn phải đọc rõ, không dùng gray quá nhạt dưới cỡ `text-sm`.
- Trạng thái Correct/Incorrect/Warning phải phân biệt được bằng cả icon hoặc label, không chỉ dựa vào màu.
- Khi hoàn thành frontend, kiểm tra nhanh contrast ở màn hình thật và các state hover, disabled, loading.

## 3. Component bắt buộc ưu tiên

Ưu tiên tái sử dụng component từ:

```text
client/src/components/ui/AppUI.tsx
client/src/components/ui/styles.ts
```

Các component hiện có:

- `AppHeader`
- `Button`
- `Card`
- `Badge`
- `Input`
- `Select`
- `DateTimePicker`
- `Modal`
- `TableShell`

Không tạo lại button, modal hoặc card bằng một bộ class mới nếu component dùng chung đã đáp ứng được yêu cầu. Nếu thiếu variant, mở rộng component dùng chung trước.

- Trong dashboard có sidebar cố định bên trái, modal/panel thuộc một page phải được giới hạn trong vùng nội dung bên phải và không phủ, làm tối hoặc dịch chuyển sidebar. Dùng `Modal` với `presentation="content-dialog"` cho popup của page; variant này phải portal vào `document.body` và offset theo chiều rộng sidebar để không bị ancestor có `transform`, animation hoặc overflow làm lệch vị trí. Popup vẫn phải có khoảng đệm, backdrop và kích thước dialog bình thường. Chỉ dùng `presentation="content-panel"` khi người dùng thực sự yêu cầu một màn hình chi tiết phủ kín vùng nội dung.

## 4. Header và bố cục trang

- Header cao `60px`, nền trắng, sticky ở phía trên và có border dưới.
- Avatar và notification nằm bên phải header như Figma.
- Nội dung trang dùng chiều rộng tối đa khoảng `1200px` và căn giữa.
- Khoảng đệm mặc định: `p-6`; desktop có thể dùng `lg:p-8`.
- Page background luôn dùng `#F2F8F5`.
- Card dùng nền trắng, border mặc định `#D2DED9`, `rounded-xl`, shadow nhẹ. Dùng strong divider `#C9D8D2` cho split view, panel header hoặc ranh giới cần nhận biết rõ.
- Tránh `rounded-2xl`, shadow quá đậm và gradient không có trong Figma.

## 5. Typography

- Page title: `text-base` hoặc `text-lg`, `font-semibold` tùy vị trí.
- Section title: `text-sm` đến `text-lg`, `font-semibold`.
- Body: `text-sm`.
- Metadata/helper text: `text-xs`, màu `#6B7280`.
- KPI value có thể dùng `text-2xl` hoặc `text-3xl`.
- Không dùng `font-black` hoặc `font-bold` tràn lan. Chỉ dùng bold cho dữ liệu cần nhấn mạnh.
- Không trộn nhiều font trong cùng trang.

## 6. Button và control

- Chiều cao button mặc định: `36px`; button lớn tối đa khoảng `40px`.
- Primary button: nền `#1B7A5A`, chữ trắng, hover `#145F47`.
- Secondary button: nền trắng, border và chữ `#1B7A5A`.
- Accent button chỉ dùng khi Figma thể hiện rõ màu vàng.
- Icon-only button phải có `aria-label` hoặc `title`.
- Không dùng button `rounded-full` cho action thông thường.
- Input/select cao khoảng `36px`, `rounded-lg`, focus ring xanh nhẹ.
- Mọi trường chọn ngày hoặc ngày–giờ phải dùng shared `DateTimePicker` từ `client/src/components/ui/DateTimePicker.tsx`; không dùng trực tiếp native `date`, `datetime-local` hoặc tạo theme calendar riêng theo từng feature.
- Calendar dùng định dạng 24 giờ, lưu datetime dưới dạng UTC ISO và chỉ chuyển sang timezone local khi hiển thị. Date-only giữ định dạng `YYYY-MM-DD` để tránh lệch ngày do timezone.
- Không tạo checkbox hoặc tick button quá lớn.

### Page-level Back button

- Mọi hành động quay lại ở cấp trang hoặc quay lại một màn hình cha phải dùng shared component `BackButton` từ `client/src/components/ui/AppUI.tsx`; không tự viết lại bằng thẻ `button` và một bộ class riêng.
- Mẫu mặc định luôn gồm icon `ArrowLeft` cỡ `16px` và nhãn English `Back`; cao `32px`, `rounded-lg`, nền trong suốt, chữ `#4B5563`, hover nền xanh nhạt và chữ xanh đậm.
- Không đổi thành icon-only, outline button, text link hoặc các nhãn dài như `Back to Analytics` / `Back to class` nếu không có yêu cầu đặc biệt về accessibility hoặc không gian.
- Điều hướng Previous/Next trong bảng, carousel, question review hoặc stepper là workflow control, không phải page-level Back và tiếp tục dùng variant phù hợp với ngữ cảnh đó.

## 7. Practice Center

- Giáo viên chỉ thấy đề do chính giáo viên đó tạo.
- Học sinh thấy đề admin đăng và đề giáo viên giao cho lớp của mình.
- Trạng thái mặc định của card có nút ba chấm ở góc phải.
- Giáo viên nhấn `Assign tests` để vào selection mode; lúc đó nút ba chấm mới đổi thành checkbox.
- Không hiện số lớp đã giao trên card nếu không được yêu cầu.
- Card phải gọn; title, metadata, progress và action không được cách nhau quá xa.
- Hiển thị question count, progress percentage, last attempt và score khi có dữ liệu thật.
- Các trạng thái dùng English: `Not started`, `In progress`, `Completed`.

## 8. Analytics

- Bám sát bố cục trong Figma ZIP: KPI cards, Score Progress, Activity Heatmap, Section Performance và Recent Activity.
- Giáo viên dùng bố cục Test Performance: KPI strip, Question Performance Breakdown và Student Rankings.
- Không dùng số liệu giả. Empty state tốt hơn dữ liệu demo.
- Reading & Writing dùng xanh; Math dùng vàng accent.
- Ngày và heatmap phải xử lý UTC ở backend để không phụ thuộc timezone của Vercel/Render.
- Table header nhỏ, uppercase khi phù hợp; row gọn và có hover rất nhẹ.

## 9. Responsive và accessibility

- Mọi page phải dùng được ở mobile, tablet và desktop.
- Grid nhiều cột phải thu về một cột trên màn hình nhỏ.
- Table rộng phải có horizontal scroll, không làm tràn viewport.
- Text dài cần `truncate`, `line-clamp` hoặc wrap phù hợp.
- Màu chữ phải đủ tương phản.
- Button và input phải có focus state rõ ràng.
- Icon trang trí dùng `aria-hidden`; icon action phải có accessible label.

## 10. Quy tắc dữ liệu và trạng thái

- Luôn dùng dữ liệu thật từ API.
- Phải có loading, empty, error và disabled state.
- Không hiển thị `0%`, `0 questions` hoặc placeholder sai nếu API chưa tải xong; dùng skeleton/loading state.
- Không tính score, progress hay thời gian khác với logic backend.
- Không dùng thời gian local của server cho logic nghiệp vụ. Lưu và so sánh thời gian bằng UTC; chỉ format timezone khi hiển thị.

## 11. Checklist trước khi hoàn thành

- [ ] Đã đối chiếu màn hình tương ứng trong Figma ZIP.
- [ ] Dùng đúng font, màu, radius và spacing trong tài liệu này.
- [ ] Không còn primary indigo/purple hoặc `rounded-2xl` ngoài trường hợp có chủ ý.
- [ ] Nội dung hiển thị là tiếng Anh.
- [ ] Không thêm feature hay dữ liệu giả ngoài yêu cầu.
- [ ] Có loading, empty và error state.
- [ ] Kiểm tra role Student/Teacher/Admin liên quan.
- [ ] Kiểm tra responsive tối thiểu ở mobile và desktop.
- [ ] Không thêm backdrop blur hoặc hiệu ứng gây tốn hiệu năng nếu không có lý do thiết kế rõ ràng.
- [ ] Chạy targeted ESLint cho file đã sửa.
- [ ] Chạy `npm run build` trong `client`.
- [ ] Chạy `npm test` trong `server` nếu thay đổi API hoặc logic dữ liệu.
- [ ] Chạy `git diff --check`.

## 12. Prompt gợi ý cho lần sau

Có thể dùng đoạn sau khi yêu cầu AI sửa giao diện:

> Trước khi code, hãy đọc toàn bộ `UI_GUIDELINES.md` và đối chiếu màn hình tương ứng trong `SAT Learning Management System UI.zip`. Dùng các shared component trong `client/src/components/ui`, không tự tạo một design system khác. Giữ toàn bộ UI bằng tiếng Anh, dùng dữ liệu thật, không thêm feature ngoài yêu cầu và chạy build/test theo checklist trước khi hoàn thành.
