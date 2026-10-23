import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from '@/app/AppLayout';
import { AuthLayout } from '@/app/AuthLayout';
import { RequireAuth } from '@/app/RequireAuth';
import { HomePage } from '@/pages/HomePage';
import { NotFoundPage } from '@/pages/NotFoundPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { RegisterPage } from '@/features/auth/RegisterPage';
import { ProjectsPage } from '@/features/projects/ProjectsPage';
import { ProjectDetailPage } from '@/features/projects/ProjectDetailPage';
import { ProjectMembersPage } from '@/features/projects/ProjectMembersPage';
import { TasksPage } from '@/features/tasks/TasksPage';
import { TaskBoardPage } from '@/features/tasks/TaskBoardPage';
import { ReportsPage } from '@/features/reports/ReportsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      {
        element: <RequireAuth />,
        children: [
          { path: 'projects', element: <ProjectsPage /> },
          { path: 'projects/:projectId', element: <ProjectDetailPage /> },
          { path: 'projects/:projectId/tasks', element: <TasksPage /> },
          { path: 'projects/:projectId/board', element: <TaskBoardPage /> },
          { path: 'projects/:projectId/members', element: <ProjectMembersPage /> },
          { path: 'reports', element: <ReportsPage /> },
        ],
      },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    element: <AuthLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/register', element: <RegisterPage /> },
    ],
  },
]);
