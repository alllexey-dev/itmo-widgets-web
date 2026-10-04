import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { Outlet, type RouteObject, useLocation, useNavigate } from 'react-router';
import { onSessionLost } from '../api/client';
import { sessionQueryKey } from '../features/auth/session';
import { NotFoundPage } from './NotFoundPage';
import { RequireAccess } from './RequireAccess';
import { Shell } from './Shell';

import { authRoutes } from '../features/auth/routes';
import { homeRoutes } from '../features/home/routes';
import { moderationRoutes } from '../features/moderation/routes';
import { dashboardRoutes } from '../features/dashboard/routes';
import { usersRoutes } from '../features/users/routes';
import { systemRoutes } from '../features/system/routes';
import { reviewsRoutes } from '../features/reviews/routes';
import { auditRoutes } from '../features/audit/routes';

const LOGIN_PATH = '/login';

/**
 * A lost session on any request leads to the login page without a reload. The login
 * page checks the session itself, so a failed check there is not a lost session.
 */
function SessionLostRedirect() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pathname } = useLocation();
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  useEffect(
    () =>
      onSessionLost(() => {
        if (pathnameRef.current === LOGIN_PATH) return;
        queryClient.removeQueries({ queryKey: sessionQueryKey });
        void navigate(LOGIN_PATH, { replace: true });
      }),
    [navigate, queryClient],
  );
  return <Outlet />;
}

export const routes: RouteObject[] = [
  {
    Component: SessionLostRedirect,
    children: [
      ...authRoutes.routes,
      {
        Component: Shell,
        children: [
          ...homeRoutes.routes,
          { element: <RequireAccess access="moderator" />, children: moderationRoutes.routes },
          {
            element: <RequireAccess access="admin" />,
            children: [
              ...dashboardRoutes.routes,
              ...usersRoutes.routes,
              ...systemRoutes.routes,
              ...reviewsRoutes.routes,
              ...auditRoutes.routes,
            ],
          },
          { path: '*', Component: NotFoundPage },
        ],
      },
    ],
  },
];
