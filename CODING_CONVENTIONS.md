# SAT PLATFORM - CODING CONVENTIONS & GUIDELINES

**Phiên bản:** 1.0  
**Ngày cập nhật:** 06/06/2026  
**Dự án:** SAT Educational Testing Platform

---

## 📋 MỤC LỤC

1. [Tổng quan dự án](#1-tổng-quan-dự-án)
2. [Cấu trúc thư mục](#2-cấu-trúc-thư-mục)
3. [Quy tắc đặt tên](#3-quy-tắc-đặt-tên)
4. [Frontend Guidelines](#4-frontend-guidelines)
5. [Backend Guidelines](#5-backend-guidelines)
6. [Database Guidelines](#6-database-guidelines)
7. [API Guidelines](#7-api-guidelines)
8. [TypeScript Guidelines](#8-typescript-guidelines)
9. [Git Workflow](#9-git-workflow)
10. [Testing Guidelines](#10-testing-guidelines)
11. [Security Guidelines](#11-security-guidelines)
12. [Performance Guidelines](#12-performance-guidelines)

---

## 1. TỔNG QUAN DỰ ÁN

### Tech Stack
- **Backend:** Node.js + Express.js (CommonJS)
- **Database:** PostgreSQL + Prisma ORM
- **Frontend:** React 19 + TypeScript + Vite
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **HTTP Client:** Axios
- **State Management:** Zustand + React Context
- **Authentication:** JWT + Google OAuth

### Kiến trúc
- **Client-Server** với RESTful API
- **Database:** Highly relational structure (Folder → Test → Section → Question → Answer)
- **Authentication:** Middleware inject `req.user.userId` vào mọi request
- **Frontend:** Controlled components + Recursive rendering cho hierarchical data

---

## 2. CẤU TRÚC THƯ MỤC

### 📁 Root Level
```
sat-platform/
├── client/                 # Frontend React + TypeScript
├── server/                 # Backend Node.js + Express
├── .claude/                # Claude AI configuration
├── .git/                   # Git repository
├── .vscode/                # VS Code settings
├── PROJECT_CONTEXT.md      # Bối cảnh dự án (đọc trước khi code)
├── CODING_CONVENTIONS.md   # Tài liệu này
└── .gitignore
```

---

### 📁 CLIENT Structure (`/client`)

```
client/
├── dist/                   # Build output (auto-generated, không commit)
├── node_modules/           # Dependencies (không commit)
├── public/                 # Static assets
│   ├── images/             # Hình ảnh tĩnh
│   └── favicon.ico
├── src/
│   ├── app/                # App root component
│   │   └── App.tsx         # Main application entry
│   ├── assets/             # Static resources (fonts, global images)
│   ├── components/         # Shared reusable components
│   │   ├── content/        # Content rendering components
│   │   │   ├── BlockRenderer.tsx
│   │   │   └── TextRenderer.tsx
│   │   ├── layouts/        # Layout components
│   │   │   ├── ResizableSplitLayout.tsx
│   │   │   └── SingleColumnLayout.tsx
│   │   └── ui/             # Basic UI components (buttons, inputs...)
│   │       ├── Calculator.tsx
│   │       ├── FloatingLabelInput.tsx
│   │       └── RippleButton.tsx
│   ├── context/            # React Context providers
│   │   └── QuizToolContext.tsx
│   ├── features/           # Feature-based modules (domain logic)
│   │   ├── analytics/      # Student analytics & progress tracking
│   │   ├── assignment/     # Assignment management
│   │   ├── notifications/  # Notification system
│   │   ├── quiz/           # Quiz/test taking functionality
│   │   └── test-creation/  # Test creation tools
│   ├── hooks/              # Custom React hooks
│   ├── lib/                # External library configurations
│   ├── pages/              # Page-level components (routing)
│   │   ├── auth/           # Authentication pages (login, register)
│   │   ├── classroom/      # Classroom management pages
│   │   ├── dashboard/      # Dashboard pages
│   │   ├── error-log/      # Error log pages
│   │   ├── exam-room/      # Exam taking interface
│   │   ├── home/           # Home page
│   │   ├── logic-lab/      # Logic practice lab
│   │   ├── practice-test/  # Practice test pages
│   │   ├── result-analytics/ # Result analysis pages
│   │   ├── score-report/   # Score report pages
│   │   └── test-bank/      # Test bank management pages
│   ├── types/              # TypeScript type definitions
│   ├── utils/              # Utility functions
│   └── main.tsx            # Vite entry point
├── index.html              # HTML template
├── package.json
├── tailwind.config.js      # Tailwind CSS configuration
├── tsconfig.json           # TypeScript configuration
├── tsconfig.app.json       # App-specific TS config
├── tsconfig.node.json      # Node-specific TS config
├── vite.config.ts          # Vite configuration
└── vercel.json             # Vercel deployment config
```

#### 📌 Ý nghĩa các thư mục CLIENT

| Thư mục | Mục đích | Ví dụ |
|---------|----------|-------|
| `app/` | Root component của ứng dụng | App.tsx (routing, global providers) |
| `assets/` | Tài nguyên tĩnh (fonts, global images) | fonts/, brand-logo.svg |
| `components/content/` | Components render nội dung động | BlockRenderer, TextRenderer |
| `components/layouts/` | Components bố cục trang | ResizableSplitLayout, Sidebar |
| `components/ui/` | Reusable UI components | Button, Input, Modal |
| `context/` | React Context cho global state | QuizToolContext, AuthContext |
| `features/` | **Feature modules** - logic nghiệp vụ theo domain | analytics/, quiz/, assignment/ |
| `hooks/` | Custom React hooks | useAuth, useFetch, useDebounce |
| `lib/` | External library configs | axios.config.ts |
| `pages/` | Page components (1 page = 1 route) | HomePage.tsx, DashboardPage.tsx |
| `types/` | TypeScript type/interface definitions | api.types.ts, models.ts |
| `utils/` | Utility/helper functions | formatDate(), calculateScore() |

---

### 📁 SERVER Structure (`/server`)

```
server/
├── node_modules/           # Dependencies (không commit)
├── prisma/
│   ├── data/               # Seed data files
│   ├── migrations/         # Database migrations (auto-generated)
│   ├── schema.prisma       # **DATABASE SCHEMA - Single source of truth**
│   └── seed.js             # Database seeding script
├── src/
│   ├── config/             # Configuration files
│   │   ├── cors.js         # CORS configuration
│   │   └── prisma.js       # Prisma client initialization
│   ├── controllers/        # Business logic handlers
│   │   ├── ai-chatbot.controller.js
│   │   ├── ai-parser.controller.js
│   │   ├── analytics.controller.js
│   │   ├── assignment.controller.js
│   │   ├── auth.controller.js
│   │   ├── challenge.controller.js
│   │   ├── class.controller.js
│   │   ├── error-log.controller.js
│   │   ├── exam-room.controller.js
│   │   ├── notification.controller.js
│   │   ├── practice-test.controller.js
│   │   ├── progress.controller.js
│   │   └── test-bank.controller.js
│   ├── middleware/         # Express middleware
│   │   └── auth.middleware.js  # JWT authentication
│   ├── routes/             # API route definitions
│   │   ├── ai-chatbot.routes.js
│   │   ├── ai-parser.routes.js
│   │   ├── analytics.routes.js
│   │   └── ... (tương ứng với controllers)
│   ├── utils/              # Utility functions
│   └── app.js              # Express app initialization
├── index.js                # Server entry point
├── package.json
└── .env                    # Environment variables (KHÔNG COMMIT)
```

#### 📌 Ý nghĩa các thư mục SERVER

| Thư mục | Mục đích | Quy tắc |
|---------|----------|---------|
| `prisma/` | Database schema & migrations | **Luôn update schema.prisma trước khi thay đổi DB** |
| `config/` | App-wide configurations | CORS, Prisma client, env configs |
| `controllers/` | Business logic | 1 controller = 1 resource/domain |
| `middleware/` | Request interceptors | auth, validation, error handling |
| `routes/` | API endpoint definitions | 1 route file per resource |
| `utils/` | Helper functions | Shared logic, formatters, validators |

---

## 3. QUY TẮC ĐẶT TÊN

### 📝 Naming Conventions

| Loại | Convention | Ví dụ | Không dùng |
|------|-----------|--------|------------|
| **React Components** | PascalCase | `FolderNode.tsx`, `UserProfile.tsx` | `folderNode.tsx` ❌ |
| **Variables & Functions** | camelCase | `const userId = 1`, `function fetchData()` | `const UserId` ❌ |
| **Backend Files** | camelCase | `testController.js`, `authMiddleware.js` | `TestController.js` ❌ |
| **Prisma Models** | PascalCase (singular) | `User`, `Test`, `Assignment` | `Users` ❌ |
| **API Routes** | kebab-case (plural) | `/api/test-bank/folders` | `/api/TestBank/Folder` ❌ |
| **TypeScript Types/Interfaces** | PascalCase | `interface UserData {}`, `type ApiResponse` | `interface userData` ❌ |
| **Constants** | UPPER_SNAKE_CASE | `const MAX_QUESTIONS = 100` | `const maxQuestions` ❌ |
| **CSS Classes** | kebab-case | `class="nav-bar"` | `class="navBar"` ❌ |
| **Folders** | kebab-case | `test-bank/`, `exam-room/` | `testBank/` ❌ |

### 🔤 Nguyên tắc đặt tên

#### ✅ DO (Nên)
```typescript
// Descriptive và rõ ràng
const activeStudents = students.filter(s => s.isActive);
function calculateTotalScore(answers: Answer[]): number { }
const isSubmissionComplete = submission.status === 'COMPLETED';

// Component names phản ánh chức năng
const QuestionEditor = () => { };
const StudentAnalyticsDashboard = () => { };
```

#### ❌ DON'T (Không nên)
```typescript
// Tên quá ngắn, không rõ nghĩa
const d = new Date();           // ❌ Dùng currentDate
const arr = [];                 // ❌ Dùng students, questions...
function calc() { }             // ❌ Dùng calculateScore

// Tên gây nhầm lẫn
const data = fetchUsers();      // ❌ Quá generic
const temp = user.score;        // ❌ Tránh dùng temp
```

---

## 4. FRONTEND GUIDELINES

### ⚛️ React Best Practices

#### 4.1 Component Structure

```typescript
// ✅ Cấu trúc component chuẩn
import React, { useState, useEffect } from 'react';
import { SomeType } from '@/types/models';

interface ComponentProps {
  title: string;
  onSubmit: (data: SomeType) => void;
}

export const MyComponent: React.FC<ComponentProps> = ({ title, onSubmit }) => {
  const [data, setData] = useState<SomeType | null>(null);

  useEffect(() => {
    // Side effects here
  }, []);

  return (
    <div className="container">
      {/* JSX */}
    </div>
  );
};
```

#### 4.2 State Management Rules

**🚫 CRITICAL: Never mutate state directly**

```typescript
// ❌ WRONG - Direct mutation
const [items, setItems] = useState([]);
items.push(newItem);              // ❌ Direct mutation
items[0].name = "New Name";       // ❌ Direct mutation

// ✅ CORRECT - Immutable updates
setItems(prev => [...prev, newItem]);           // ✅ Add item
setItems(prev => prev.filter(item => item.id !== id));  // ✅ Remove item
setItems(prev => prev.map(item => 
  item.id === id ? { ...item, name: "New Name" } : item
));  // ✅ Update item
```

**Prefer local state over global state**
```typescript
// ✅ Local state for component-specific data
const [isOpen, setIsOpen] = useState(false);

// ✅ Context/Zustand chỉ cho shared state
const { user, setUser } = useAuthStore();
```

#### 4.3 Hierarchical Data Handling

**Dùng flat arrays với `parentId` thay vì nested structure**

```typescript
// ✅ PREFERRED - Flat structure
interface Folder {
  id: number;
  name: string;
  parentId: number | null;  // null = root level
}

const folders = [
  { id: 1, name: "Root", parentId: null },
  { id: 2, name: "Child 1", parentId: 1 },
  { id: 3, name: "Child 2", parentId: 1 },
];

// ❌ AVOID - Deep nesting
const folders = [
  {
    id: 1,
    name: "Root",
    children: [
      { id: 2, name: "Child 1", children: [...] },  // ❌ Hard to update
    ]
  }
];
```

#### 4.4 Data Fetching Pattern

```typescript
// ✅ Standard data fetching pattern
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState<string | null>(null);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/endpoint');
      if (response.data.success) {
        setData(response.data.data);
      } else {
        setError(response.data.message);
      }
    } catch (err) {
      setError('Failed to fetch data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  fetchData();
}, []);

if (loading) return <div>Loading...</div>;
if (error) return <div>Error: {error}</div>;
```

#### 4.5 Recursive Components

**Dùng cho tree structures (folders, nested comments...)**

```typescript
interface FolderNodeProps {
  folder: Folder;
  allFolders: Folder[];
}

const FolderNode: React.FC<FolderNodeProps> = ({ folder, allFolders }) => {
  const children = allFolders.filter(f => f.parentId === folder.id);

  return (
    <div>
      <div>{folder.name}</div>
      {children.map(child => (
        <FolderNode key={child.id} folder={child} allFolders={allFolders} />
      ))}
    </div>
  );
};
```

---

## 5. BACKEND GUIDELINES

### 🚀 Express.js Best Practices

#### 5.1 Controller Structure

```javascript
// ✅ Standard controller pattern
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

exports.getItems = async (req, res) => {
  try {
    const userId = req.user.userId;  // From auth middleware
    
    const items = await prisma.item.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        createdAt: true,
      },
    });

    return res.status(200).json({
      success: true,
      message: 'Items retrieved successfully',
      data: items,
    });
  } catch (error) {
    console.error('Error fetching items:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      data: null,
    });
  }
};
```

#### 5.2 Route Definition

```javascript
// ✅ Route file structure
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth.middleware');
const controller = require('../controllers/item.controller');

// Static routes first, then dynamic routes
router.get('/items', authMiddleware, controller.getItems);
router.post('/items', authMiddleware, controller.createItem);
router.get('/items/:id', authMiddleware, controller.getItemById);
router.put('/items/:id', authMiddleware, controller.updateItem);
router.delete('/items/:id', authMiddleware, controller.deleteItem);

module.exports = router;
```

#### 5.3 Error Handling

```javascript
// ✅ Always wrap async operations in try-catch
exports.dangerousOperation = async (req, res) => {
  try {
    // Business logic
  } catch (error) {
    console.error('Error in dangerousOperation:', error);
    
    // ❌ DON'T expose internal errors
    // return res.status(500).json({ error: error.stack });
    
    // ✅ DO return generic messages
    return res.status(500).json({
      success: false,
      message: 'Operation failed',
      data: null,
    });
  }
};
```

---

## 6. DATABASE GUIDELINES

### 🗄️ Prisma Best Practices

#### 6.1 Schema Rules

**⚠️ CRITICAL: Always update `schema.prisma` FIRST before modifying database**

```prisma
// ✅ Well-defined model
model User {
  id        Int      @id @default(autoincrement())
  email     String   @unique
  name      String?
  createdAt DateTime @default(now())
  
  // Relations
  posts     Post[]
  
  @@index([email])
}

model Post {
  id        Int      @id @default(autoincrement())
  title     String
  content   String?
  published Boolean  @default(false)
  authorId  Int
  
  author    User     @relation(fields: [authorId], references: [id], onDelete: Cascade)
  
  @@index([authorId])
}
```

#### 6.2 Cascade Delete Rules

**⚠️ Always evaluate `onDelete: Cascade` carefully**

```prisma
// ✅ Cascade when child data is meaningless without parent
model Class {
  id          String       @id @default(uuid())
  name        String
  assignments Assignment[]
}

model Assignment {
  id      String @id @default(uuid())
  title   String
  classId String
  
  class   Class  @relation(fields: [classId], references: [id], onDelete: Cascade)
  // ✅ Delete assignment khi class bị xóa
}

// ❌ DON'T cascade when data should be preserved
model User {
  id    Int    @id
  posts Post[]
}

model Post {
  id       Int  @id
  authorId Int
  
  author   User @relation(fields: [authorId], references: [id], onDelete: Restrict)
  // ✅ Prevent deleting user if they have posts
}
```

#### 6.3 Query Optimization

```javascript
// ✅ Use select to minimize payload
const users = await prisma.user.findMany({
  select: {
    id: true,
    name: true,
    email: true,
    // ❌ Don't select password or sensitive fields
  },
});

// ✅ Use include for relations
const post = await prisma.post.findUnique({
  where: { id: postId },
  include: {
    author: {
      select: { id: true, name: true },  // Only needed fields
    },
  },
});

// ❌ AVOID: N+1 query problem
for (const user of users) {
  const posts = await prisma.post.findMany({ where: { authorId: user.id } });
}

// ✅ DO: Batch query
const users = await prisma.user.findMany({
  include: { posts: true },
});
```

#### 6.4 Database Workflow

**Thứ tự khi thay đổi database:**

1. **Update `schema.prisma`** - Single source of truth
2. **Validate relations** - Check cascade rules
3. **Run migration:**
   ```bash
   cd server
   npx prisma db push  # Development
   # OR
   npx prisma migrate dev --name feature_name  # Production-ready
   ```
4. **Verify Prisma client:** `npx prisma generate`

---

## 7. API GUIDELINES

### 🌐 RESTful API Standards

#### 7.1 Response Format (MANDATORY)

**🚫 CRITICAL: ALL endpoints MUST return this format**

```javascript
// ✅ Success response
{
  "success": true,
  "message": "Operation completed successfully",
  "data": { /* actual data */ }
}

// ✅ Error response
{
  "success": false,
  "message": "Error description",
  "data": null
}
```

#### 7.2 HTTP Status Codes

| Code | Khi nào dùng | Ví dụ |
|------|-------------|-------|
| `200` | Success | GET, PUT, DELETE thành công |
| `201` | Created | POST tạo resource mới |
| `400` | Bad Request | Validation error, missing params |
| `401` | Unauthorized | Missing/invalid token |
| `403` | Forbidden | Không có quyền truy cập |
| `404` | Not Found | Resource không tồn tại |
| `500` | Server Error | Unhandled exceptions |

#### 7.3 API Naming Conventions

```
✅ GOOD:
GET    /api/classes              - List all classes
GET    /api/classes/:id          - Get specific class
POST   /api/classes              - Create new class
PUT    /api/classes/:id          - Update class
DELETE /api/classes/:id          - Delete class
GET    /api/classes/:id/students - Get students in class

❌ BAD:
GET    /api/getClasses           - Don't use verbs in URL
GET    /api/class                - Use plural nouns
POST   /api/classes/create       - Redundant, use POST /api/classes
GET    /api/classes/:id/student  - Use plural for collections
```

#### 7.4 Request Validation

```javascript
// ✅ Validate inputs
exports.createTest = async (req, res) => {
  try {
    const { title, duration } = req.body;

    // Validation
    if (!title || title.trim() === '') {
      return res.status(400).json({
        success: false,
        message: 'Title is required',
        data: null,
      });
    }

    if (duration && (duration < 1 || duration > 300)) {
      return res.status(400).json({
        success: false,
        message: 'Duration must be between 1 and 300 minutes',
        data: null,
      });
    }

    // Proceed with business logic...
  } catch (error) {
    // Error handling
  }
};
```

---

## 8. TYPESCRIPT GUIDELINES

### 🔷 TypeScript Best Practices

#### 8.1 Type Definitions

```typescript
// ✅ Use lowercase primitives
type UserId = number;         // ✅
type UserName = string;       // ✅

// ❌ Don't use uppercase wrappers
type UserId = Number;         // ❌
type UserName = String;       // ❌

// ✅ Define interfaces for objects
interface User {
  id: number;
  name: string;
  email: string;
  role: 'STUDENT' | 'TEACHER';  // Union types for enums
  createdAt: Date;
}

// ✅ Use type for unions and primitives
type Status = 'pending' | 'completed' | 'failed';
type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};
```

#### 8.2 Avoid `any`

```typescript
// ❌ AVOID any
function processData(data: any) {
  return data.value;  // No type safety
}

// ✅ Use specific types
function processData(data: { value: string }) {
  return data.value;
}

// ✅ Use generics for flexible types
function processData<T>(data: T): T {
  return data;
}

// ✅ Use unknown if type is truly unknown
function processData(data: unknown) {
  if (typeof data === 'object' && data !== null && 'value' in data) {
    return (data as { value: string }).value;
  }
}
```

#### 8.3 Optional Chaining & Nullish Coalescing

```typescript
// ✅ Use optional chaining
const userName = user?.profile?.name;

// ✅ Use nullish coalescing
const displayName = user?.name ?? 'Anonymous';

// ❌ AVOID
const userName = user && user.profile && user.profile.name;
const displayName = user?.name || 'Anonymous';  // ❌ '' will also trigger
```

---

## 9. GIT WORKFLOW

### 🌿 Branch Strategy

```bash
main              # Production-ready code
├── feature/xxx   # New features
├── bugfix/xxx    # Bug fixes
├── refactor/xxx  # Code refactoring
└── hotfix/xxx    # Urgent production fixes
```

### 📝 Commit Message Convention

```bash
# Format: <type>: <subject>

✅ GOOD:
feat: add student analytics dashboard
fix: resolve test submission timeout
refactor: reorganize folder structure
docs: update API documentation
style: format code with prettier
test: add unit tests for calculator

❌ BAD:
update                    # Too vague
fixed bug                 # What bug?
WIP                      # Not descriptive
asdfasdf                 # Meaningless
```

**Commit types:**
- `feat`: New feature
- `fix`: Bug fix
- `refactor`: Code restructuring
- `docs`: Documentation
- `style`: Code formatting
- `test`: Adding tests
- `chore`: Build/config changes

### 🔄 Workflow Steps

```bash
# 1. Create branch from main
git checkout main
git pull origin main
git checkout -b feature/new-feature

# 2. Make changes and commit
git add .
git commit -m "feat: add new feature"

# 3. Push to remote
git push origin feature/new-feature

# 4. Create Pull Request
# 5. Code review
# 6. Merge to main
```

---

## 10. TESTING GUIDELINES

### 🧪 Testing Strategy

#### 10.1 What to Test

```typescript
// ✅ Test business logic
describe('calculateScore', () => {
  it('should return correct score for all correct answers', () => {
    const answers = [
      { questionId: 1, selectedAnswer: 'A', correctAnswer: 'A' },
      { questionId: 2, selectedAnswer: 'B', correctAnswer: 'B' },
    ];
    expect(calculateScore(answers)).toBe(100);
  });

  it('should return 0 for all incorrect answers', () => {
    const answers = [
      { questionId: 1, selectedAnswer: 'A', correctAnswer: 'B' },
    ];
    expect(calculateScore(answers)).toBe(0);
  });
});

// ✅ Test edge cases
describe('formatDate', () => {
  it('should handle null input', () => {
    expect(formatDate(null)).toBe('N/A');
  });

  it('should handle invalid date', () => {
    expect(formatDate('invalid')).toBe('Invalid Date');
  });
});
```

#### 10.2 Testing Checklist

- [ ] Unit tests cho utility functions
- [ ] Integration tests cho API endpoints
- [ ] Test edge cases (null, undefined, empty arrays)
- [ ] Test error handling
- [ ] Test authentication/authorization
- [ ] Manual testing cho UI changes

---

## 11. SECURITY GUIDELINES

### 🔒 Security Best Practices

#### 11.1 Input Validation

```javascript
// ✅ Always validate user input
exports.createTest = async (req, res) => {
  try {
    const { title, duration, questions } = req.body;

    // Type validation
    if (typeof title !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid title' });
    }

    // Range validation
    if (duration < 1 || duration > 300) {
      return res.status(400).json({ success: false, message: 'Invalid duration' });
    }

    // Array validation
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({ success: false, message: 'Questions required' });
    }

    // Sanitize input
    const sanitizedTitle = title.trim();

    // Proceed...
  } catch (error) {
    // Error handling
  }
};
```

#### 11.2 Authentication & Authorization

```javascript
// ✅ Always use auth middleware
router.post('/classes', authMiddleware, controller.createClass);

// ✅ Verify ownership before operations
exports.updateTest = async (req, res) => {
  try {
    const testId = parseInt(req.params.id);
    const userId = req.user.userId;

    const test = await prisma.test.findUnique({
      where: { id: testId },
    });

    if (!test) {
      return res.status(404).json({ success: false, message: 'Test not found' });
    }

    if (test.authorId !== userId) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    // Proceed with update...
  } catch (error) {
    // Error handling
  }
};
```

#### 11.3 Sensitive Data

```javascript
// ❌ DON'T expose sensitive data
const user = await prisma.user.findUnique({
  where: { id: userId },
});
return res.json({ data: user });  // ❌ Exposes password

// ✅ DO select only necessary fields
const user = await prisma.user.findUnique({
  where: { id: userId },
  select: {
    id: true,
    name: true,
    email: true,
    role: true,
    // password: false (excluded by default)
  },
});
return res.json({ success: true, data: user });
```

#### 11.4 Environment Variables

```javascript
// ✅ Store sensitive data in .env
DATABASE_URL="postgresql://..."
JWT_SECRET="your-secret-key"
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."

// ❌ NEVER commit .env to git
// ✅ Add to .gitignore
```

---

## 12. PERFORMANCE GUIDELINES

### ⚡ Optimization Best Practices

#### 12.1 React Performance

```typescript
// ✅ Use React.memo for expensive components
export const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Complex rendering */}</div>;
});

// ✅ Use useMemo for expensive calculations
const sortedData = useMemo(() => {
  return data.sort((a, b) => b.score - a.score);
}, [data]);

// ✅ Use useCallback for stable function references
const handleSubmit = useCallback((values) => {
  // Handle submission
}, [dependency]);

// ❌ AVOID unnecessary re-renders
// Bad: Creating new object every render
<Component config={{ value: 1 }} />

// Good: Memoize object
const config = useMemo(() => ({ value: 1 }), []);
<Component config={config} />
```

#### 12.2 Database Performance

```javascript
// ❌ AVOID: Fetching unnecessary data
const users = await prisma.user.findMany();  // Gets all fields

// ✅ DO: Select only needed fields
const users = await prisma.user.findMany({
  select: { id: true, name: true },
});

// ✅ Use pagination for large datasets
const tests = await prisma.test.findMany({
  take: 20,        // Limit
  skip: page * 20, // Offset
});
```

#### 12.3 Image Optimization

```html
<!-- ✅ Use modern formats -->
<img src="image.webp" alt="Description" loading="lazy" />

<!-- ✅ Specify dimensions to prevent layout shift -->
<img src="image.jpg" width="400" height="300" alt="Description" />
```

---

## 13. STYLING GUIDELINES (TAILWIND CSS)

### 🎨 Tailwind Best Practices

#### 13.1 Utility Classes

```tsx
// ✅ Use Tailwind utilities
<div className="flex items-center justify-between p-4 bg-blue-500 text-white rounded-lg shadow-md">
  Content
</div>

// ❌ DON'T use inline styles
<div style={{ display: 'flex', padding: '16px', background: 'blue' }}>
  Content
</div>

// ❌ DON'T import external CSS frameworks
import 'bootstrap.css';  // ❌
```

#### 13.2 Responsive Design

```tsx
// ✅ Mobile-first approach
<div className="text-sm md:text-base lg:text-lg">
  Responsive text
</div>

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  {/* Grid items */}
</div>
```

#### 13.3 Color Palette

**Maintain existing color palette**

```tsx
// ✅ Use consistent colors
<button className="bg-blue-600 hover:bg-blue-700">Primary</button>
<button className="bg-gray-200 hover:bg-gray-300">Secondary</button>
<div className="text-red-600">Error message</div>
<div className="text-green-600">Success message</div>

// ❌ AVOID random colors
<button className="bg-purple-500">Button</button>  // ❌ Not in palette
```

---

## 14. CODE REVIEW CHECKLIST

### ✅ Before Submitting PR

#### Code Quality
- [ ] Code follows naming conventions
- [ ] No commented-out code
- [ ] No console.log in production code
- [ ] No hardcoded values (use constants/env vars)
- [ ] Functions are small and focused (< 50 lines)
- [ ] No duplicate code

#### TypeScript
- [ ] No `any` types (use proper types)
- [ ] Interfaces defined for objects
- [ ] No type assertions unless necessary

#### React
- [ ] No direct state mutations
- [ ] useEffect dependencies are correct
- [ ] No unnecessary re-renders
- [ ] Components are properly memoized if needed

#### Backend
- [ ] All async operations in try-catch
- [ ] API responses follow standard format
- [ ] Input validation implemented
- [ ] Authorization checks in place

#### Database
- [ ] schema.prisma updated if DB changed
- [ ] Cascade rules evaluated
- [ ] Indexes added for frequently queried fields

#### Security
- [ ] User input validated
- [ ] No sensitive data exposed in responses
- [ ] No SQL injection vulnerabilities
- [ ] Authentication/authorization checked

#### Testing
- [ ] Manual testing completed
- [ ] Edge cases considered
- [ ] Error scenarios tested

---

## 15. CRITICAL RULES (MUST FOLLOW)

### 🚨 NEVER DO THESE:

1. **❌ DO NOT refactor unrelated code** - Only change what's necessary
2. **❌ DO NOT rename variables/functions** unless fixing bugs or explicitly asked
3. **❌ DO NOT move files** unless explicitly asked
4. **❌ DO NOT reorganize folder structure** unless explicitly asked
5. **❌ DO NOT modify PrismaClient initialization** in `config/prisma.js`
6. **❌ DO NOT remove `onDelete: Cascade`** without understanding implications
7. **❌ DO NOT change API response format** - Frontend depends on it
8. **❌ DO NOT introduce new CSS frameworks** - Use Tailwind only
9. **❌ DO NOT mutate state directly** - Always use functional updates
10. **❌ DO NOT expose internal error stacks** to clients
11. **❌ DO NOT commit `.env` files** to git
12. **❌ DO NOT use `any` type** in TypeScript without justification
13. **❌ DO NOT skip authentication middleware** on protected routes
14. **❌ DO NOT trust client-side data** - Validate on backend

### ✅ ALWAYS DO THESE:

1. **✅ ALWAYS read PROJECT_CONTEXT.md** before starting work
2. **✅ ALWAYS update schema.prisma FIRST** when changing database
3. **✅ ALWAYS use try-catch** in async controllers
4. **✅ ALWAYS validate user input** on backend
5. **✅ ALWAYS check authorization** before operations
6. **✅ ALWAYS use functional state updates** in React
7. **✅ ALWAYS return standard API response format**
8. **✅ ALWAYS test manually** after UI changes
9. **✅ ALWAYS use TypeScript strict types**
10. **✅ ALWAYS follow existing patterns** in codebase

---

## 16. COMMON PATTERNS

### 📚 Frequently Used Patterns

#### Pattern 1: CRUD API Endpoint

```javascript
// Controller: controllers/resource.controller.js
exports.getAll = async (req, res) => {
  try {
    const userId = req.user.userId;
    const items = await prisma.resource.findMany({
      where: { userId },
      select: { id: true, name: true, createdAt: true },
    });
    return res.status(200).json({
      success: true,
      message: 'Resources retrieved',
      data: items,
    });
  } catch (error) {
    console.error('Error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error',
      data: null,
    });
  }
};

// Route: routes/resource.routes.js
const router = require('express').Router();
const auth = require('../middleware/auth.middleware');
const controller = require('../controllers/resource.controller');

router.get('/resources', auth, controller.getAll);
router.post('/resources', auth, controller.create);
router.get('/resources/:id', auth, controller.getById);
router.put('/resources/:id', auth, controller.update);
router.delete('/resources/:id', auth, controller.delete);

module.exports = router;
```

#### Pattern 2: React Data Fetching Component

```typescript
import { useState, useEffect } from 'react';
import axios from 'axios';

interface Item {
  id: number;
  name: string;
}

export const ItemList: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        setLoading(true);
        const response = await axios.get('/api/items');
        if (response.data.success) {
          setItems(response.data.data);
        } else {
          setError(response.data.message);
        }
      } catch (err) {
        setError('Failed to load items');
      } finally {
        setLoading(false);
      }
    };

    fetchItems();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div className="text-red-600">{error}</div>;

  return (
    <div>
      {items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
    </div>
  );
};
```

#### Pattern 3: Hierarchical Tree Rendering

```typescript
interface TreeNode {
  id: number;
  name: string;
  parentId: number | null;
}

interface TreeNodeProps {
  node: TreeNode;
  allNodes: TreeNode[];
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, allNodes }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const children = allNodes.filter(n => n.parentId === node.id);
  const hasChildren = children.length > 0;

  return (
    <div className="ml-4">
      <div className="flex items-center">
        {hasChildren && (
          <button onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? '▼' : '▶'}
          </button>
        )}
        <span>{node.name}</span>
      </div>
      {isExpanded && children.map(child => (
        <TreeNode key={child.id} node={child} allNodes={allNodes} />
      ))}
    </div>
  );
};
```

---

## 17. TROUBLESHOOTING

### 🔧 Common Issues & Solutions

| Problem | Solution |
|---------|----------|
| **Prisma Client not found** | Run `npx prisma generate` |
| **Database schema mismatch** | Run `npx prisma db push` |
| **Port already in use** | Kill process: `npx kill-port 3000` |
| **CORS errors** | Check `cors.js` configuration |
| **401 Unauthorized** | Check JWT token in request headers |
| **State not updating** | Ensure using functional updates: `setState(prev => ...)` |
| **TypeScript errors** | Check `tsconfig.json`, install `@types/*` packages |
| **Build fails** | Clear cache: `rm -rf node_modules && npm install` |

---

## 18. HELPFUL COMMANDS

### 📟 Quick Reference

#### Development
```bash
# Frontend (client/)
npm run dev              # Start dev server (Vite)
npm run build            # Build for production
npm run lint             # Run ESLint

# Backend (server/)
npm start                # Start server
npx prisma studio        # Open Prisma Studio
npx prisma db push       # Push schema changes
npx prisma generate      # Generate Prisma Client
npx prisma migrate dev   # Create migration
```

#### Git
```bash
git status               # Check status
git add .                # Stage all changes
git commit -m "message"  # Commit changes
git push origin branch   # Push to remote
git pull origin main     # Pull from main
```

---

## 19. RESOURCES

### 📖 Documentation Links

- **React:** https://react.dev/
- **TypeScript:** https://www.typescriptlang.org/docs/
- **Prisma:** https://www.prisma.io/docs/
- **Express.js:** https://expressjs.com/
- **Tailwind CSS:** https://tailwindcss.com/docs
- **Vite:** https://vitejs.dev/
- **Zustand:** https://zustand-demo.pmnd.rs/

---

## 20. CONCLUSION

### 🎯 Key Takeaways

1. **Follow existing patterns** - Consistency is key
2. **Minimal changes** - Don't refactor unnecessarily
3. **Type safety** - Use TypeScript properly
4. **Security first** - Validate everything
5. **Standard responses** - Keep API format consistent
6. **Test thoroughly** - Manual testing required for UI
7. **Read PROJECT_CONTEXT.md** - Understand project context

### 📝 Questions?

Nếu có thắc mắc hoặc cần clarification về bất kỳ quy tắc nào:
1. Đọc lại `PROJECT_CONTEXT.md`
2. Kiểm tra code hiện tại để xem pattern được sử dụng
3. Hỏi team lead trước khi thực hiện thay đổi lớn

---

**Document Version:** 1.0  
**Last Updated:** 06/06/2026  
**Maintained by:** Development Team
