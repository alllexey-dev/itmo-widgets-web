import { VStack } from '@astryxdesign/core/Stack';
import { useApiQuery } from '../lib/data';
import { Loadable } from '../lib/Loadable';
import { PageHeader } from '../lib/PageHeader';
import { eagerPage, type RouteSpec } from '../lib/router';
import { routes } from '../routes';

/** The route table with the page of one route replaced, e.g. by a probe that loads data. */
export function withPage(name: string, page: () => React.JSX.Element): RouteSpec[] {
  return routes.map((spec) => (spec.name === name ? { ...spec, page: eagerPage(page) } : spec));
}

/**
 * A minimal data page for tests of the core: the shape every section page follows. It reads
 * `GET /api/admin/users` as the list of names.
 */
export function UsersProbe() {
  const users = useApiQuery<string[]>('/api/admin/users');
  return (
    <VStack gap={6}>
      <PageHeader title="Проба" />
      <Loadable resource={users} label="Загружаем список" errorTitle="Не удалось загрузить список">
        {(list) => (
          <ul aria-label="Список">
            {list.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        )}
      </Loadable>
    </VStack>
  );
}
