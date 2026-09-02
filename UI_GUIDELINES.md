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

- `Button`: chỉ dùng variant `primary`, `outline`, `accent`, `ghost`, `destructive`; size `sm`, `md`, `lg`, `icon`.
- `Input` và `Select`: cao `36px`, focus ring primary; label/helper/error nằm ngoài control và dùng typography chuẩn.
- `Modal`: dùng `presentation="content-dialog"` trong dashboard; có title, nút đóng, Escape, focus trap và restore focus. Không tự dựng overlay.
- `Tabs`: bắt buộc cho chuyển đổi panel cùng trang; có `tablist/tab/tabpanel`, Arrow keys, Home/End. Link điều hướng sang route khác không phải Tabs.
- `Collapsible`: dùng cho outline có nhiều section được mở đồng thời; trigger phải có accessible name và controlled state khi page có Expand/Collapse All.
- `Card`: surface nội dung mặc định. Không biến mọi section thành card nếu hierarchy không cần.
- `Table`: management table luôn nằm trong `DataSurface`; `Table` tự chịu horizontal overflow; dùng các table primitives cho header/row/cell. `TableShell` chỉ là compatibility alias trong thời gian migration.
- `Badge`: chỉ thể hiện metadata/status, không dùng thay button.
- `Toast`: success 3 giây, error 5 giây, mặc định 4 giây; không chứa thao tác nghiệp vụ bắt buộc.
- `EmptyState`: luôn có title; description giải thích bước tiếp theo; action chỉ thêm khi người dùng có hành động hợp lệ.

- Trong dashboard có sidebar cố định bên trái, modal/panel thuộc một page phải được giới hạn trong vùng nội dung bên phải và không phủ, làm tối hoặc dịch chuyển sidebar. Dùng `Modal` với `presentation="content-dialog"` cho popup của page; variant này phải portal vào `document.body` và offset theo chiều rộng sidebar để không bị ancestor có `transform`, animation hoặc overflow làm lệch vị trí. Popup vẫn phải có khoảng đệm, backdrop và kích thước dialog bình thường. Chỉ dùng `presentation="content-panel"` khi người dùng thực sự yêu cầu một màn hình chi tiết phủ kín vùng nội dung.

## 4. Header và bố cục trang

- Dashboard header cao `48px`, sticky khi phù hợp, có border dưới và blur nhẹ có kiểm soát như Studio Admin.
- Sidebar desktop mặc định khoảng `272px`, hỗ trợ mobile sheet; content phải dùng được khi sidebar thu gọn.
- Avatar, notification và account controls nằm bên phải header theo reference.
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

- Chiều cao button mặc định: `36px`; button lớn tối đa khoảng `40px`.
- Primary button dùng semantic primary neutral; không hardcode màu.
- Secondary button dùng surface, border và foreground semantic.
- Accent button chỉ dùng cho hành động có chủ ý rõ ràng; không dùng màu thương hiệu tùy tiện trong neutral pass.
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
- Card phải gọn; title, metadata, progress và action không được cách nhau quá xa.
- Teacher Test Library card dùng anatomy `CardHeader → CardContent → CardFooter`: title và subject cùng hàng, mode là subtitle nằm sát title; question count, duration và source/updated time là các metadata row compact. Footer chỉ có một content action; lifecycle và duplicate nằm trong menu dấu ba chấm.
- Hiển thị question count, progress percentage, last attempt và score khi có dữ liệu thật.
- Các trạng thái dùng English: `Not started`, `In progress`, `Completed`.

### Classroom Lessons

- `Lessons` là curriculum builder phân cấp, không phải dashboard, KPI surface, table hay collection card.
- Anatomy bắt buộc là `Week = bordered surface`, `Session = section row`, `Content = compact interactive row`; không bọc mỗi Session, resource, quiz hoặc homework trong Card riêng.
- Teacher/Admin mặc định xem curriculum ở read mode. Nút `Edit curriculum` mới bật contextual Add/Edit/Publish/Delete/Reorder; `Done` phải đưa màn hình về read mode và ẩn toàn bộ mutation controls. Student chỉ thấy published outline, content actions và completion phù hợp.
- `Published` là trạng thái mặc định và không cần lặp badge trên mọi row. Chỉ nhấn `Draft`, `Scheduled`, `Archived` hoặc effective visibility như `Hidden by week`.
- Week rỗng và Session rỗng dùng content-driven height; không reserve empty panel cao. `Add session` và `Add content` phải xuất hiện tại đúng parent context.
- Syllabus dài hỗ trợ Compact, Expand All và Collapse All. Đây là client preference theo class, không phải shared curriculum data.
- Drag handle chỉ xuất hiện khi backend persist được order. Reorder phải có keyboard sensor và `Move up`/`Move down` fallback; không giả lập reorder chỉ ở client.
- Week và Session có canonical `order` riêng. Không cho drag xen kẽ Resource, TestDelivery, ClassActivity và LessonAssignment cho tới khi các loại content có chung ordering contract.
- Vùng Lessons tập trung ở `max-w-[1320px]`. Từ viewport `1400px`, dùng grid `minmax(0, 1fr) 280px` với gap `24px`; dưới ngưỡng này curriculum trở lại full-column.
- Right rail duy nhất được phép là `Course outline` sticky phục vụ navigation Week. Sticky phải đặt trên chính rail/grid item để nó bám viewport trong toàn bộ chiều cao curriculum. Nó có thể hiển thị số Session và trạng thái publication ngoại lệ, nhưng không được lặp KPI, performance, todo, announcement, chart hoặc nội dung của tab khác. Click Week phải scroll tới đúng Week và rail phải phản ánh Week hiện tại.
- Chỉ Week header dùng muted surface đủ rõ (`bg-section-header`); Week body vẫn là surface trắng. `Week NN` và `Session NN` là structural label `font-semibold`, đặt inline trước title bằng dấu `·` và không dùng muted text.
- Content phải thụt ít nhất 28px so với Session title và dùng connector cây cong, mảnh bằng semantic border token. `Add content` nằm trên cùng tree branch với các content item.
- Content row ưu tiên mật độ gọn: khoảng 36px cho một dòng và 44px khi có metadata; khoảng cách từ Session metadata tới content tree khoảng 8px.
- Content primary label dùng một dòng `Type: Title`; metadata chỉ mở dòng phụ khi có thông tin thật như duration, deadline, provider hoặc completion. Icon là glyph thuần `size-4`, không có box, border hoặc background riêng.

### Classroom Activities

- `Activities` là work-management view và chỉ có hai user-facing type: `Assignment` và `Test`. Backend `HOMEWORK` là compatibility name; không được hiển thị cho người dùng.
- Vocabulary, File, Link và Video là learning resources, không phải Activity. Không cho tạo mới `VOCABULARY` hoặc `RESOURCE` từ Add activity; legacy data được giữ nguyên và tiếp tục truy cập từ owning feature.
- `AssignmentComposer` và `AssignTestsComposer` là shared feature components dùng chung từ Activities và Lessons. Shared Delivery gồm availability, due date, audience và optional Week/Session placement.
- Assign Tests hỗ trợ multi-select. Một bulk action tạo N Test activities độc lập; không tạo một activity bundle và không ghi `Assignment.testIds[]` trong flow mới.
- Activity list hiển thị type, Week/Session placement, deadline, audience/completion summary và mở đúng destination: Test Performance hoặc Assignment Detail.
- Lessons → Add content chia `Student work` (Assignment, Test) và `Learning material` (File, Link, Video). Composer mở tại chỗ với Session được prefill, không điều hướng giáo viên sang tab khác.
- Archive test trong Test Library không được làm mất quyền truy cập vào delivery đã Published; archive chỉ ảnh hưởng content library và việc tạo assignment mới.

## 9. Analytics

- Bám sát `dashboard/analytics` và `dashboard/default`: KPI strip, Score Progress, Activity Heatmap, Section Performance và Recent Activity.
- Giáo viên dùng bố cục Test Performance: KPI strip, Question Performance Breakdown và Student Rankings.
- Không dùng số liệu giả. Empty state tốt hơn dữ liệu demo.
- Reading & Writing và Math phải phân biệt bằng label/icon cùng semantic chart colors; không phụ thuộc màu là tín hiệu duy nhất.
- Ngày và heatmap phải xử lý UTC ở backend để không phụ thuộc timezone của Vercel/Render.
- Table header nhỏ, uppercase khi phù hợp; row gọn và có hover rất nhẹ.

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
