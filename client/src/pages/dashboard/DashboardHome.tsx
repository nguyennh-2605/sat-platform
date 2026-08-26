import AdminOverview from './admin-overview/AdminOverview';
import StudentOverview from './student-overview/StudentOverview';
import TeacherOverview from './teacher-overview/TeacherOverview';

export default function DashboardHome() {
  const role = (localStorage.getItem('userRole') || 'STUDENT').toUpperCase();
  if (role === 'ADMIN') return <AdminOverview />;
  if (role === 'TEACHER') return <TeacherOverview />;
  return <StudentOverview />;
}
