# PROJECT CONTEXT

## Overview
A full-stack educational testing platform (SAT-focused) that enables teachers to manage complex test banks (folders, tests, sections, questions), assign work to classes, and allows students to take tests and submit answers.

## Tech Stack
- Backend: Node.js, Express.js
- Database ORM: Prisma
- Database: PostgreSQL
- Frontend: React, TypeScript
- Styling: Tailwind CSS
- Icons: Lucide React
- HTTP Client: Axios

## Architecture
- Client-Server architecture with a RESTful API backend
- Highly relational database structure:
  Folder -> Test -> Section -> Question -> Answer
- Frontend uses:
  - Controlled components
  - Recursive rendering for hierarchical data (Tree Views)
  - Centralized API client configuration
- Authentication middleware injects `req.user.userId` into requests

## Folder Structure
```text
/server
  /prisma
    schema.prisma
  /src
    /controllers
    /routes
    /middlewares

/client
  /src
    /components
    /pages
    /types
```

## Important File Notes
- schema.prisma: single source of truth for database schema

Note:
- Some logic may not be perfectly separated (controllers may contain mixed logic)
- Follow existing patterns instead of restructuring files

## AI Behavior Rules (CRITICAL)
- Do NOT refactor unrelated parts of the codebase
- Do NOT rename variables/functions unless necessary
- Do NOT move files unless explicitly asked
- Do NOT reorganize folder structure unless explicitly asked
- Always preserve existing logic unless fixing a bug
- Prefer minimal changes over large rewrites
- Follow existing patterns in the codebase

## Naming Conventions
- React components: PascalCase (e.g., FolderNode.tsx)
- Variables & functions: camelCase
- Backend files: camelCase (e.g., testController.js)
- Prisma models: PascalCase (singular)
- API routes: plural nouns, kebab-case (e.g., /api/test-bank/folders)

## State Management Rules (Frontend)
- Never mutate state directly
- Use functional updates:
- setItems(prev => [...prev, newItem])
- Prefer local state unless global state is necessary
- Use flat arrays with parentId for hierarchy
- Avoid deeply nested state

## Coding Rules
- Use strict TypeScript interfaces (no Number, only number)
- Use Tailwind CSS only (no external CSS frameworks)
- Maintain existing color palette
- Use recursive components for hierarchical data
- Prevent invalid operations (e.g., moving folder into itself)

## Database Rules
- Always update schema.prisma first when modifying DB
- Always evaluate onDelete: Cascade for relations
- Avoid circular dependencies
- Use select to minimize payload size

## API Rules
All endpoints MUST return:
```json
{
  "success": boolean,
  "message": string,
  "data": any
}
```
- Use HTTP status codes: 200, 400, 500
- Do NOT return sensitive data (passwords, tokens)
- Ensure consistent response format (frontend depends on it)

## Error Handling
- Always use try/catch in backend controllers
- Return errors using standard API format
- Do NOT expose internal stack traces
- Handle null/undefined safely in frontend

## Performance Guidelines
- Avoid unnecessary re-renders in React
- Use memoization when needed
- Avoid large unnecessary data fetches

## Security Notes
- Validate all inputs on backend
- Never trust client-side data
- Sanitize inputs before DB operations

## Current Features
- Prisma schema with Users, Roles, Classes, Assignments, Folders, Tests, Sections, Questions, Submissions, ErrorLogs
- Test bank management (create, delete, move)
- Recursive folder tree UI
- Role-based data separation
- Class and assignment management
- Test execution and submission tracking

## Constraints (STRICT)
- DO NOT modify PrismaClient initialization
- DO NOT remove onDelete: Cascade
- DO NOT change API response format
- DO NOT introduce new CSS frameworks
- DO NOT break existing frontend Axios expectations

## When Adding New Features
Follow this order:

Database
- Update schema.prisma
- Validate relations and cascade rules
- Run: npx prisma db push

Backend
- Create isolated controller logic
- Wrap DB calls in try/catch

Routing
- Define static routes before dynamic routes

Frontend
- Define TypeScript interfaces first
- Implement UI using existing patterns

API Calls
- Use useEffect for fetching
- Handle loading and error states

## Instruction Priority
- Follow rules in this file over general best practices if there is a conflict.