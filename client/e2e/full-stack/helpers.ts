import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:5000';

export type TestUser = {
  id: number;
  name: string;
  email: string;
  refreshToken: string;
  role: 'STUDENT' | 'TEACHER';
  accessToken: string;
};

export const uniqueName = (prefix: string) => `${prefix} ${crypto.randomUUID().slice(0, 8)}`;

const responseBody = async (response: { text(): Promise<string> }) => {
  const text = await response.text();
  return text || '<empty response>';
};

export async function registerUser(
  request: APIRequestContext,
  role: TestUser['role'],
  label: string,
): Promise<TestUser> {
  const suffix = crypto.randomUUID();
  const email = `e2e.${label}.${suffix}@example.test`;
  const name = uniqueName(`E2E ${label}`);
  void request;
  const databaseUrl = process.env.E2E_DATABASE_URL || process.env.DATABASE_URL || '';
  const fixtureScript = fileURLToPath(new URL('../../../server/scripts/e2e-google-session.js', import.meta.url));
  const output = execFileSync(process.execPath, [fixtureScript, email, name, role], {
    env: { ...process.env, NODE_ENV: 'test', DATABASE_URL: databaseUrl, JWT_SECRET: process.env.JWT_SECRET || 'e2e-only-secret-with-sufficient-entropy-do-not-use-in-production' },
    encoding: 'utf8', timeout: 30000,
  });
  const payload = JSON.parse(output) as { accessToken: string; refreshToken: string; user: { id: number; name: string; email: string; role: TestUser['role'] } };
  return { ...payload.user, refreshToken: payload.refreshToken, accessToken: payload.accessToken };
}

export async function apiJson<T>(
  request: APIRequestContext,
  user: TestUser,
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  path: string,
  data?: unknown,
): Promise<T> {
  const response = await request[method](`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${user.accessToken}` },
    ...(data === undefined ? {} : { data }),
  });
  if (!response.ok()) throw new Error(`${method.toUpperCase()} ${path}: ${await responseBody(response)}`);
  return response.status() === 204 ? undefined as T : await response.json() as T;
}

export async function loginThroughUi(page: Page, user: TestUser) {
  await page.context().addCookies([{ name: 'refresh_token', value: user.refreshToken, domain: new URL(API_URL).hostname, path: '/api/auth', httpOnly: true, secure: API_URL.startsWith('https:'), sameSite: 'Lax' }]);
  await page.goto('/auth');
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
  user.refreshToken = (await page.context().cookies(`${API_URL}/api/auth/refresh`)).find(cookie => cookie.name === 'refresh_token')?.value || user.refreshToken;
}

export async function createClassWithStudent(
  request: APIRequestContext,
  teacher: TestUser,
  student: TestUser,
) {
  const classroom = await apiJson<{ id: string; name: string }>(request, teacher, 'post', '/api/classes', {
    name: uniqueName('E2E Pilot Class'),
    color: '#1B7A5A',
  });
  await apiJson(request, teacher, 'post', `/api/classes/${classroom.id}/students`, { email: student.email });
  return classroom;
}

export async function createPublishedPracticeTest(request: APIRequestContext, teacher: TestUser) {
  return apiJson<{ id: number; title: string }>(request, teacher, 'post', '/api/tests/create', {
    title: uniqueName('E2E Golden Path Test'),
    duration: 10,
    subject: 'RW',
    mode: 'PRACTICE',
    status: 'PUBLISHED',
    sections: [{
      name: 'Module 1',
      order: 1,
      questions: [{
        questionText: 'Which option is the intended correct answer?',
        correctAnswer: 'B',
        type: 'MCQ',
        explanation: 'Option B is intentionally correct for the golden path.',
        blocks: [],
        choices: [
          { id: 'A', text: 'Option A' },
          { id: 'B', text: 'Option B' },
          { id: 'C', text: 'Option C' },
          { id: 'D', text: 'Option D' },
        ],
        domainCode: 'RW_INFORMATION_AND_IDEAS',
        skillCode: 'RW_INFERENCES',
      }],
    }],
  });
}
