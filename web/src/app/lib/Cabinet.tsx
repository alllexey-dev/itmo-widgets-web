import { useState } from 'react';
import { Route, Routes, useParams } from 'react-router';
import { CabinetShell } from './CabinetShell';
import { Forbidden } from './Forbidden';
import { NotFound } from './NotFound';
import { PagesProvider, PageStore, RoutePage } from './pages';
import { validParams, type RouteSpec } from './router';
import { hasAccess, useSession } from './session';

/** A route inside the shell: an invalid parameter is "Не найдено", a missing role "Нет доступа". */
function Guarded({ spec }: { spec: RouteSpec }) {
  const { user } = useSession();
  const params = useParams();
  if (!validParams(params)) return <NotFound />;
  if (!hasAccess(user, spec.access)) return <Forbidden access={spec.access} />;
  return <RoutePage spec={spec} />;
}

/**
 * Renders the route table: anonymous routes (the login page) on their own, every other route
 * inside the shell, an unknown address as "Не найдено" inside the shell.
 */
export function Cabinet({ routes }: { routes: readonly RouteSpec[] }) {
  const [pages] = useState(() => new PageStore());
  return (
    <PagesProvider value={pages}>
      <Routes>
        {routes
          .filter((spec) => spec.access === 'anonymous')
          .map((spec) => (
            <Route key={spec.name} path={spec.path} element={<RoutePage spec={spec} />} />
          ))}
        <Route element={<CabinetShell routes={routes} />}>
          {routes
            .filter((spec) => spec.access !== 'anonymous')
            .map((spec) => (
              <Route key={spec.name} path={spec.path} element={<Guarded spec={spec} />} />
            ))}
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </PagesProvider>
  );
}
