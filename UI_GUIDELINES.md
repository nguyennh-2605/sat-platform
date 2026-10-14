# SAT Platform UI Guidelines

**Phiên bản:** 3.0
**Cập nhật:** 25/08/2026
**Trạng thái:** Nguồn quy chuẩn UI duy nhất và bắt buộc

Tài liệu này là nguồn quy tắc giao diện duy nhất cho mọi thay đổi frontend. Khi tài liệu hoặc code mâu thuẫn, thứ tự ưu tiên là: yêu cầu hiện tại của người dùng → Studio Admin ở commit đã pin → file này → shared UI primitives → màn hình cũ. Xem mapping và trạng thái migration trong `projects/docs/DESIGN_MIGRATION.md`.

Studio Admin chỉ là nguồn tham chiếu về presentation. SAT Platform tiếp tục dùng Vite, React Router, Express và Prisma; không sao chép Next.js Server Components, server actions, mock data hoặc API conventions từ template.

Mọi UI mới phải dùng token trong `client/src/index.css`, alias trong `client/tailwind.config.js` và primitive trong `client/src/components/ui`. Không sao chép class của primitive sang feature.

## 1. Nguyên tắc chung

- Studio Admin commit `64e775837bded678341b09e3ab046d542a1a6a8a` là nguồn tham chiếu chính về bố cục, mật độ, khoảng cách, component anatomy và responsive behavior.
- Ưu tiên các route không nằm trong `(legacy)` và dùng màn hình được map trong `projects/docs/DESIGN_MIGRATION.md`.
- Không cố giữ giao diện cũ nếu khác reference. Tái tạo visual direction bằng dữ liệu và tính năng thật của hệ thống.
- Không tự thêm feature, KPI, badge, button hay thông tin mà người dùng không yêu cầu hoặc backend chưa hỗ trợ.
- Nếu reference có feature chưa tồn tại trong hệ thống, bỏ qua feature đó thay vì dùng dữ liệu giả.
- Toàn bộ nội dung hiển thị cho người dùng phải bằng tiếng Anh. Tiếng Việt chỉ được dùng trong comment nội bộ khi thật sự cần thiết.
- Không sao chép logo hoặc thương hiệu Studio Admin.
- Giữ giao diện gọn, chuyên nghiệp, tránh card quá cao, button quá lớn và khoảng trắng dư thừa.
- Ưu tiên sự rõ ràng trước tính trang trí: control, đường viền, vùng nhập liệu và vùng nội dung phải nhận biết được ngay mà không cần người dùng đoán.
- Mặc định dùng contrast đủ rõ và trọng lượng thị giác nhất quán. Chỉ tạo mức đậm–nhạt khi cần thể hiện UI hierarchy cụ thể; không làm mờ thành phần chỉ để giao diện trông “nhẹ”.
- Ưu tiên hiệu năng và phản hồi mượt trên máy học sinh: không tùy tiện dùng `backdrop-filter`, blur lớn, animation liên tục, shadow nặng hoặc hiệu ứng GPU đắt tiền. Sticky header có thể dùng blur nhẹ như reference nếu đã kiểm tra hiệu năng; modal ưu tiên overlay màu bán trong suốt đơn giản.
- Background cá nhân hóa chỉ dùng preset đã kiểm soát và tối ưu trong source. Ảnh chỉ áp dụng cho vùng nội dung dashboard, không phủ sidebar/header và không dùng trong Exam Room; giữ card gần như opaque để bảo đảm khả năng đọc.
- Dashboard dùng semantic page background của theme; không thêm ảnh nền hoặc background picker cá nhân hóa.
- Khi chuyển page trong dashboard, dùng progress bar mảnh ở đầu vùng nội dung và fade ngắn để tránh flash layout. Progress phải dựa trên route/request thật, có thời gian chờ tối đa để không khóa UI khi mạng chậm, không dùng backdrop/blur và phải tôn trọng `prefers-reduced-motion`.

## 2. Design tokens bắt buộc

Sử dụng các token đã định nghĩa trong `client/src/index.css` và component trong `client/src/components/ui`.

### 2.1 Colors

| Ý nghĩa | Tailwind alias | CSS token | Giá trị |
| --- | --- | --- | --- |
| Page background | `bg-background` | `--ui-background` | neutral page background |
| Main text | `text-foreground` | `--ui-foreground` | neutral foreground |
| Card/surface | `bg-surface` | `--ui-surface` | `#FFFFFF` |
| Primary | `bg-primary`, `text-primary` | `--ui-primary` | neutral high-contrast action |
| Primary hover | `bg-primary-hover` | `--ui-primary-hover` | neutral action hover |
| Primary soft | `bg-primary-soft` | `--ui-primary-soft` | neutral selected surface |
| Accent | `bg-accent` | `--ui-accent` | neutral accent surface |
| Muted surface | `bg-muted` | `--ui-muted` | neutral muted surface |
| Section header surface | `bg-section-header` | `--ui-section-header` | stronger neutral surface for hierarchical parent headers |
| Muted text | `text-muted-foreground` | `--ui-muted-foreground` | `#6B7280` |
| Secondary text | `text-subtle` | `--ui-subtle-foreground` | `#4B5563` |
| Border | `border-ui-border` | `--ui-border` | neutral border |
| Strong divider | `border-ui-border-strong` | `--ui-border-strong` | neutral strong divider |
| Success | `text-success`, `bg-success-soft` | `--ui-success*` | semantic green |
| Warning | `text-warning`, `bg-warning-soft` | `--ui-warning*` | semantic amber |
| Danger | `text-danger`, `bg-danger-soft` | `--ui-danger*` | semantic red |

Không viết hex trực tiếp trong feature mới. Chỉ được dùng inline color cho dữ liệu trực quan động như chart series hoặc avatar palette đã kiểm soát. Nếu thiếu màu, bổ sung semantic token tại nguồn thay vì thêm màu cục bộ.

Public landing và welcome panel của auth có ngoại lệ trang trí được duyệt: dùng `--ui-landing-rose`, `--ui-landing-cool` và `--ui-landing-warm` trong `client/src/index.css` cho gradient tĩnh ở hero, CTA, ánh sáng sau screenshot và auth welcome panel. Các token có bản light/dark, không dùng làm primary hay trạng thái semantic, không áp dụng cho dashboard. Giữ surface screenshot/auth form opaque và chữ phụ đủ tương phản; không dùng blur filter hoặc animation nền liên tục.

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
| 1 | `shadow-card` | Card mặc định; không dùng cho data surface dày đặc |
| 2 | `shadow-raised` | Dropdown, popover, toast, card hover |
| 3 | `shadow-overlay` | Modal/dialog |

Không dùng `shadow-lg/xl/2xl` hoặc arbitrary shadow trong feature mới. Hover card chỉ nâng lên `shadow-raised`; không dịch card quá `-2px`.

Không dùng indigo/purple hoặc SAT green làm primary trong neutral migration pass. Màu đỏ, amber và emerald chỉ dùng cho trạng thái semantic. SAT Green sẽ là theme preset riêng sau khi migration mặc định hoàn tất.

Study Planner có palette theo loại task được người dùng yêu cầu: `calendar-personal` (blue), `calendar-coursework` (violet), `calendar-vocabulary` (teal), `calendar-announcement` (amber), với các token `*-soft` và bản dark tại `index.css`. Chỉ áp dụng cho sự kiện lịch, marker Today và legend; giữ page, sidebar, control và primary action neutral. Loại task và deadline phải có chữ/icon để màu không là tín hiệu duy nhất.

Theo yêu cầu của người dùng, Study Planner dùng Day/Week time grid, click ô giờ để mở event modal, và toolbar được gom giữa lịch. Event dùng shared `Button` variant `calendar` với góc vuông, ôm trọn cột/khung giờ; không có viền cong hoặc accent ở đầu box. Event hoàn thành vẫn hiện với đường gạch ngang toàn bộ box. Không đặt bảng Unscheduled bên dưới lịch; có thể gắn task hiện có trong modal. Giữ All day cho dữ liệu cũ chưa có giờ.

Mọi popup modal/dialog, gồm Study Planner, Student Overview và Test Result/Score Report, căn giữa toàn bộ viewport theo yêu cầu người dùng. Event có thể chọn palette Blue/Violet/Teal/Amber hoặc Automatic (mặc định theo loại task); màu không đổi loại task. Tiêu đề dùng neutral foreground đậm, giờ dùng neutral subtle; dark mode dùng neutral text tương phản tương ứng. Đường phân cách đầu giờ đậm hơn vạch nửa giờ. Không hiển thị dòng hướng dẫn timezone dưới lịch.

Click event hiện có mở popup thông tin chỉ đọc (tên, ngày/giờ, note, màu) và action Mark complete/Reopen, Edit, Delete theo quyền của task. Edit mới mở form chỉnh sửa; cell trống mở form tạo trực tiếp. Nhãn giờ và Thứ trong lịch dùng `text-sm` với weight/contrast rõ hơn, thay vì caption mờ.

Study Planner cuộn dọc toàn page. Day/Week time grid và All day giãn theo nội dung, không có max-height hay vùng cuộn dọc riêng trong card, không tự cuộn grid đến 08:00. Week/Month giữ cuộn ngang trong lịch trên màn hình hẹp để không làm tràn page.

Practice Picks ở Student Overview dùng list có divider, title trước metadata; môn/loại bài là plain text thay vì một dãy badge. Gom số câu và thời lượng một dòng cạnh action có chữ Start/Continue/Try again. Chỉ hiển thị progress khi attempt đang DOING, Completed khi dữ liệu thật đã hoàn thành. Không có nhãn Suggested dựa vào vị trí item. Dùng shared Card, Button, Progress và EmptyState, giữ API order và route mở test hiện có; title dài tối đa hai dòng và action không bị tràn trên mobile.

Tasks ở Student Overview và event trong cả ba view calendar chỉ hiển thị lịch học do học sinh chủ động thêm (`plannedDate`). Bài giáo viên giao vẫn có thể được chọn để tạo event, nhưng deadline/announcement không tự thêm vào lịch hoặc Tasks. Card Tasks dùng nền neutral, title ở trái và time range ở phải cùng hàng; dùng chung nội dung và modal thông tin/chỉnh sửa với planner. Title tự viết hoa chữ cái đầu; task/event hoàn thành có một đường gạch ngang toàn bộ box; không có drag handle, badge Personal/Coursework hay deadline. Trước mỗi title có shared Checkbox hình tròn 24px để complete/reopen ngay mà không mở modal; control đứng riêng bên cạnh nút mở thông tin, bị disabled khi đang lưu hoặc completion do coursework quản lý. Sắp xếp theo ngày/giờ bắt đầu, event all-day ghi All day. Các số đếm Today/weekly và marker mini-calendar chỉ dựa trên event đã lên lịch.

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
client/src/components/ui/table.tsx
client/src/components/ui/data-surface.tsx
client/src/components/ui/styles.ts
```

Các component chuẩn:

- `AppHeader`
- `Button`
- `Card`
- `Badge`
- `Input`
- `RichTextEditor`, `RichTextContent`
- `Select`
- `DateTimePicker`
- `Modal`
- `Tabs`
- `Collapsible`
- `DataSurface`, `DataToolbar`, `DataToolbarSearch`, `DataToolbarGroup`, `DataToolbarActions`, `DataPagination`
- `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`
- `EmptyState`
- Toast toàn cục qua `APP_TOAST_OPTIONS`; feature mới gọi wrapper `appToast`

Không tạo lại button, input, select, modal, tabs, card, table shell, badge, toast hoặc empty state bằng một bộ class mới. Nếu thiếu variant, mở rộng primitive dùng chung trước. Native element chỉ được dùng cho cấu trúc semantic bên trong primitive hoặc UI chuyên dụng của Exam Room/calculator/content renderer.

### Contract của từng component

- `Button`: dùng canonical primitive `components/ui/button.tsx` với variant `default`, `outline`, `secondary`, `ghost`, `destructive`, `link`; size `xs`, `sm`, `default`, `lg`, `icon`, `icon-xs`, `icon-sm`, `icon-lg`. `AppUI.Button` chỉ là compatibility facade cho màn hình legacy và không dùng cho màn hình đã migrate.
- `Input` và `Select`: cao `36px`, focus ring primary; label/helper/error nằm ngoài control và dùng typography chuẩn.
- `RichTextEditor`: dùng shared Quill wrapper với toolbar tối thiểu theo domain; Announcement MVP chỉ gồm paragraph, bold, italic, ordered/bullet list, link và clear formatting. `RichTextContent` sở hữu sanitizer và style render tường minh cho cùng format; backend vẫn áp dụng content-length limit.
- `Modal`: dùng `presentation="content-dialog"` trong dashboard; có title, nút đóng, Escape, focus trap và restore focus. Không tự dựng overlay.
- Mọi popup modal/dialog phải đóng được khi click hoặc tap vào vùng ngoài nội dung (backdrop); shared `Modal` bật hành vi này mặc định. Dùng cùng close handler với nút đóng và Escape để giữ xác nhận thay đổi chưa lưu, không tự bỏ dữ liệu. Click bên trong modal hoặc control con không được đóng modal. Chỉ được tạm chặn đóng trong lúc đang lưu/gửi dữ liệu, không tắt click-outside thường trực.
- `Tabs`: bắt buộc cho chuyển đổi panel cùng trang; có `tablist/tab/tabpanel`, Arrow keys, Home/End. Link điều hướng sang route khác không phải Tabs.
- `Collapsible`: dùng cho outline có nhiều section được mở đồng thời; trigger phải có accessible name và controlled state khi page có Expand/Collapse All.
- `Sheet`: dùng shared primitive cho mobile navigation và drawer. `SheetContent` hỗ trợ `overlayClassName` để page tùy chỉnh overlay (ví dụ bỏ blur và tôn trọng reduced motion) mà không tự tạo backdrop; mặc định vẫn giữ outside dismissal, Escape và focus restoration.
- `Card`: surface nội dung mặc định. Không biến mọi section thành card nếu hierarchy không cần.
- `Table`: management table luôn nằm trong `DataSurface`; `Table` tự chịu horizontal overflow; dùng các table primitives cho header/row/cell. `TableShell` chỉ là compatibility alias trong thời gian migration.
- `Badge`: chỉ thể hiện metadata/status, không dùng thay button.
- `Toast`: success 3 giây, error 5 giây, mặc định 4 giây; không chứa thao tác nghiệp vụ bắt buộc.
- `EmptyState`: luôn có title; description giải thích bước tiếp theo; action chỉ thêm khi người dùng có hành động hợp lệ.
- Classroom chưa có lớp: Student dùng CTA Join a class và mô tả nhập code từ giáo viên, thay cho Explore practice tests. Student đã có lớp vẫn có Join a class trên toolbar; Teacher/Admin giữ Create class. Join dialog dùng shared Modal/Input/Button, căn giữa viewport theo ưu tiên modal của người dùng, focus vào Class code, có lỗi inline, submit bằng Enter và chặn submit/đóng trong lúc đang join; đóng bằng backdrop/Escape khi không bận. Join thành công mở Lessons của lớp và cập nhật cache; code dùng đúng mã từ Copy class code hiện có.
- `LoadingSpinner`: dùng cho trạng thái pending nằm trong button hoặc control nhỏ; không import trực tiếp icon spinner, không tự dựng spinner bằng border và không dùng emoji loading.
- `LoadingState`: dùng cho trạng thái tải toàn page/panel khi chưa có cấu trúc nội dung để giữ lại; label phải mô tả dữ liệu hoặc hành động đang chờ khi ngữ cảnh chưa rõ.
- `Skeleton`: dùng cho first-load có layout dự đoán được và phải mô phỏng đúng anatomy của nội dung thật. Không viết `animate-pulse` trực tiếp trong feature; refresh nền giữ lại dữ liệu cũ và dùng `LoadingSpinner` tại control kích hoạt.

- Mọi popup modal/dialog căn giữa toàn bộ viewport, bao gồm vùng sidebar, và overlay phủ toàn màn hình. Shared Modal phải portal cả dialog và content-dialog vào document.body; không đo sidebar, offset vùng body hoặc cho caller chọn content alignment. Shared DialogContent cũng dùng body portal mặc định. Giữ khoảng đệm và giới hạn chiều cao theo viewport, body cuộn được khi nội dung dài; outside/Escape/Close dùng chung close handler. Content-panel là workspace inline, không phải popup; Error Log reflection editor là modeless workspace có portalContainer riêng và giữ vị trí trong workspace.

## 4. Header và bố cục trang

- Dashboard header cao `48px`, sticky khi phù hợp, có border dưới và blur nhẹ có kiểm soát như Studio Admin.
- Sidebar desktop mặc định khoảng `272px`, hỗ trợ mobile sheet; content phải dùng được khi sidebar thu gọn.
- Student Focus Clock, theme, notification và account controls nằm bên phải header theo reference; role khác không thấy Focus Clock.
- Focus Clock là compact outline control trong global header, hiển thị thời gian còn lại bằng số tabular và mở shared Popover để Start/Pause/Resume/Finish/Cancel. Preset là 25/50 phút, custom giới hạn 5–240 phút. Trên mobile có thể ẩn word label nhưng không ẩn thời gian hoặc trạng thái.
- Focus Clock dùng server-authoritative StudySession và giữ provider ở router level để timer tiếp tục khi chuyển giữa dashboard và Exam Room. Countdown chỉ tick local; mutation mới gọi API. Tab khác chỉ nhận change signal qua BroadcastChannel rồi refetch, không tin session payload từ tab gửi.
- Nội dung trang mặc định dùng `p-4 md:p-6`; layout centered có thể giới hạn ở `max-w-screen-2xl`.
- Page background dùng semantic `bg-background`, không hardcode màu trong feature.
- Card dùng semantic surface/border, radius gọn và shadow tối thiểu như reference.
- Tránh card quá tròn, shadow đậm hoặc gradient trang trí không có trong reference đã pin.

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

- Chiều cao button mặc định: `32px`; action lớn dùng `36px`. Không override height cục bộ nếu canonical size đã đáp ứng.
- Primary button dùng semantic primary neutral; không hardcode màu.
- Secondary button dùng surface, border và foreground semantic.
- `secondary` chỉ dùng khi cần phân biệt một action phụ có surface rõ; không dùng màu thương hiệu tùy tiện trong neutral pass.
- Icon-only button phải có `aria-label` hoặc `title`.
- Không dùng button `rounded-full` cho action thông thường.
- Input/select cao khoảng `32–36px`, `rounded-lg`, focus ring semantic.
- Mọi trường chọn ngày hoặc ngày–giờ phải dùng shared `DateTimePicker` từ `client/src/components/ui/DateTimePicker.tsx`; không dùng trực tiếp native `date`, `datetime-local` hoặc tạo theme calendar riêng theo từng feature.
- Calendar dùng định dạng 24 giờ, lưu datetime dưới dạng UTC ISO và chỉ chuyển sang timezone local khi hiển thị. Date-only giữ định dạng `YYYY-MM-DD` để tránh lệch ngày do timezone.
- Không tạo checkbox hoặc tick button quá lớn.
- Không dùng trực tiếp `<button>`, `<input>` hoặc `<select>` cho control thông thường. Dùng shared primitive. Ngoại lệ phải có comment giải thích vì sao primitive không phù hợp.

### Page-level Back button

- Page-level Back chỉ xuất hiện trong global dashboard header, tại vị trí cũ của desktop Sidebar Trigger; detail screen không đặt Back trong body, PageHeader, empty state hoặc card.
- Detail screen đăng ký parent action qua shared dashboard Back controller. Back dùng icon `ArrowLeft` và label English `Back`, đậm khi hoạt động; list/root screen vẫn hiển thị control nhạt và disabled để giữ ổn định layout.
- Desktop Sidebar Trigger nằm bên phải Sidebar Header. Mobile giữ menu trigger trong dashboard header để mở off-canvas sidebar và hiển thị Back cạnh nó khi detail action hoạt động.
- Back controller phải giữ được custom behavior như unsaved-change confirmation hoặc quay lại nested workspace, không được mặc định dùng browser history khi parent route đã biết rõ.
- Điều hướng Previous/Next trong bảng, carousel hoặc question review là workflow control, không phải page-level Back và tiếp tục dùng variant phù hợp với ngữ cảnh đó.

## 7. Data surfaces

- Không tạo một generic DataTable chứa API, filter, sort và domain actions. Feature sở hữu behavior; shared primitive chỉ sở hữu visual anatomy và accessibility.
- Chỉ có ba variant: `management` cho dữ liệu so sánh theo cột, `rich list` cho collection có title/metadata/action, và `embedded` cho summary nằm trong Card.
- Management table dùng một `DataSurface` phẳng: `rounded-card border border-ui-border bg-surface shadow-none`. Toolbar, header, body, state và pagination phải nằm trong cùng surface.
- `DataToolbar` nằm một hàng từ desktop: search cố định `w-64`, controls `size="sm"` cùng độ đậm, `gap-2`, secondary/view controls và primary action nằm bên phải. Không dùng search `flex-1` tạo khoảng trống lớn hoặc wrap ngẫu nhiên thành hai hàng.
- Khi không đủ chỗ, gom controls phụ vào `Filter & sort`; mobile cho search một hàng riêng. Reset chỉ hiện khi có filter đang hoạt động.
- Header cao `44px`, dùng `bg-muted/20 text-caption font-medium text-muted-foreground`, title case và không có vertical border.
- Cell mặc định `px-4 py-3`; row dùng divider `border-ui-border/60`, hover `bg-muted/30`, selected `bg-muted/60`. Chỉ có density compact `44–48px` và regular `56–64px`.
- Primary cell có title `text-body font-medium text-foreground` và tối đa một dòng metadata `text-caption text-muted-foreground`. Numeric cell dùng `tabular-nums`; missing value dùng `—`.
- Row action là ghost icon button ở cột cuối rộng `44–48px`, có accessible label và không kích hoạt row navigation.
- Loading giữ nguyên shell/header và dùng skeleton rows. Empty dataset, no filter results và error là ba state riêng nhưng đều nằm trong body của cùng surface; error có Retry, filtered-empty có Clear filters.
- Pagination nằm trong footer của cùng surface và có border trên. Table rộng horizontal-scroll; chỉ ẩn cột phụ khi dữ liệu vẫn truy cập được ở primary cell hoặc detail view.
- Embedded table/list không tạo thêm border/radius bên trong Card nhưng vẫn dùng cùng typography, divider, hover và states.
- Lessons hierarchy, Exam Room, question content và print-content table không dùng Data Surface contract này.

## 8. Practice Center

- Với Admin, route này hiển thị `Test Management`, không dùng composition hoặc label của Teacher `Test Library`.
- Admin dùng hai collection `System Library | Teacher Tests`. Collection trả lời ownership/source; `Draft`, `Published`, `Archived` tiếp tục là lifecycle filter.
- `System Library` gồm mọi test có `scope = SYSTEM`, không phụ thuộc Admin đã tạo. Admin có thể Preview/Edit/Duplicate/Publish/Move to Draft/Archive/Delete theo capability backend.
- `Teacher Tests` gồm test `scope = PERSONAL` của Teacher và mặc định read-only. Action hợp lệ trong iteration hiện tại là Preview và Copy to System Library; không Edit/Archive/Delete trực tiếp nội dung Teacher.
- Copy to System Library luôn tạo một `SYSTEM` Draft mới và giữ nguyên bản gốc của Teacher.
- Admin Test Management bám sát `dashboard/tasks`: toolbar nằm trong bordered surface, input/filter/action cao compact, dropdown dùng shared Radix animation, table row gọn, action menu icon-size và footer pagination responsive. Card view là lựa chọn bổ sung trên cùng dữ liệu thật.
- Test đã có Classroom delivery hoặc attempt history không được sửa cấu trúc hoặc xóa vĩnh viễn; Duplicate tạo phiên bản Draft mới.
- Navigation copy phải role-aware và nhất quán ở Sidebar, Dashboard search và Dashboard Home: Student `Practice Center`, Teacher `Test Library`, Admin `Test Management`.

- Với Teacher, route này hiển thị `Test Library`: tạo, quản lý lifecycle và xem nội dung. Không assign Test cho Classroom từ Test Library; delivery được tạo duy nhất từ Classroom Activities hoặc Lessons để tránh hai entry point trùng chức năng.
- Teacher dùng hai nguồn `My Tests` và `System Tests`. `My Tests` chỉ gồm test giáo viên sở hữu; `System Tests` chỉ gồm test Published do Admin/platform cung cấp.
- `Draft`, `Published`, `Archived` là lifecycle filter bên trong `My Tests`, không phải source tab. `All` chỉ gồm Draft + Published; Archived chỉ xuất hiện khi chọn riêng.
- Teacher card không hiển thị attempt status, progress, last score hoặc Continue. Card chỉ hiển thị subject/source, title, type, question count, duration, updated time và content actions; lifecycle được thể hiện qua filter và list view, không lặp lại trên card.
- System Tests là read-only đối với Teacher; action hợp lệ là Preview và Duplicate to My Tests. Bản duplicate luôn là teacher-owned Draft.
- Published có Preview/Edit/Duplicate/Archive/Delete; Draft có Continue editing/Preview/Duplicate/Delete; Archived có Preview/Restore/Delete. Backend phải chặn permanent delete khi test đã có classroom hoặc attempt history.
- Test Detail dùng `Overview | Questions`; không thêm Assignments tab. Preview content không được tạo Submission cho giáo viên.
- Create/Edit dùng terminology `Test`, có `Save draft` và `Publish test`; chỉ Published test mới được chọn khi tạo Classroom activity.
- Create/Edit Test chỉ có hai trạng thái `Build` và `Review`; không hiển thị stepper. Build dùng composition của `dashboard/invoice`: page header title/subtitle bên trái, action bên phải, form card bên trái và preview bên phải.
- Card Build bên trái có hai tab full-width `Details | Import questions`. Details dùng shared `Field`, React Hook Form và schema validation; Subject, Mode, Modules và Publication dùng shared Radix Select đúng animation/check/focus của Studio Admin.
- Import questions đặt structured editor ở trên và nhóm Formatting guide, Upload file, Upload image, Update preview ở toolbar bên dưới. Preview là card riêng bên phải và luôn phản ánh parsed content; trên viewport nhỏ hai card xếp dọc như Invoice.
- Header action ở Build là `Continue to review`. Khi sang Review, cùng vị trí đổi thành `Replace import`, `Save draft`, `Publish test`; các action dùng shared Studio Admin Button compact như Invoice, không lặp ở footer hoặc tạo sticky sub-header.
- Review gồm question navigator, content preview và classification editor; desktop dùng ba cột có chiều cao giới hạn với navigator/content cuộn độc lập, mobile dùng tabs Preview/Edit. Previous/Next nằm ngay dưới nội dung và đáp án của câu hiện tại. Trạng thái disabled phải được giải thích bằng validation summary.
- Khi có thay đổi chưa lưu, page-level Back phải xác nhận trước khi rời; browser refresh/close phải dùng native before-unload protection. Formatting guide dùng dashboard content-dialog để không phủ sidebar.
- Bám sát `dashboard/infrastructure` cho page hierarchy và toolbar: search, filter, sort, view switch và role actions nằm trên một hàng ở desktop; chỉ wrap có kiểm soát trên viewport nhỏ.
- Toolbar dùng search bên trái và nhóm control `size="sm"` bên phải. Trên desktop, search nhận phần chiều rộng còn lại để khoảng cách từ search đến Filter bằng đúng khoảng cách giữa các control (`gap-2`); không chèn khoảng trống bằng `justify-between`/`justify-end` hoặc dùng control cao như action chính.
- View switch dùng icon dễ đọc và thêm check trước mode đang chọn; selected mode dùng neutral accent surface rõ hơn trạng thái chưa chọn.
- Filter và sort dùng shared dropdown primitives với label, radio item, submenu, separator và active count như `dashboard/file-manager`; không trải nhiều hàng pill filter trong page.
- Attempt status bám sát badge của `dashboard/default`: một outline pill trung tính cho mọi trạng thái, chỉ icon bên trong biểu thị Completed/In progress/Not started; không dùng border xanh/vàng cho status badge.
- Hỗ trợ cả card view và list/table view trên cùng dữ liệu và hành động. View preference được lưu ở client; list rộng phải horizontal-scroll thay vì ép cột quá hẹp.
- Giáo viên chỉ được sửa lifecycle/nội dung đề do chính giáo viên đó tạo.
- Học sinh thấy đề admin đăng và đề giáo viên giao cho lớp của mình.
- Practice Center của Student tiếp tục hiển thị attempt status, progress, last attempt và score từ dữ liệu thật.
- Published System tests mở một setup screen trước khi tạo attempt. Student có thể chọn Practice hoặc Exam simulation và timing phù hợp; assigned/class tests chỉ hiển thị cấu hình đã khóa. Practice mặc định vẫn có countdown để luyện pacing, đồng thời hỗ trợ half time, extra time, custom total time và untimed. Exam simulation chỉ hỗ trợ standard, 50% extra hoặc double time, yêu cầu full-screen và không cho Save & Exit.
- Setup screen phải cho xem trước mode, tổng thời gian và hành vi pause/resume. Khi đã có Submission `DOING`, cấu hình của attempt không được chỉnh lại và copy phải nói rõ đây là lượt làm đang tiếp tục.
- Setup screen là confirmation cuối cùng: đặt cấu hình và hướng dẫn trước bài theo bố cục ngang khi đủ rộng. `Continue` phải bắt đầu/resume attempt và đi thẳng vào Exam Room; không chèn thêm modal `Ready to begin`.
- Card phải gọn; title, metadata, progress và action không được cách nhau quá xa.
- Teacher Test Library card dùng anatomy `CardHeader → CardContent → CardFooter`: title và subject cùng hàng, mode là subtitle nằm sát title; question count, duration và source/updated time là các metadata row compact. Footer chỉ có một content action; lifecycle và duplicate nằm trong menu dấu ba chấm.
- Hiển thị question count, progress percentage, last attempt và score khi có dữ liệu thật.
- Các trạng thái dùng English: `Not started`, `In progress`, `Completed`.
- Khi attempt hoàn tất, học sinh xem được đáp án và giải thích ngay trong Score Report, Error Log và export, kể cả Quiz/Test được giao chưa tới hạn hoặc giáo viên chưa đóng bài. Không hiển thị trạng thái khóa đáp án sau khi hoàn thành. Luồng check-answer của practice cũng trả feedback ngay sau khi nộp câu trả lời.

### Error Log

- Error Log dùng working spreadsheet: `Category`, `Source`, `Correct`, `Yours`, `Why I chose wrong`, `Why answer is right`. Desktop dùng table tỷ lệ theo viewport; mobile xếp metadata và reflection theo chiều dọc. Không horizontal-scroll.
- Câu sai được backend tự động thêm ở trạng thái `Needs review` khi submission hoàn tất. Việc retry submit không được tạo entry trùng; manual entry chỉ phục vụ bài làm ngoài platform hoặc dữ liệu legacy. Source type phải dựa vào `origin`, không suy đoán từ việc relation Question hiện còn hay đã bị xóa.
- Click Source hệ thống mở cùng workspace với reflection: question context/choices/explanation bên trái, editor bên phải; mobile xếp câu hỏi trên editor. Chỉ tải context khi cần từ immutable snapshot; relation hiện tại chỉ là fallback cho legacy row chưa có snapshot. Click Source khi đang viết cùng entry phải giữ nguyên editor, draft và selection. Manual Source có name bắt buộc và http/https link tùy chọn; name có link được gạch chân, có external-link indicator và mở tab mới bằng noopener/noreferrer. Manual Source không link mở editor chi tiết.
- Hệ thống chỉ tự điền dữ liệu khách quan. Hai reflection luôn do học sinh tự nhập, không AI-prefill. `whyChosen`, `takeaway` và `rootCause` cũ được giữ như legacy data nhưng không xuất hiện, không được gửi lại và không tham gia search trong workflow mới.
- Error Log cuộn toàn bộ nội dung trang trong một scroll container; DataToolbar và column header không sticky, table/card không có vùng cuộn dọc riêng. DataToolbar chứa search, status chips có count và searchable category combobox. Workspace reflection có một hàng formatting, save feedback, `View question` và nút đóng; màn hình hẹp chỉ cuộn ngang nhóm formatting, giữ actions luôn thấy được. Inline link editor chỉ mở thêm khi cần. Vùng nhập không có box/viền riêng và phải phủ toàn bộ phần còn lại bên dưới bằng fill mode của shared RichTextEditor. Status của từng row dùng cột icon nhỏ ở đầu bảng, có accessible label và tooltip; không lặp badge trong Source.
- Chỉ một reflection editor được mount ngoài virtual rows và Quill được lazy-load khi bắt đầu edit. Read-only rich text phải memoize kết quả sanitize. Draft sống ngoài virtual row trong keyed registry; mỗi cell subscribe riêng để một keystroke không render lại page hoặc sibling rows.
- Reflection cell ở trạng thái nghỉ chỉ hiển thị content hoặc `Add reflection…`; click, Enter hoặc F2 mở vùng soạn thảo lớn mà không làm đổi chiều cao row. Workspace dùng shared non-modal Dialog được portal vào vùng dashboard hiện tại, nằm sát đáy viewport và không phụ thuộc chiều cao table/virtual cell anchor. Editor gọn rộng tối đa khoảng `768px`; `View question` mở rộng cùng surface và giữ nguyên editor. Không có title/source header hoặc shortcut helper hiển thị, nhưng vẫn giữ accessible title và nút đóng. Popup, vùng nhập và cell reflection không bo góc. Saving/Saved hiển thị trong workspace; Retry/conflict nằm trong editor đang mở. Click ngoài, Escape và nút đóng đều flush draft qua cùng close handler; Source/cell khác là chuyển trong workspace và không đóng trước khi chuyển.
- Reflection preview hiển thị full content theo chiều cao tự nhiên tới `320px` trên desktop và `288px` trên mobile, với nhịp dòng compact gần spreadsheet (`20px` cho body text 14px). Chỉ content thực sự vượt ngưỡng mới có fade cùng `Show more`; `Show less` thu lại về safety cap. Expansion được lưu theo cell ngoài virtual row, còn preview và chiều cao của cell active phải đóng băng trong lúc gõ để editor không làm row remeasure.
- Autosave 850ms và flush khi blur/exit; save phải nối tiếp theo từng row và gửi `expectedVersion` khi backend đã cung cấp version. Stale write `409` phải giữ cả draft và bản server, rồi yêu cầu học sinh chọn rõ `Use latest` hoặc `Keep mine` trước khi ghi tiếp. Reviewed chỉ được backend suy ra khi cả hai reflection có nội dung thật, không có control hoặc `markReviewed` write riêng.
- Keyboard workflow gồm Enter/F2 để edit, Ctrl/Cmd+B/I/U, Ctrl/Cmd+K, Ctrl/Cmd+Shift+7/8, Tab/Shift+Tab giữa reflection cells, Escape và Ctrl/Cmd+Enter để flush rồi thoát. Ở luồng nhập thường, Bold/Italic/Underline phải do keyboard module gốc của Quill xử lý để giữ pending format tại caret. Nếu shortcut xảy ra khi IME đang composition, editor phải queue từng toggle đến `compositionend` để bộ gõ tiếng Việt không nuốt command và phải giữ được nhiều inline format cùng lúc. Capture dispatcher chỉ giữ các command cấp ứng dụng như navigation, exit, link và list, đồng thời không được xử lý lặp inline shortcut. Link editor mở inline trong toolbar, giữ selection và trả focus về editor sau Apply/Cancel. Toolbar tooltip phải hiển thị shortcut.
- Chế độ table/card phải dựa trên chiều rộng thực của DataSurface, không chỉ viewport: khi vùng làm việc hẹp hơn khoảng `900px` thì chuyển sang stacked cards để không xuất hiện horizontal scroll khi sidebar đang mở.
- Desktop table dùng lightweight spreadsheet borders: header có bottom border rõ, mỗi body cell có bottom border nhẹ để đường ngang liên tục với virtualized rows, và chỉ thêm vertical divider tại các ranh giới semantic sau Category, Source, Yours và Why I chose wrong. Không dùng full dark grid hoặc tô màu cả row; hover dùng nền muted nhẹ. Viền active hai pixel phải phủ đúng toàn bộ TableCell, không chỉ khối preview bên trong; workspace dùng border hai pixel cùng màu neutral đậm `foreground/70`, không chồng thêm focus ring dày quanh vùng nhập.
- Search/status/category filters nằm trong cùng DataToolbar. Search dùng projection plain text do server duy trì, không quét rich HTML hoặc legacy field. Status counts và distinct categories lấy từ owner-scoped facets API thay vì suy ra từ page đang tải. Cursor tự fetch khi gần cuối bằng page scroll container; loading/error tiếp theo hiển thị ở cuối list, không có loaded counter hoặc Load more. Manual create gửi một `clientMutationId` ổn định trong suốt dialog retry. Không hiển thị Next SAT.

### Vocabulary

- Tra từ tại chỗ dùng shared Popover và Button: chọn một từ → `Look up`, hiển thị định nghĩa tiếng Anh theo loại từ, phiên âm/ví dụ khi có, `Show more`, loading/retry/empty và attribution Wiktionary/FreeDictionaryAPI.com/CC BY-SA 4.0. Bật trong RW Practice và question review ở Score Report/Error Log; Exam simulation, Math/LaTeX và reflection input không bật tra từ. Quyền tra từ độc lập với highlight/read-only. Popup phải collision-fit trong viewport, không đổi đáp án khi chọn chữ, giữ draft/editor đang mở, và nhận Escape trước parent dialog. Lazy editor không được lấy focus khỏi vùng chọn từ đã có trong question pane.

- Vocabulary dùng mental model `set-first, study-second`: chọn material trước, sau đó mới chọn Review hoặc Quiz. Không trình bày study mode như các feature card độc lập phía trên library.
- Page header chỉ có title và description. `Vocabulary sets` là section đầu tiên; `New set` là outline action của section, không phải CTA cạnh tranh trong header.
- Set card phải compact. Selected state dùng neutral `bg-muted`, border/ring nhẹ và `aria-pressed`; không invert thành solid primary/dark card. Chỉ hiển thị badge khi source/state cần phân biệt như `System`, `Assigned`, `Draft`.
- Set selector và selected summary không lặp description. Set đang chọn có một compact summary surface ngay dưới collection: title, learning-progress breakdown và action hierarchy dynamic `Continue studying` → `Learn N new` → `Review N learning` → `Review words` primary, `Take quiz` outline. Assign/Edit/Delete là contextual actions trong overflow menu theo capability thật.
- Mọi standard action trong Vocabulary dùng canonical shadcn `components/ui/button.tsx`; không dùng `AppUI.Button`, không tự override height/shadow cho primary/outline utility action. Study interaction đặc thù có thể tăng touch target nhưng vẫn phải render qua canonical Button.
- Set card hiển thị study continuity từ dữ liệu thật: exact studied count, progress bar mảnh cho coverage, mastered count và ngày học gần nhất. Không dùng coverage 100% để ngụ ý toàn bộ từ đã mastered. Selected summary dùng segmented bar trung tính để phân biệt Mastered, Learning và Not studied.
- Chỉ dùng `Continue studying`/`Continue quiz` khi có session `IN_PROGRESS`; mở một phạm vi mới phải cảnh báo rõ rằng session cũ sẽ được thay thế.
- Flashcard setup hỗ trợ `All words`, `Next 10 unstudied`, `Review learning` và `Custom range`; Quiz setup hỗ trợ range và mastery filter. Assigned activity luôn dùng snapshot/scope do giáo viên giao, không cho client âm thầm override bằng default cá nhân.
- Shuffle là toggle có state rõ bằng `aria-pressed`: bật sẽ tạo thứ tự ngẫu nhiên, tắt phải khôi phục chính xác thứ tự gốc của set. Thứ tự hiện tại được persist cùng session để reload/continue không làm thay đổi ngoài ý muốn; khi toggle phải giữ người học ở đúng card hiện tại.
- Flashcard hoàn tất phải có compact completion summary cho `Got it` và `Still learning`, giải thích `Got it` chỉ là self-rating, đồng thời tạo review loop cho đúng các từ vừa đánh dấu `Still learning`. Desktop hỗ trợ và hiển thị shortcut `Space`, Arrow keys, `1`, `2`, `P`; shortcut không được chiếm phím khi user đang nhập liệu.
- Words là `rich list` trong một `DataSurface`, không phải grid card. Desktop có header nhẹ `Word | Definition | Progress`; mỗi row phục vụ scan nhanh theo thứ tự word, Vietnamese translation, short definition, progress và optional last-reviewed metadata. Mobile ẩn header nhưng giữ cùng thứ tự nội dung.
- Search và progress filter nằm trong `DataToolbar`. Filter dùng shared Dropdown Menu; filtered-empty có `Clear filters`, pagination nằm trong footer của cùng surface.
- Click word mở shared right-side Sheet để progressive-disclose full definition, example, progress và last-reviewed date. Không render nút `View` lặp lại trên từng row.
- Không hiển thị due count, spaced-repetition schedule hoặc adaptive recommendation cho tới khi backend có canonical scheduling logic. Review/quiz session tiếp tục dùng dữ liệu và progress thật.

### Classroom Lessons

- `Lessons` là curriculum builder phân cấp, không phải dashboard, KPI surface, table hay collection card.
- Anatomy bắt buộc là `Week = bordered surface`, `Session = section row`, `Content = compact interactive row`; không bọc mỗi Session, resource, quiz hoặc homework trong Card riêng.
- Teacher/Admin mặc định xem curriculum ở read mode. Nút `Edit curriculum` mới bật contextual Add/Edit/Publish/Delete/Reorder; `Done` phải đưa màn hình về read mode và ẩn toàn bộ mutation controls. Student chỉ thấy published outline, content actions và completion phù hợp.
- `Published` là trạng thái mặc định và không cần lặp badge trên mọi row. Chỉ nhấn `Draft`, `Scheduled`, `Archived` hoặc effective visibility như `Hidden by week`.
- Week rỗng và Session rỗng dùng content-driven height; không reserve empty panel cao. `Add session` xuất hiện trong Week khi edit curriculum; `Add content` chỉ xuất hiện bên trong Session Workspace, không xuất hiện ở Lessons outline.
- Syllabus dài hỗ trợ Expand All và Collapse All. Không có Compact mode; outline dùng một mật độ ổn định để tránh layout thay đổi giữa các lần truy cập.
- Drag handle chỉ xuất hiện khi backend persist được order. Reorder phải có keyboard sensor và `Move up`/`Move down` fallback; không giả lập reorder chỉ ở client.
- Week và Session có canonical `order` riêng. Không cho drag xen kẽ Resource, TestDelivery, ClassActivity và LessonAssignment cho tới khi các loại content có chung ordering contract.
- Vùng Lessons tập trung ở `max-w-[1320px]`. Từ viewport `1400px`, dùng grid `minmax(0, 1fr) 280px` với gap `24px`; dưới ngưỡng này curriculum trở lại full-column.
- Right rail duy nhất được phép là `Course outline` sticky phục vụ navigation Week. Sticky phải đặt trên chính rail/grid item để nó bám viewport trong toàn bộ chiều cao curriculum. Nó có thể hiển thị số Session và trạng thái publication ngoại lệ, nhưng không được lặp KPI, performance, todo, announcement, chart hoặc nội dung của tab khác. Click Week phải scroll tới đúng Week và rail phải phản ánh Week hiện tại.
- Chỉ Week header dùng muted surface đủ rõ (`bg-section-header`); Week body vẫn là surface trắng. `Week NN` và `Session NN` là structural label `font-semibold`, đặt inline trước title bằng dấu `·` và không dùng muted text.
- Content phải thụt ít nhất 28px so với Session title và dùng connector cây cong, mảnh bằng semantic border token.
- Content row ưu tiên mật độ gọn: khoảng 36px cho một dòng và 44px khi có metadata; khoảng cách từ Session metadata tới content tree khoảng 8px.
- Content primary label dùng một dòng `Type: Title`; metadata chỉ mở dòng phụ khi có thông tin thật như duration, deadline, provider hoặc completion. Icon là glyph thuần `size-4`, không có box, border hoặc background riêng.

### Classroom Activities

- `Activities` là work-management view và chỉ có hai user-facing type: `Assignment` và `Test`. Backend `HOMEWORK` là compatibility name; không được hiển thị cho người dùng.
- Vocabulary, File, Link và Video là learning resources, không phải Activity. Không cho tạo mới `VOCABULARY` hoặc `RESOURCE` từ Add activity; legacy data được giữ nguyên và tiếp tục truy cập từ owning feature.
- `AssignmentComposer` và `AssignTestsComposer` là shared feature components dùng chung từ Activities và Lessons. Shared Delivery gồm availability, due date, audience và optional Week/Session placement.
- Assign Tests hỗ trợ multi-select. Một bulk action tạo N Test activities độc lập; không tạo một activity bundle và không ghi `Assignment.testIds[]` trong flow mới.
- Activity list hiển thị type, Week/Session placement, deadline, audience/completion summary và mở đúng destination: Test Performance hoặc Assignment Detail.
- Session Workspace là một màn hình duy nhất, không tách Build/Monitor tabs. Desktop dùng hai cột co giãn theo content viewport: bên trái là ba stage cố định `Before class → During class → After class`, bên phải là attendance management table sticky chỉ gồm học sinh và status; tablet/mobile xếp attendance xuống dưới. Mỗi attendance status phải có màu semantic riêng nhưng không phụ thuộc duy nhất vào màu để truyền đạt ý nghĩa.
- Session Workspace header hiển thị session title và một subtitle ngắn xác định đây là learning workspace; không lặp class/week metadata, Session overview hoặc Learning objective. Session create/edit không có overview field.
- Mỗi stage dùng compact interactive rows theo anatomy `Type: Title`. Click resource mở internal viewer, click Assignment/Test mở owning destination, còn Note mở nội dung theo progressive disclosure. Không render lại title/type trong nested card; PDF, image, text và allowlisted video chỉ render trong viewer, không bung trực tiếp dưới row.
- Session Workspace → Add content nằm trong đúng stage và chia `Learning material` thành các action rõ `Add note`, `Upload file`, `Add video`, `Add link`; `Student work` gồm Assignment và Test. Upload file hỗ trợ drag-and-drop, validate type/20 MB limit và progress; Composer mở tại chỗ với Session và stage được prefill.
- Internal resource viewer dùng short-lived authorized URL. PDF, image, text/CSV và YouTube/Vimeo/Loom được preview trong app; Office/unknown file fallback sang Download/Open original; arbitrary external links không được iframe.
- Lessons outline chỉ đọc content theo thứ tự stage/order đã lưu trong Session Workspace. Giáo viên phải mở Session để thêm, xóa, chuyển stage hoặc reorder content.
- Archive test trong Test Library không được làm mất quyền truy cập vào delivery đã Published; archive chỉ ảnh hưởng content library và việc tạo assignment mới.

### Classroom Announcements

- `Announcements` là class landing feed dùng chung cho Teacher và Student, đứng đầu tab order và là tab mặc định khi URL không chỉ định `?tab=`. Thứ tự Classroom là `Announcements → Lessons → Activities → Members`.
- Feed giới hạn khoảng `900–1000px`, left-aligned theo content container và dùng typography, spacing, separator thay cho một Card riêng cho từng post hoặc một giant outer Card. Header chỉ gồm title, description ngắn và CTA `New announcement` cho người có quyền.
- Mỗi row hiển thị neutral author avatar, author name, published timestamp, title, content và resources có thật. Không lặp megaphone icon trên từng row; icon này chỉ phù hợp cho empty state.
- Announcement rich text phải được sanitize trước khi render, link chỉ cho protocol an toàn và prose dài phải wrap được. Attachment và reference link dùng shared attachment anatomy cùng provider/file icon phù hợp.
- Teacher/Admin actions là Edit, Pin/Unpin và Delete qua menu dấu ba chấm. Pinned state phải persist ở `ClassAnnouncement`, tối đa năm item mỗi class; feed nhóm Pinned trước Recent và giữ newest-first trong từng nhóm.
- Class invite code thuộc Students section trong `Members`, không xuất hiện trong announcement feed. Loading, empty, error và selected/deep-link state phải giữ cùng feed width.

### Classroom Members

- `Members` là management/list view. Giữ Teachers và Students thành hai management table riêng trong `DataSurface`; không đổi roster thành member cards và không đưa analytics columns vào màn này.
- Chỉ render cột action khi người xem có ít nhất một action hợp lệ cho nhóm đó. Row action dùng shared ghost icon Button và `DropdownMenu`; không render dấu `—` trong một cột action không có chức năng.
- Member count cạnh section heading là metadata muted, không cạnh tranh hierarchy với heading. Avatar dùng shared neutral `Avatar`/`AvatarFallback`, trừ khi toàn app có một hệ thống màu avatar nhất quán.
- Student search chỉ xuất hiện khi roster đủ lớn và phải nằm trong `DataToolbar` của cùng `DataSurface`. Không thêm filter cho field chưa tồn tại trong dữ liệu thật; filtered-empty và roster-empty là hai state khác nhau.

### Assignment Detail

- Teacher và Student dùng chung page shell, metadata, instructions và resources; phần hành động thay đổi theo role thay vì duy trì hai màn hình không đồng nhất.
- Student dùng work rail `380–400px` sticky từ viewport `xl`; ở laptop, tablet và mobile rail chuyển thành full-width ngay dưới page header, trước instructions, để submission state/action không bị chìm. Rail phải giữ submission hiện tại sau refresh, cho phép edit/resubmit tới deadline, và hiển thị review gần nhất mà không làm mất dấu review cũ khi có resubmission mới.
- Student submission nhận written response, URL `http(s)` và managed file upload qua storage flow thật. UI phải giữ progress, retry/error, giới hạn attachment và phân biệt private draft với official submitted snapshot; không mô phỏng upload ở client.
- Submitted/reviewed mặc định là read-only. Nếu có private draft, hiển thị `Unsubmitted changes` với `Resume editing`/`Discard draft` thay vì tự mở editor. Chỉ có một submission status badge; teacher feedback không lặp badge `Reviewed`.
- Teacher dùng Student Work master-detail: list searchable/filterable bên trái và submission review bên phải. Không render toàn bộ submission thành nhiều card dài trong một trang.
- Teacher Assignment Detail tách `Overview` khỏi `Student work`. Link từ completion/review queue mở thẳng `Student work`; không đặt instructions phía trên grading workspace.
- `Overview | Student work` phải dùng shared page-level Tabs. Các modality động trong submission không dùng page Tabs; dùng compact source selector tích hợp trong viewer toolbar để chuyển giữa written response và file, còn external link mở ở tab mới.
- Teacher Student Work là reading workspace hai pane: student navigation khoảng `260–280px` và submission viewer chiếm toàn bộ phần còn lại. Review là contextual right-side Sheet `380–400px`, chỉ mở từ submission header và không trở thành fixed workspace column.
- Submission viewer render written response trực tiếp; PDF và image có inline preview cùng secondary action mở tab mới. External link, DOCX/PPTX/XLSX và định dạng browser không hỗ trợ dùng fallback rõ ràng, không iframe website tùy ý.
- Khi chọn student, viewer tự ưu tiên file đầu tiên, sau đó fallback về written response rồi links. Source selector chính là attachment navigation; không render thêm attachment list hoặc nhãn `Previewing` làm cùng một file xuất hiện hai lần.
- Submission status chỉ xuất hiện một lần ở viewer header. Review drawer dùng review timestamp/state metadata thay cho badge lặp lại, và không lặp stale-review warning đã có ở viewer.
- Review Sheet giữ mở khi auto-advance sang submission tiếp theo. Khi đóng Sheet có review chưa lưu, phải yêu cầu xác nhận trước khi bỏ thay đổi.
- Student list không lặp `No submission` và `Not submitted`. Summary phân biệt `pending` trước deadline với `missing` sau deadline. Sau khi review một item trong queue, ưu tiên chuyển sang submission `Needs review` tiếp theo.
- Grading là optional theo từng Assignment. `maxPoints = null` nghĩa là feedback-only; khi có `maxPoints`, score phải nằm trong `0..maxPoints`. Feedback vẫn optional và teacher có thể chỉ `Mark as reviewed`.
- Review state được suy ra từ timestamps: chưa nộp, missing sau deadline, needs review, hoặc reviewed. Resubmission sau `reviewedAt` phải quay lại review queue.
- Instructions, resources và submission là content surfaces dùng shared border/radius/token; không dùng KPI card, decorative icon box hoặc local modal/control variants.

## 9. Analytics

- Student Analytics là một diagnostic workspace cuộn liên tục, không phải một Overview thứ hai và không dùng tab giả. Range/subject filters cùng sticky anchor navigation phải giữ được bằng URL.
- Thứ tự nội dung là Focus Areas, Performance Snapshot, Study Consistency, Accuracy Trend, Skill Performance, Mistake Review, Pacing và Attempts. Focus Area chỉ xuất hiện khi đủ sample và phải có CTA thật tới breakdown hoặc Error Log.
- Study Consistency chỉ gọi dữ liệu là `Tracked focus time`: tính từ StudySession đã hoàn thành và có duration dương, không cộng Submission elapsed time hoặc Vocabulary wall-clock time. Section tải độc lập, dùng timezone IANA của browser để bucket ngày, range chung cho KPI, và giới hạn all-time calendar ở 365 ngày gần nhất với disclosure rõ. Subject filter không áp dụng cho section này.
- Study calendar dùng compact day cells, legend chữ và accessible summary; màu không được là tín hiệu duy nhất. Breakdown theo activity dùng progress/list, không suy diễn tương quan giữa số giờ học và điểm số.
- Accuracy không được gọi là SAT score. Trend dùng ngày, tên attempt, correct/total và subject thật; không dựng estimated score khi chưa có calibration.
- Skill performance theo hierarchy Subject → Domain → Skill. Dưới 5 câu là `Not enough data`, 5–9 là `Early signal`, từ 10 câu mới đủ điều kiện rank.
- Error Log chỉ được tổng hợp và deep-link bằng category/review status; reflection vẫn thuộc Error Log. Pacing chỉ dùng QuestionTiming của submission EXAM đã hoàn thành, luôn nêu số câu và coverage, không biến missing timing thành zero.
- Attempts chỉ chứa submission `COMPLETED`; bài `DOING` thuộc Overview/Continue Learning. Activity Heatmap không xuất hiện cho đến khi có telemetry thống nhất bao phủ Practice, Error Log, Vocabulary và Homework.
- Giáo viên dùng bố cục Test Performance: KPI strip, Question Performance Breakdown và Student Rankings.
- Không dùng số liệu giả. Empty state tốt hơn dữ liệu demo. Reading & Writing và Math phải có label cùng semantic chart colors, không phụ thuộc màu là tín hiệu duy nhất.
- Ngày phải chuẩn hóa UTC ở backend; table header nhỏ, row gọn và có hover rất nhẹ.

## 10. Responsive và accessibility

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

## 11. Quy tắc dữ liệu và trạng thái

- Luôn dùng dữ liệu thật từ API.
- Phải có loading, empty, error và disabled state.
- Không hiển thị `0%`, `0 questions` hoặc placeholder sai nếu API chưa tải xong; dùng skeleton/loading state.
- Không tính score, progress hay thời gian khác với logic backend.
- Không dùng thời gian local của server cho logic nghiệp vụ. Lưu và so sánh thời gian bằng UTC; chỉ format timezone khi hiển thị.

## 12. Checklist trước khi hoàn thành

- [ ] Đã đối chiếu màn hình Studio Admin tương ứng trong `projects/docs/DESIGN_MIGRATION.md`.
- [ ] Dùng đúng font, màu, radius và spacing trong tài liệu này.
- [ ] Không thêm hex, arbitrary radius, arbitrary shadow hoặc type size cục bộ khi token hiện có đáp ứng được.
- [ ] Không tự dựng lại Button/Input/Select/Modal/Tabs/Card/Table/Badge/Toast/EmptyState.
- [ ] Popup modal/dialog đóng được bằng click/tap bên ngoài; thao tác bên trong không đóng popup và vẫn giữ xác nhận thay đổi chưa lưu.
- [ ] Không còn primary indigo/purple/SAT green hoặc radius quá lớn ngoài trường hợp có chủ ý trong neutral pass.
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
