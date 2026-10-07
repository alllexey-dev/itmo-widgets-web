# Sport - `/sport`, everyone

- Queues the user waits in (`WAITING`, `NOTIFIED`, not cancelled), each with
  "Выйти" behind the confirmation "Выйти из очереди?".
- The auto-sign limit.
- The last five queues that ended or that the user left.

An auto-sign entry without a found lesson waits for the lesson two weeks after
its sample (`targetLesson` + 14 days). Joining a queue happens only in the app,
which needs the lessons from My ITMO. Leaving forgets `/api/sport` (both queues
and the limit) and reloads.
