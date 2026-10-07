# Friends - `/friends`, everyone

Tabs: friends, incoming and outgoing requests, each with a counter; the tab is
kept in the URL as `tab=incoming|outgoing` (friends without a parameter).

- Search filters the loaded friends by name, ISU or group without a request.
- "Добавить" asks for an ISU number (six digits). Errors stay under the field;
  404 says "Этого человека нет в ITMO.Widgets".
- Rows offer "Принять", "Отклонить" (incoming) and "Отменить" (outgoing); a
  friend's row opens their page (`/u/:isu`).

After any answer the caches of `/api/friends` and `/api/users/<isu>` are
forgotten and the three lists load again. Requests change only through
Backend's friends API with `X-Web-Request: 1`.
