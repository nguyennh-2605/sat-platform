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
| `POST` | `/api/classes/posts` | JWT + TEACHER/ADMIN | Create an assignment/post + notify students |
| `POST` | `/api/classes/submissions` | JWT | Submit homework for an assignment |

### 5.3 Assignments

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/assignments/:id` | JWT | Get assignment detail with selected tests |
| `PUT` | `/api/assignments/:id` | JWT | Update assignment (teacher only, verified in service) |
| `DELETE` | `/api/assignments/:id` | JWT | Delete assignment (teacher only) |

### 5.4 Practice Tests & Exam Room

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/tests` | JWT | List available tests (public, class-assigned, own) |
| `GET` | `/api/tests/classes` | JWT | Get classes for test assignment dropdown |
| `POST` | `/api/tests/create` | JWT + TEACHER/ADMIN | Create a Draft or Published test with sections and questions |
| `GET` | `/api/tests/:id/content` | JWT + TEACHER/ADMIN | Read owned or published system test content without creating an attempt |
| `POST` | `/api/tests/:id/duplicate` | JWT + TEACHER/ADMIN | Duplicate an accessible test into an owned Draft |
| `PATCH` | `/api/tests/:id/status` | JWT + TEACHER/ADMIN | Publish, archive, or restore an owned test |
| `GET` | `/api/class-activities/class/:classId` | JWT | List unified class activities visible to staff or an enrolled student |
| `POST` | `/api/test-deliveries` | JWT + TEACHER/ADMIN | Publish a Classroom test activity with availability, attempts, score policy, and audience |
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
| `POST` | `/api/progress/class/:classId/weeks` | JWT | Create a week (teacher only) |
| `PUT` | `/api/progress/weeks/:weekId` | JWT | Update week title/expanded state (teacher only) |
| `DELETE` | `/api/progress/weeks/:weekId` | JWT | Delete week (teacher only) |
| `POST` | `/api/progress/weeks/:weekId/lessons` | JWT | Create lesson (teacher only) |
| `DELETE` | `/api/progress/lessons/:lessonId` | JWT | Delete lesson (teacher only) |
| `POST` | `/api/progress/lessons/:lessonId/files` | JWT | Add files to lesson (teacher only) |
| `DELETE` | `/api/progress/files/:fileId` | JWT | Delete file (teacher only) |
| `POST` | `/api/progress/lessons/:lessonId/assignment` | JWT | Create/update lesson assignment (teacher only) |
| `DELETE` | `/api/progress/assignments/:assignmentId` | JWT | Delete lesson assignment (teacher only) |

### 5.7 Results Analytics

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/results-analytics` | JWT | Analytics data (charts + history) for past N days |
| `GET` | `/api/results-analytics/submission/:id` | JWT | Detailed submission with every question/answer |

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

**Total: 47+ endpoints**

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

Class ──1:N── Assignment
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

**Class**: `id` (UUID), `name`, `teacherId` (FK → User), `createdAt`

**Assignment**: `id` (UUID), `title`, `content`, `fileUrls[]`, `links[]`, `testIds[]`, `deadline`, `classId` (FK → Class, cascade)

**Test**: `id`, `title`, `description`, `duration` (default 64 min), `mode` (PRACTICE | EXAM), `status` (DRAFT | PUBLISHED | ARCHIVED), `category` (REAL | CLASS | PRACTICE), `isPublic`, `subject` (RW | MATH), `authorId` (FK → User), `folderId` (FK → Folder), `createdAt`, `updatedAt`

**Submission**: `id`, `userId`, `testId`, `assignmentId`, `classTestId`, `savedAnswers` (JSON), `timeRemaining`, `currentQuestionIndex`, `score`, `violationCount`, `status` (DOING | COMPLETED), `startedAt`, `endTime`

**Question**: `id`, `sectionId`, `type` (MCQ | SPR), `blocks` (JSON content), `questionText`, `choices` (JSON), `correctAnswer`, `explanation`, `order`

**Answer**: `id`, `submissionId`, `questionId`, `selectedChoice`, `isCorrect`

**Enums**: `Role` (STUDENT, TEACHER, ADMIN), `TestMode` (PRACTICE, EXAM), `TestStatus` (DRAFT, PUBLISHED, ARCHIVED), `TestCategory` (REAL, CLASS, PRACTICE), `TestSubject` (RW, MATH), `SubmissionStatus` (DOING, COMPLETED), `QuestionType` (MCQ, SPR)

---

## 7. Frontend Routes (React Router v7)

| Path | Page Component | Description |
|---|---|---|
| `/` | HomePage | Public landing page |
| `/auth` | AuthPage | Login / Register |
| `/dashboard/practice-test` | PracticeTest | Test listing & filters |
| `/dashboard/practice-test/my-bank/:folderId?` | TestBank | Folder-based test organization |
| `/dashboard/practice-test/create` | CreateTestWizard | Multi-step test creation |
| `/dashboard/class/:classId` | Classroom | Class feed, assignments, students |
| `/dashboard/class/:classId/assignment/:assignmentId` | AssignmentDetail | View/submit homework |
| `/dashboard/error-log` | ErrorLog | Wrong answer tracking |
| `/dashboard/logic-lab` | LogicLab | AI challenge (question generation + evaluation) |
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
3. Publish test makes it selectable from Classroom → Activities.
4. Classroom → Add Activity → Test lists Published My Tests and Published System Tests.
5. Teacher configures availability, deadline, attempts, score policy, and all/selected students.
6. POST /api/test-deliveries creates TestDelivery + canonical ClassActivity + assignees and notifications.
7. Classroom Activities owns completion/performance; Test Library never displays student attempt state.
8. Archiving prevents new delivery but preserves existing deliveries and student access/history.
```

### 8.4 AI Question Generation & Evaluation (LogicLab)

```
1. Student requests a question: POST /api/challenge/generate
   → Gemini generates a realistic Digital SAT R&W question with 4 choices, explanation
2. Student selects answer + writes reasoning per choice
3. Student submits: POST /api/challenge/evaluate
   → AI evaluates reasoning for each choice individually
   → Returns correctness, per-option feedback, and summary
```

### 8.5 Document Parsing (AI Parser)

```
1. Teacher uploads PDF/DOCX: POST /api/ai-parser (multipart/form-data)
   → Server extracts text (pdf-extraction / mammoth)
   → Text is split into smart chunks (paragraph-aware)
   → Each chunk sent to Gemini for formatting per SAT standard
   → Formatted text returned to client
```

### 8.6 Real-Time Notifications

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
