# SAT Platform — Architecture & Workflow Documentation

## 1. Project Overview

A Digital SAT Test Preparation Platform built as a client-server monorepo. Supports students taking practice/exam tests, teachers managing classes and assignments, AI-powered question generation/evaluation, and real-time notifications.

---

## 2. Tech Stack

| Layer | Technology |
|---|---|
| Backend | Node.js + Express.js 5 (CommonJS) |
| Database | PostgreSQL + Prisma ORM 5 |
| Frontend | React 19 + TypeScript 5.9 + Vite 7 |
| Styling | Tailwind CSS 3 |
| State | Zustand 5 + React Context |
| HTTP Client | Axios |
| Auth | JWT + Google OAuth |
| AI | Google Gemini API |
| Real-time | Server-Sent Events (SSE) |
| File Upload | Multer (memoryStorage) |

---

## 3. Project Structure

```
sat-platform/
├── client/                     # React + TypeScript frontend
│   └── src/
│       ├── main.tsx            # Vite entry point
│       ├── app/
│       │   ├── App.tsx         # Root component + React Router routes
│       │   └── providers/      # Auth, Google OAuth providers
│       ├── pages/              # 11 page directories
│       ├── components/         # Shared UI components
│       ├── hooks/              # Custom React hooks
│       ├── lib/                # Axios client, utilities
│       ├── stores/             # Zustand stores
│       └── types/              # TypeScript type definitions
│
└── server/                     # Node.js + Express backend
    ├── index.js                # Server entry point (port 5000)
    ├── prisma/
    │   └── schema.prisma       # Database schema
    └── src/
        ├── app.js              # Express app setup (CORS, routes, middleware)
        ├── routes/             # Route definitions per domain
        ├── controllers/        # Request handlers (thin layer)
        ├── services/           # Business logic layer
        ├── middleware/         # Auth middleware (JWT + role checks)
        ├── config/             # CORS, JWT, Prisma singleton
        └── utils/              # ApiError class, helpers
```

---

## 4. Architecture: Request Flow

```
Client Browser
     │
     ▼
React Router (App.tsx) ─── 11 Page Components
     │
     ▼
Axios Client (lib/axios.ts)
  ├─ Auto-attaches Bearer JWT from localStorage
  └─ Auto-redirects to /auth on 401
     │
     ▼
Vite Dev Proxy (/api → localhost:5000)
     │
     ▼
Express Server (index.js → app.js)
     │
     ├── CORS middleware
     ├── JSON body parser
     │
     ├── PUBLIC (no auth):
     │   POST /api/register
     │   POST /api/login
     │   POST /api/auth/google-login
     │
     └── PROTECTED (JWT required):
         authenticateToken middleware
              │
              ▼
         authorizeRole(roles) middleware  [where needed]
              │
              ▼
         Controller  ── validates input, delegates to service
              │
              ▼
         Service  ── business logic, DB queries, AI calls
              │
              ▼
         Prisma ORM → PostgreSQL
```

### Key Patterns

- **3-layer**: Routes → Controllers → Services → Database. Services never touch `req`/`res`.
- **Error handling**: Services throw `ApiError(statusCode, { message })`. Controllers catch and return `{ success: false, error }`.
- **Authorization**: Every protected service function verifies the requesting user owns the resource or has the correct role.
- **SSE Notifications**: In-memory `Map<userId, Set<Response>>` maintains active connections; events are pushed in real-time and persisted to DB.

---

## 5. Complete API Endpoint Reference

### 5.1 Authentication (public)

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/register` | None | Register new user (email, password, name, role) |
| `POST` | `/api/login` | None | Login with email + password, returns JWT |
| `POST` | `/api/auth/google-login` | None | Login with Google OAuth token, returns JWT |

### 5.2 Classes

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/classes` | JWT | Get user's classes (teacher → taught, student → enrolled) |
| `GET` | `/api/classes/:id` | JWT | Get class detail (teacher, students, assignments, submissions) |
| `GET` | `/api/classes/list` | JWT | Get exam tests for a class (query: `classId`) |
| `GET` | `/api/classes/:id/score-report` | JWT + TEACHER/ADMIN | Score report assignments for a class |
| `GET` | `/api/classes/:testId/report` | JWT + TEACHER/ADMIN | Test analytics (leaderboard, question stats) |
| `POST` | `/api/classes` | JWT + TEACHER/ADMIN | Create a new class |
| `POST` | `/api/classes/:classId/students` | JWT + TEACHER/ADMIN | Add student by email |
| `GET/POST` | `/api/classes/:classId/announcements` | JWT / JWT + TEACHER/ADMIN | List or publish class announcements from the dedicated announcement source |
| `PATCH/DELETE` | `/api/classes/:classId/announcements/:announcementId` | JWT + TEACHER/ADMIN | Edit or delete an announcement |
| `POST` | `/api/classes/posts` | JWT + TEACHER/ADMIN | Legacy compatibility endpoint; announcements are routed to the dedicated source |
| `POST` | `/api/classes/submissions` | JWT + STUDENT | Compatibility submission endpoint; delegates to the canonical Assignment submission flow |

### 5.3 Assignments

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/assignments/:id` | JWT | Get a role-scoped assignment detail; students receive only their own submission and review |
| `PUT` | `/api/assignments/:id` | JWT + owning TEACHER | Update assignment content, deadline, resources, and optional maximum points |
| `DELETE` | `/api/assignments/:id` | JWT | Delete assignment (teacher only) |
| `PUT` | `/api/assignments/:id/submission` | JWT + STUDENT | Legacy compatibility command that creates a draft and submits it |
| `GET` | `/api/assignments/:id/my-submission` | JWT + STUDENT | Read the student's submitted snapshot and private working draft |
| `PATCH/DELETE` | `/api/assignments/:id/my-submission/draft` | JWT + STUDENT | Autosave or discard the private working draft |
| `POST` | `/api/assignments/:id/my-submission/edit` | JWT + STUDENT | Copy the official snapshot into an editable draft |
| `POST/DELETE` | `/api/assignments/:id/my-submission/draft/items[/:itemId]` | JWT + STUDENT | Add or remove managed files and external links in a draft |
| `POST` | `/api/assignments/:id/my-submission/submit` | JWT + STUDENT | Atomically promote a draft and complete the canonical activity |
| `GET` | `/api/assignments/:id/student-work` | JWT + owning TEACHER/ADMIN | Search, filter, summarize, and cursor-page the assigned student review queue |
| `GET` | `/api/assignments/:id/student-work/:studentId` | JWT + owning TEACHER/ADMIN | Get one assigned student's latest submission and review state |
| `PATCH` | `/api/assignments/:id/student-work/:studentId/review` | JWT + owning TEACHER/ADMIN | Save optional points and/or feedback, or mark a submission reviewed |

### 5.4 Practice Tests & Exam Room

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tests` | JWT | List available tests (public, class-assigned, own) |
| `GET` | `/api/tests/classes` | JWT | Get classes for test assignment dropdown |
| `POST` | `/api/tests/create` | JWT + TEACHER/ADMIN | Create a Draft or Published test with sections and questions |
| `GET` | `/api/tests/:id/content` | JWT + TEACHER/ADMIN | Read owned or published system test content without creating an attempt |
| `POST` | `/api/tests/:id/duplicate` | JWT + TEACHER/ADMIN | Duplicate an accessible test into an owned Draft |
| `POST` | `/api/tests/:id/copy-to-system` | JWT + ADMIN | Copy a Teacher-owned Personal test into a platform-owned System Draft |
| `PATCH` | `/api/tests/:id/status` | JWT + TEACHER/ADMIN | Publish, archive, or restore an owned test |
| `GET` | `/api/class-activities/class/:classId` | JWT | List canonical Assignment and Test activities; staff also receive participation and outcome summaries while students receive only their own assignee state |
| `GET` | `/api/class-activities/class/:classId/results` | JWT + TEACHER/ADMIN | Compatibility projection for older clients; derived from the canonical Activities summary without a separate query path |
| `POST` | `/api/class-activities/assignments` | JWT + TEACHER/ADMIN | Publish an Assignment to all or selected students, optionally linked to a lesson |
| `POST` | `/api/class-activities/homework` | JWT + TEACHER/ADMIN | Compatibility alias for Assignment creation; new clients must use `/assignments` |
| `POST` | `/api/test-deliveries` | JWT + TEACHER/ADMIN | Bulk-publish one or more tests; one request creates one independent TestDelivery and ClassActivity per selected test |
| `GET` | `/api/test/:id` | JWT | Start or resume a test session |
| `POST` | `/api/test/:id/save-progress` | JWT | Auto-save answers, time, current question |
| `POST` | `/api/test/:id/submit` | JWT | Submit test → auto-grade → store results → notify teacher |

### 5.5 Test Bank (Folders)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/bank` | JWT | Get root folder contents |
| `GET` | `/api/bank/:folderId` | JWT | Get folder contents (sub-folders + tests) |
| `GET` | `/api/bank/folders/all` | JWT | Get all user folders (flat list) |
| `POST` | `/api/bank/folders` | JWT | Create a folder |
| `DELETE` | `/api/bank/delete` | JWT | Delete folders and/or tests (owner-checked) |
| `PUT` | `/api/bank/move` | JWT | Move folders/tests to another folder |

### 5.6 Progress (Class Weeks & Lessons)

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/progress/class/:classId/weeks` | JWT | Get weeks with nested lessons, files, assignments |
| `GET` | `/api/progress/class/:classId/outline` | JWT | Get the lightweight Week/Session outline used by shared activity placement controls |
| `POST` | `/api/progress/class/:classId/weeks` | JWT | Create a week (teacher only) |
| `PUT` | `/api/progress/class/:classId/weeks/reorder` | JWT | Persist the complete week order (owning teacher/admin only) |
| `PUT` | `/api/progress/weeks/:weekId` | JWT | Update week details and visibility (owning teacher/admin only) |
| `DELETE` | `/api/progress/weeks/:weekId` | JWT | Delete week and unlink its published activities (teacher only) |
| `POST` | `/api/progress/weeks/:weekId/lessons` | JWT | Create lesson (teacher only) |
| `PUT` | `/api/progress/weeks/:weekId/lessons/reorder` | JWT | Persist the complete lesson order within one week (owning teacher/admin only) |
| `PUT` | `/api/progress/lessons/:lessonId` | JWT | Update lesson details, schedule, and visibility (owning teacher/admin only) |
| `DELETE` | `/api/progress/lessons/:lessonId` | JWT | Delete lesson and unlink its published activities (teacher only) |
| `POST` | `/api/progress/lessons/:lessonId/files` | JWT | Add files to lesson (teacher only) |
| `DELETE` | `/api/progress/files/:fileId` | JWT | Delete file (teacher only) |
| `POST` | `/api/progress/lessons/:lessonId/assignment` | JWT | Create/update lesson assignment (teacher only) |
| `DELETE` | `/api/progress/assignments/:assignmentId` | JWT | Delete lesson assignment (teacher only) |

### 5.7 Results Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/results-analytics` | JWT + STUDENT | Analytics data (charts + history) for past N days |
| `GET` | `/api/results-analytics/submission/:id` | JWT + STUDENT | Detailed submission with every question/answer |

### 5.8 Error Logs

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/error-logs` | JWT | Get user's error logs (wrong answers) |
| `POST` | `/api/error-logs` | JWT | Create new error log entry |
| `PUT` | `/api/error-logs/:id` | JWT | Update error log (owner-checked) |
| `DELETE` | `/api/error-logs/:id` | JWT | Delete error log (owner-checked) |

### 5.9 AI Features

| Method | Path | Auth | Description |
|---|---|---|---|
| `POST` | `/api/ai/chat` | JWT | SSE stream — AI tutor explains questions |
| `POST` | `/api/ai-parser` | JWT | Upload PDF/DOCX → AI parses & formats SAT questions |
| `POST` | `/api/challenge/generate` | JWT | Generate an AI-created SAT question |
| `POST` | `/api/challenge/evaluate` | JWT | AI evaluates student's answer reasoning |

### 5.10 Notifications

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/notifications/stream` | JWT | SSE stream for real-time notifications |
| `GET` | `/api/notifications` | JWT | Get last 50 notifications |
| `PUT` | `/api/notifications/read-all` | JWT | Mark all notifications as read |

### 5.11 Admin Overview

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/admin/overview?range=7d\|30d\|90d` | JWT + ADMIN | Platform KPI summary, actionable published System Test integrity issues, test lifecycle counts, and classroom snapshot |
| `GET` | `/api/admin/overview/activity?range=7d\|30d\|90d` | JWT + ADMIN | Zero-filled Test Attempts, Completed Tests, and Students Taking Tests time series |
| `GET` | `/api/admin/audit-events?limit=8&cursor=...` | JWT + ADMIN | Cursor-paginated, display-safe recent product activity |

Admin Overview uses complete platform days in the configured `APP_TIMEZONE`. It deliberately reports Total Classrooms rather than inferring an active/inactive lifecycle that the current Class model does not yet store. Student Error Logs, ordinary Draft tests, and transient imports are not treated as operational alerts. Recent Activity begins with real post-migration AuditEvent mutations and is not synthesized from entity timestamps.

### 5.12 Student Overview

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/student/overview` | JWT + STUDENT | Student-focused next action, score/date preferences, 90-day accuracy progress, published System Test picks, and recent completed results |
| `GET` | `/api/student/tasks` | JWT + STUDENT | Unified personal tasks, announcements, assignments, tests, and vocabulary activities with calendar and weekly summary data |
| `POST/PATCH/DELETE` | `/api/student/tasks[/:id]` | JWT + STUDENT | Create, edit, and remove student-owned personal tasks |
| `PUT` | `/api/student/tasks/state` | JWT + STUDENT | Complete or reopen personal tasks and announcements; assessed coursework remains source-driven |
| `PUT` | `/api/student/tasks/order` | JWT + STUDENT | Persist a student-specific order across unified task sources |

Student Overview uses only persisted product data. Coursework and personal planning are combined in a Productivity-style task surface. Assignment, test, and vocabulary completion comes from their authoritative submission/activity records; only personal tasks and announcements can be checked directly. Accuracy remains evidence-based, while current and target SAT scores are explicitly self-reported preferences.

### 5.13 Teacher Overview

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/api/teacher/overview?classId=all\|:classId` | JWT + TEACHER | Action-first teaching workflow with deadline attention, upcoming dates, 30-day class pulse, and evidence-based student check-in signals |
| `GET` | `/api/teacher/overview/insights?classId=all\|:classId&range=7d\|30d\|90d` | JWT + TEACHER | Independently loaded domain and skill accuracy from score-policy-selected classroom test attempts |

Teacher Overview only exposes classes owned by the authenticated teacher. Core workflow data and answer-level learning insights load independently so analytics failures do not hide deadlines or classroom status. Check-in suggestions use explicit overdue, inactivity, or sustained score-decline rules; the page does not invent a manual grading queue for auto-scored activities.

### 5.14 Managed Files

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/files/uploads` | JWT + assigned STUDENT | Create a pending private file asset and a short-lived S3-compatible upload URL |
| `POST` | `/api/files/:fileAssetId/complete` | JWT + owner | Verify object metadata and mark an upload ready |
| `GET` | `/api/files/:fileAssetId/access` | JWT + authorized owner/staff | Create a short-lived read URL after checking assignment access |

Managed file records store object keys, never signed URLs. `HomeworkSubmissionContent` separates the student's private `DRAFT` from the official `SUBMITTED` snapshot; teachers only read the latter. External links remain `HomeworkSubmissionItem(kind=LINK)` and do not become managed files.

Storage maintenance uses `npm run storage:cleanup`; real bucket verification uses the explicitly gated `npm run storage:smoke`. Environment separation, Render Cron setup, R2 lifecycle guidance, and operational response are documented in `projects/docs/STORAGE_OPERATIONS.md`.

**Total: 55+ endpoints**

---

## 6. Database Models & Relationships

### Entity-Relationship Diagram (conceptual)

```
User ──1:N── Class (teacherId)          [taughtClasses]
User ──M:N── Class (via enrollment)     [studyingClasses]
User ──1:N── ErrorLog
User ──1:N── Notification
User ──1:N── Folder
User ──1:N── Test (authorId)
User ──1:N── Submission
User ──1:N── HomeworkSubmission
User ──1:N── AuditEvent (actorUserId, set null on actor deletion)

Class ──1:N── Assignment
Class ──1:N── ClassAnnouncement
Class ──1:N── Week
Class ──1:N── ClassTest (join table)

ClassTest ──1:N── Submission

Assignment ──1:N── HomeworkSubmission
Assignment ──1:N── Submission

Test ──1:N── Section
Test ──1:N── ClassTest
Test ──1:N── Submission
Test ──M:1── Folder

Section ──1:N── Question
Question ──1:N── Answer

Week ──1:N── Lesson
Lesson ──1:N── LessonFile
Lesson ──1:1── LessonAssignment

Folder ──1:N── Folder (self-referencing: parentId → children SubFolders)
Folder ──1:N── Test
```

### Key Model Details

**User**: `id`, `email` (unique), `password` (nullable for Google login), `name`, `role` (STUDENT | TEACHER | ADMIN), `avatar`, `createdAt`

**HomeworkSubmission**: one student/assignment aggregate with optional review data and at most one `DRAFT` plus one `SUBMITTED` content slot. Content holds optional text and ordered `HomeworkSubmissionItem` records. `FILE` items reference a private, verified `FileAsset`; `LINK` items store a validated external URL.

**Class**: `id` (UUID), `name`, `teacherId` (FK → User), `createdAt`

**Assignment**: `id` (UUID), `title`, `content`, `fileUrls[]`, `links[]`, `testIds[]`, `deadline`, `classId` (FK → Class, cascade)

**Test**: `id`, `title`, `description`, `duration` (default 64 min), `mode` (PRACTICE | EXAM), `status` (DRAFT | PUBLISHED | ARCHIVED), `scope` (SYSTEM | PERSONAL), `category` (REAL | CLASS | PRACTICE), transitional `isPublic`, `subject` (RW | MATH), `authorId` (creator attribution, FK → User), `folderId` (Personal tests only, FK → Folder), `createdAt`, `updatedAt`

**Submission**: `id`, `userId`, `testId`, `assignmentId`, `classTestId`, `savedAnswers` (JSON), `timeRemaining`, `currentQuestionIndex`, `score`, `violationCount`, `status` (DOING | COMPLETED), `startedAt`, `endTime`

**Question**: `id`, `sectionId`, `type` (MCQ | SPR), `blocks` (JSON content), `questionText`, `choices` (JSON), `correctAnswer`, `explanation`, `order`

**Answer**: `id`, `submissionId`, `questionId`, `selectedChoice`, `isCorrect`

**AuditEvent**: durable product-domain mutation history with `action`, `category`, optional actor reference plus actor snapshot, entity identity/label snapshot, allowlisted metadata, and `createdAt`. `AdminAuditLog` remains separate for privileged Admin CLI security operations. Submission analytics and raw operational errors are not duplicated into AuditEvent.

**Enums**: `Role` (STUDENT, TEACHER, ADMIN), `TestMode` (PRACTICE, EXAM), `TestStatus` (DRAFT, PUBLISHED, ARCHIVED), `TestScope` (SYSTEM, PERSONAL), `TestCategory` (REAL, CLASS, PRACTICE), `TestSubject` (RW, MATH), `SubmissionStatus` (DOING, COMPLETED), `QuestionType` (MCQ, SPR)

---

## 7. Frontend Routes (React Router v7)

| Path | Page Component | Description |
|---|---|---|
| `/` | HomePage | Public landing page |
| `/auth` | AuthPage | Login / Register |
| `/dashboard/practice-test` | PracticeTest | Test listing & filters |
| `/dashboard/practice-test/my-bank/:folderId?` | TestBank | Folder-based test organization |
| `/dashboard/practice-test/create` | CreateTestWizard | Multi-step test creation |
| `/dashboard/class/:classId` | Classroom | Lessons, canonical activities with teacher result summaries, members, and announcements |
| `/dashboard/class/:classId/assignment/:assignmentId` | AssignmentDetail | View/submit homework |
| `/dashboard/error-log` | ErrorLog | Wrong answer tracking |
| `/dashboard/results-analytics` | ResultAnalytics | Performance charts & history |
| `/test/:id` | ExamRoom | Full-screen test taking interface |
| `/score-report` | ScoreReport | Post-submission score breakdown |

---

## 8. Key Workflows

### 8.1 Test Taking Flow

```
1. Student navigates to /dashboard/practice-test
2. GET /api/tests → lists all available tests (public, class-assigned, own)
3. Student clicks "Start" → navigates to /test/:testId
4. GET /api/test/:id → creates/finds Submission (status=DOING), returns test data + saved progress
5. Student answers questions; auto-save triggers periodically:
   POST /api/test/:id/save-progress → updates savedAnswers, currentQuestionIndex, timeRemaining
6. Student clicks "Submit":
   POST /api/test/:id/submit → grades all answers, stores in Answer table, sets status=COMPLETED
   → Auto-syncs score to any linked Assignment/ClassTest
   → Sends notification to teacher (if class-assigned)
7. Student views results at /score-report or /dashboard/results-analytics
```

### 8.2 Class Management Flow (Teacher)

```
1. Teacher creates class: POST /api/classes
2. Teacher adds students by email: POST /api/classes/:classId/students
3. Teacher creates announcements/homework posts: POST /api/classes/posts
   → Can attach files (fileUrls) and external links; tests are delivered only through Classroom Activities
   → Sends notification to the selected class audience
4. Teacher views class detail: GET /api/classes/:id
   → Shows students, assignments, submissions per student
5. Teacher opens a Test activity performance report
   → GET /api/test-deliveries/:deliveryId/performance returns completion, leaderboard, and question analytics
6. Teacher manages weekly lessons: Progress API (Weeks → Lessons → Files/Assignments)
```

### 8.3 Teacher Test Library and Classroom Delivery

```text
1. Teacher creates or edits content in Test Library.
2. Save draft keeps the test private and unavailable for delivery.
3. Publish test makes it selectable from the shared Assign Tests composer in Test Library, Classroom Activities, or Lessons.
4. The composer lists Published My Tests and Published System Tests and supports multi-select.
5. Teacher configures availability, deadline, attempts, score policy, audience, and optional Session placement once.
6. POST /api/test-deliveries creates one TestDelivery + canonical ClassActivity + assignees and notifications per selected test in one transaction.
7. Classroom Activities owns completion/performance; Test Library never displays student attempt state.
8. Archiving prevents new delivery but preserves existing deliveries and student access/history.
9. Assignment is a separate activity type. New Assignment flows never write tests into legacy Assignment.testIds[].
```

### 8.4 Admin Test Management

```text
1. Admin opens Test Management; System Library is the default collection.
2. SYSTEM tests are platform-owned. Any Admin can manage them; authorId records who created the row.
3. Admin-created tests and duplicates are SYSTEM Drafts until published.
4. Teacher Tests lists PERSONAL tests created by Teachers and is read-only for Admin.
5. Copy to System Library creates a new SYSTEM Draft and preserves the Teacher-owned original.
6. Tests with classroom or attempt history cannot be structurally edited or permanently deleted; duplicate them to create a new version.
7. Publishing/archiving affects library availability, while existing deliveries and attempt history remain accessible.
```

### 8.5 Admin Overview

```text
1. DashboardHome dispatches ADMIN to a dedicated AdminOverview; Teacher and Student keep separate workspace homes.
2. GET /api/admin/overview returns real summary/content/classroom data and published System Test integrity issues.
3. GET /api/admin/overview/activity loads independently so chart failure does not hide the rest of the page.
4. Range is stored in the dashboard URL and supports 7, 30, or 90 complete platform days.
5. Attention links open Admin Test Management with source/status/integrity filters restored from the URL.
6. Product mutations write AuditEvent in the same transaction; failed mutations do not create activity rows.
7. GET /api/admin/audit-events loads the independent Recent Activity table. It uses stable createdAt + id cursor ordering and returns no raw metadata.
8. Existing records are not backfilled into synthetic activity; the empty state is valid immediately after migration.
```

### 8.6 Student Overview

```text
1. DashboardHome dispatches STUDENT to the dedicated StudentOverview rather than the shared workspace home.
2. GET /api/student/overview aggregates submissions, published System Tests, saved Error Logs, in-progress vocabulary, membership, and the highest-priority classroom work.
3. Focus prioritizes urgent classroom work, then resumable study, baseline practice, saved mistakes, evidence-backed subject practice, and a published-test fallback.
4. Subject recommendations require at least 20 recent answers, at least 10 answers in the subject, and at least 70% taxonomy coverage.
5. Progress and Recent Results use completed submissions from the last 90 days and report accuracy rather than a synthetic SAT score.
6. Practice Center subject and mode filters are URL-backed so Overview deep links restore the intended context.
7. Unified Tasks combines coursework with student-created tasks, supports personal ordering, and keeps assessed completion source-driven.
8. The calendar reads task dates, the Next SAT card uses the saved SAT date, and current/target scores are self-reported preferences rather than inferred analytics.
```

### 8.7 Teacher Overview

```text
1. DashboardHome dispatches TEACHER to the dedicated TeacherOverview rather than the legacy shared workspace home.
2. GET /api/teacher/overview validates teacher ownership and aggregates published activities, scheduled lessons, class completion, and deterministic check-in signals.
3. The class scope is URL-backed; workflow links restore Classroom Activities, its embedded Test analysis, Lessons, or Assignment student work.
4. Needs Attention includes only unresolved published work due within 48 hours or overdue; auto-scored tests and homework are not presented as a fictional review queue.
5. Class Pulse uses the last 30 days of persisted activities and ActivityAssignee completion/best-score data.
6. GET /api/teacher/overview/insights loads independently and applies each delivery's FIRST, BEST, or LATEST score policy before aggregating classified answers.
7. Skill/domain insights require at least 30 classified answers, 70% taxonomy coverage, and per-item evidence from 20 answers across 3 students.
```

### 8.8 AI Question Generation & Evaluation (LogicLab)

```
1. Student requests a question: POST /api/challenge/generate
   → Gemini generates a realistic Digital SAT R&W question with 4 choices, explanation
2. Student selects answer + writes reasoning per choice
3. Student submits: POST /api/challenge/evaluate
   → AI evaluates reasoning for each choice individually
   → Returns correctness, per-option feedback, and summary
```

### 8.9 Document Parsing (AI Parser)

```
1. Teacher uploads PDF/DOCX: POST /api/ai-parser (multipart/form-data)
   → Server extracts text (pdf-extraction / mammoth)
   → Text is split into smart chunks (paragraph-aware)
   → Each chunk sent to Gemini for formatting per SAT standard
   → Formatted text returned to client
```

### 8.10 Real-Time Notifications

```
1. Client connects: GET /api/notifications/stream (SSE)
   → Server registers response object in in-memory Map<userId, Set<Response>>
   → Sends periodic keep-alive comments (every 15s)
2. When a notification-worthy event occurs (e.g., student submits homework):
   → Service calls notificationService.sendNotificationToUser(userId, message, link)
   → Persists to Notification table
   → Pushes SSE event to all connected clients of that user
3. Client receives event → updates notification bell count in real-time
```

---

## 9. Middleware Reference

| Middleware | Location | Purpose |
|---|---|---|
| `authenticateToken` | `middleware/auth.middleware.js` | Extracts Bearer JWT from `Authorization` header, verifies, injects `req.user = { userId, email, role }`. Returns 401 on failure. |
| `authorizeRole(roles)` | `middleware/auth.middleware.js` | Factory that returns middleware checking `req.user.role ∈ roles`. Returns 403 on failure. |

---

## 10. Configuration

| File | Key Settings |
|---|---|
| `server/src/config/cors.js` | Origins: Vercel deploy, localhost:5173, localhost:5174 |
| `server/src/config/jwt.js` | Secret from `process.env.JWT_SECRET`, expiry: 7 days |
| `server/src/config/prisma.js` | Singleton `PrismaClient` instance |
| `client/vite.config.ts` | Dev proxy `/api` → `localhost:5000`, 600s timeout |
| `server/.env.example` | Required: `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID`, `GEMINI_API_KEY`, `PORT` |
