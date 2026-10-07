export type TeacherAccessStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export interface TeacherAccessRequest {
  id: string;
  reason: string;
  status: TeacherAccessStatus;
  reviewNote: string | null;
  createdAt: string;
  updatedAt: string;
  reviewedAt: string | null;
  user?: { id: number; name: string | null; email: string; role: string };
}
export interface TeacherAccessResponse {
  role: 'STUDENT' | 'TEACHER' | 'ADMIN';
  request: TeacherAccessRequest | null;
}
export const teacherAccessError = (error: unknown, fallback: string) => {
  const data = (error as { response?: { data?: { error?: string; message?: string } } }).response?.data;
  return data?.error || data?.message || fallback;
};
