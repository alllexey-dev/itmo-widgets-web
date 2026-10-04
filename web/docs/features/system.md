# Sport and system

## Sport - `/admin/sport`, administrator

Auto-enrolment status includes the last successful run, run count and mean
duration over 7 days, enrolments waiting for auto-enrolment or a free place,
errors over 7 days and the run list.

## System - `/admin/system`, administrator

App-version fields are latest, minimum and update note. Link moderation settings
are premoderation, complaints before review, rating for review, links per day
and complaints per day. Disabling premoderation requires confirmation.
Review moderation has the same thresholds and reviews per day; its
premoderation is always enabled and has no switch.

Credentials include My ITMO refresh, access and ID tokens, the ISU
`KEYCLOAK_IDENTITY` cookie and the Gemini key. Replacement is available for
the refresh token, cookie and Gemini key. Backend operations are described in
`docs/ops/service-credentials.md` in `itmo-widgets-backend`.

## Credential implementation

`CredentialsCard` on the system page lists `GET /api/admin/system/credentials`
in a table: the name, the status badge with the last error for `FAILED` and
`EXPIRED`, the expiry with "Скоро", the last use and renewal, and who changed
the value (a link to the admin's user page for `ADMIN`). Values never reach the
browser. `ReplaceCredentialDialog` holds the new value only in a password field
and the mutation body: it is never part of a query key, the mutation has
`gcTime: 0` so the finished mutation and its variables leave the cache at once,
and closing the dialog clears the field. A 400 marks the field "Проверьте
значение"; the returned list replaces the cached one and the audit log is
invalidated.

`GEMINI_API_KEY` (kind `API_KEY`) is replaceable like the refresh token and
the ISU cookie; the dialog hints "Ключ из Google AI Studio".

The service credentials
(`['admin', 'system', 'credentials']`) are polled every 3 s while a value that
is still `UNKNOWN` was changed less than 2 minutes ago, so the result of its
first use shows up by itself.
