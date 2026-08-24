# SAT Platform UI Guidelines

**Phiên bản:** 2.0
**Cập nhật:** 24/08/2026
**Trạng thái:** Nguồn quy chuẩn UI duy nhất và bắt buộc

Tài liệu này là nguồn quy tắc giao diện duy nhất cho mọi thay đổi frontend. Khi tài liệu cũ, code cũ hoặc Figma mâu thuẫn với nhau, thứ tự ưu tiên là: yêu cầu hiện tại của người dùng → file này → shared UI primitives → màn hình cũ. Figma chỉ là tham chiếu cho bố cục cụ thể, không được tạo thêm một design system song song.

Mọi UI mới phải dùng token trong `client/src/index.css`, alias trong `client/tailwind.config.js` và primitive trong `client/src/components/ui`. Không sao chép class của primitive sang feature.

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
- Background cá nhân hóa chỉ dùng preset đã kiểm soát và tối ưu trong source. Ảnh chỉ áp dụng cho vùng nội dung dashboard, không phủ sidebar/header và không dùng trong Exam Room; giữ card gần như opaque để bảo đảm khả năng đọc.
- Mỗi background raster ưu tiên WebP/AVIF và mục tiêu dưới `200 KB` (giới hạn tối đa khoảng `500 KB`), không dùng GIF/video, parallax, `background-attachment: fixed` hoặc backdrop blur. Luôn có lớp overlay màu tĩnh để duy trì contrast.
- Khi chuyển page trong dashboard, dùng progress bar mảnh ở đầu vùng nội dung và fade ngắn để tránh flash layout. Progress phải dựa trên route/request thật, có thời gian chờ tối đa để không khóa UI khi mạng chậm, không dùng backdrop/blur và phải tôn trọng `prefers-reduced-motion`.

## 2. Design tokens bắt buộc

Sử dụng các token đã định nghĩa trong `client/src/index.css` và component trong `client/src/components/ui`.

### 2.1 Colors

| Ý nghĩa | Tailwind alias | CSS token | Giá trị |
| --- | --- | --- | --- |
| Page background | `bg-background` | `--ui-background` | `#F2F8F5` |
| Main text | `text-foreground` | `--ui-foreground` | `#1A1A1A` |
| Card/surface | `bg-surface` | `--ui-surface` | `#FFFFFF` |
| Primary | `bg-primary`, `text-primary` | `--ui-primary` | `#1B7A5A` |
| Primary hover | `bg-primary-hover` | `--ui-primary-hover` | `#145F47` |
| Primary soft | `bg-primary-soft` | `--ui-primary-soft` | `#E8F5EF` |
| Accent | `bg-accent` | `--ui-accent` | `#E8C040` |
| Muted surface | `bg-muted` | `--ui-muted` | `#EAF2EE` |
| Muted text | `text-muted-foreground` | `--ui-muted-foreground` | `#6B7280` |
| Secondary text | `text-subtle` | `--ui-subtle-foreground` | `#4B5563` |
| Border | `border-ui-border` | `--ui-border` | `#D2DED9` |
| Strong divider | `border-ui-border-strong` | `--ui-border-strong` | `#C9D8D2` |
| Success | `text-success`, `bg-success-soft` | `--ui-success*` | semantic green |
| Warning | `text-warning`, `bg-warning-soft` | `--ui-warning*` | semantic amber |
| Danger | `text-danger`, `bg-danger-soft` | `--ui-danger*` | semantic red |

Không viết hex trực tiếp trong feature mới. Chỉ được dùng inline color cho dữ liệu trực quan động như chart series hoặc avatar palette đã kiểm soát. Nếu thiếu màu, bổ sung semantic token tại nguồn thay vì thêm màu cục bộ.

### 2.2 Spacing

- Dùng thang Tailwind theo lưới `4px`: `1=4px`, `2=8px`, `3=12px`, `4=16px`, `5=20px`, `6=24px`, `8=32px`.
- Control nội bộ: `gap-2` hoặc `gap-3`. Card: `p-4`, `p-5` hoặc `p-6`. Page: `p-6`, desktop `lg:p-8`.
- Không dùng arbitrary spacing như `p-[17px]`, `gap-[13px]` nếu không phải kích thước layout phụ thuộc thiết kế hoặc phép tính viewport.

### 2.3 Border radius

| Thành phần | Class bắt buộc |
| --- | --- |
| Button, input, select, icon container | `rounded-control` |
| Card, modal, table shell | `rounded-card` |
| Badge/avatar/status dot | `rounded-full` |
| Progress bar nhỏ | `rounded-sm` hoặc `rounded-full` |

Không dùng radius tùy ý như `rounded-[11px]` trong feature mới.

### 2.4 Shadow

| Mức | Class | Dùng cho |
| --- | --- | --- |
| 1 | `shadow-card` | Card và table mặc định |
| 2 | `shadow-raised` | Dropdown, popover, toast, card hover |
| 3 | `shadow-overlay` | Modal/dialog |

Không dùng `shadow-lg/xl/2xl` hoặc arbitrary shadow trong feature mới. Hover card chỉ nâng lên `shadow-raised`; không dịch card quá `-2px`.

Không dùng indigo/purple làm màu primary. Màu đỏ, amber và emerald chỉ dùng cho trạng thái semantic như error, warning và success.

Riêng nội dung trong Exam Room (passage, table, question và answer) dùng chung class `exam-content`: system stack `Arial`, `Helvetica Neue`, `Helvetica`, `Liberation Sans`, sans-serif ở `16px/1.55`. Không tải thêm webfont cho phòng thi; ưu tiên khả năng đọc, tốc độ và sự nhất quán giữa các loại content block.

Nội dung đề Math dùng strict LaTeX trong toàn bộ luồng import, preview, Exam Room và review result. Question, choice, text block, table cell và explanation nhận LaTeX thô, không dùng `$...$` và không tự suy đoán công thức; prose phải đặt trong `\\text{...}`. Metadata của structured import và đáp án dùng để chấm (A–D hoặc giá trị SPR) vẫn là plain text.

### Contrast

- Clarity là mặc định; hierarchy là một quyết định có chủ đích. Trước tiên mọi thành phần phải đọc và phân biệt rõ, sau đó mới giảm độ nổi của metadata hoặc vùng phụ.
- Ưu tiên độ tương phản rõ giữa background, text, border và action; không chọn màu chỉ vì “nhẹ mắt” nếu làm nội dung khó đọc.
- Text chính phải dùng màu đậm trên nền sáng. Text trắng chỉ đặt trên background đủ đậm và phải kiểm tra class nền không bị component mặc định ghi đè.
- KPI hoặc card cần nhấn mạnh nên dùng nền đậm, chữ sáng và border rõ; tránh nền pastel quá nhạt cho thông tin quan trọng.
- Secondary text vẫn phải đọc rõ, không dùng gray quá nhạt dưới cỡ `text-sm`.
- Trạng thái Correct/Incorrect/Warning phải phân biệt được bằng cả icon hoặc label, không chỉ dựa vào màu.
- Khi hoàn thành frontend, kiểm tra nhanh contrast ở màn hình thật và các state hover, disabled, loading.

## 3. Component bắt buộc

Ưu tiên tái sử dụng component từ:

```text
client/src/components/ui/AppUI.tsx
client/src/components/ui/styles.ts
```

Các component chuẩn:

- `AppHeader`
- `Button`
- `Card`
- `Badge`
- `Input`
- `Select`
- `DateTimePicker`
- `Modal`
- `Tabs`
- `TableShell`, `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `EmptyState`
- Toast toàn cục qua `APP_TOAST_OPTIONS`; feature mới gọi wrapper `appToast`

Không tạo lại button, input, select, modal, tabs, card, table shell, badge, toast hoặc empty state bằng một bộ class mới. Nếu thiếu variant, mở rộng primitive dùng chung trước. Native element chỉ được dùng cho cấu trúc semantic bên trong primitive hoặc UI chuyên dụng của Exam Room/calculator/content renderer.

### Contract của từng component

- `Button`: chỉ dùng variant `primary`, `outline`, `accent`, `ghost`, `destructive`; size `sm`, `md`, `lg`, `icon`.
- `Input` và `Select`: cao `36px`, focus ring primary; label/helper/error nằm ngoài control và dùng typography chuẩn.
- `Modal`: dùng `presentation="content-dialog"` trong dashboard; có title, nút đóng, Escape, focus trap và restore focus. Không tự dựng overlay.
- `Tabs`: bắt buộc cho chuyển đổi panel cùng trang; có `tablist/tab/tabpanel`, Arrow keys, Home/End. Link điều hướng sang route khác không phải Tabs.
- `Card`: surface nội dung mặc định. Không biến mọi section thành card nếu hierarchy không cần.
- `Table`: luôn đặt trong `TableShell`; table rộng có wrapper `overflow-x-auto`; dùng các table primitives cho header/row/cell.
- `Badge`: chỉ thể hiện metadata/status, không dùng thay button.
- `Toast`: success 3 giây, error 5 giây, mặc định 4 giây; không chứa thao tác nghiệp vụ bắt buộc.
- `EmptyState`: luôn có title; description giải thích bước tiếp theo; action chỉ thêm khi người dùng có hành động hợp lệ.

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

| Vai trò | Class chuẩn |
| --- | --- |
| Display/KPI | `text-display font-semibold` hoặc `text-2xl/3xl` cho số liệu |
| Page/section heading | `text-heading font-semibold` |
| Card/title | `text-title font-semibold` |
| Body/control | `text-body` |
| Caption/metadata | `text-caption text-muted-foreground` |

- Chỉ dùng `text-[Npx]` trong nội dung đề thi cần fidelity đặc biệt; UI thông thường phải dùng scale trên.
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
- Không dùng trực tiếp `<button>`, `<input>` hoặc `<select>` cho control thông thường. Dùng shared primitive. Ngoại lệ phải có comment giải thích vì sao primitive không phù hợp.

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
- Modal phải có `role="dialog"`, `aria-modal`, accessible title, Escape và focus trap.
- Tabs phải hỗ trợ keyboard và liên kết tab với panel.
- Không dùng màu là tín hiệu duy nhất cho status.
- Target cảm ứng quan trọng tối thiểu `36×36px`; ưu tiên `40×40px` trên mobile.

## 10. Quy tắc dữ liệu và trạng thái

- Luôn dùng dữ liệu thật từ API.
- Phải có loading, empty, error và disabled state.
- Không hiển thị `0%`, `0 questions` hoặc placeholder sai nếu API chưa tải xong; dùng skeleton/loading state.
- Không tính score, progress hay thời gian khác với logic backend.
- Không dùng thời gian local của server cho logic nghiệp vụ. Lưu và so sánh thời gian bằng UTC; chỉ format timezone khi hiển thị.

## 11. Checklist trước khi hoàn thành

- [ ] Đã đối chiếu màn hình tương ứng trong Figma ZIP.
- [ ] Dùng đúng font, màu, radius và spacing trong tài liệu này.
- [ ] Không thêm hex, arbitrary radius, arbitrary shadow hoặc type size cục bộ khi token hiện có đáp ứng được.
- [ ] Không tự dựng lại Button/Input/Select/Modal/Tabs/Card/Table/Badge/Toast/EmptyState.
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

## 12. Quy trình thay đổi design system

1. Kiểm tra primitive hiện có trước khi viết UI.
2. Nếu thiếu khả năng dùng chung, mở rộng `AppUI.tsx`, token CSS hoặc Tailwind alias trước.
3. Cập nhật file guideline này trong cùng thay đổi nếu contract component/token thay đổi.
4. Chuyển ít nhất màn hình đang yêu cầu sang API mới; không để hai pattern tương đương cùng xuất hiện trong phần code vừa sửa.
5. Chạy audit nhanh bằng `rg` cho hex, native controls, custom overlay và arbitrary shadow/radius.

Các pattern cũ chưa migrate không được dùng làm mẫu cho code mới. Chúng là technical debt cần chuyển dần khi feature tương ứng được chỉnh sửa.

## 13. Prompt gợi ý cho lần sau

Có thể dùng đoạn sau khi yêu cầu AI sửa giao diện:

> Trước khi code, hãy đọc toàn bộ `UI_GUIDELINES.md`. Chỉ dùng semantic tokens và shared primitives trong `client/src/components/ui`; nếu thiếu variant, mở rộng primitive trước, không tạo pattern cục bộ. Giữ UI bằng tiếng Anh, dùng dữ liệu thật và chạy checklist của guideline trước khi hoàn thành.
