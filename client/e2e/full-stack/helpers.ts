import { expect, type APIRequestContext, type Page } from '@playwright/test';

export const API_URL = process.env.E2E_API_URL || 'http://127.0.0.1:5000';
export const E2E_PASSWORD = 'E2ePilot!2026';

export type TestUser = {
  id: number;
  name: string;
  email: string;
  password: string;
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
  const response = await request.post(`${API_URL}/api/register`, {
    data: { email, password: E2E_PASSWORD, name, role },
  });
  if (!response.ok()) throw new Error(`POST /api/register: ${await responseBody(response)}`);
  const payload = await response.json() as { accessToken: string; user: { id: number; name: string; email: string; role: TestUser['role'] } };
  return { ...payload.user, password: E2E_PASSWORD, accessToken: payload.accessToken };
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
  await page.goto('/auth');
  await page.getByLabel('Email').fill(user.email);
  await page.getByLabel('Password', { exact: true }).fill(user.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard(?:\/|$)/);
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
