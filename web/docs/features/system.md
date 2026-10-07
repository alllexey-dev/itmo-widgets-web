# System - `/admin/system`, administrator

Система holds four cards: app version, keys and access, sport automation and
moderation rules. `/admin/sport`, the former sport page, opens the same page
with focus on the sport card.

## Sport automation

Auto-enrolment status includes the last successful run, run count and mean
duration over 7 days, enrolments waiting for auto-enrolment or a free place,
errors over 7 days and the run list.

## App version

App-version fields are latest, minimum and update note, per platform. The iOS
editor appears only on a Backend that keeps platforms apart (BK-17): one probe
per page load asks `/api/app/version-info?platform=PROBE`, and only a 400
`invalid_request` proves it. An older Backend ignores `platform` and answers
Android's values, so saving iOS there would overwrite Android. A save forgets
the platform's version and the audit log.

## Moderation rules

Link moderation settings are premoderation, complaints before review, rating
for review, links per day and complaints per day. Disabling premoderation requires confirmation.
Review moderation has the same thresholds and reviews per day; its
premoderation is always enabled and has no switch. A save forgets the
moderation lists (turning premoderation off approves the waiting queue) and the
audit log.

## Keys and access

Credentials include My ITMO refresh, access and ID tokens, the ISU
`KEYCLOAK_IDENTITY` cookie and the Gemini key. Replacement is available for
the refresh token, cookie and Gemini key. Backend operations are described in
`docs/ops/service-credentials.md` in `itmo-widgets-backend`.

The card lists `GET /api/admin/system/credentials`: the name, the status
with the last error for `FAILED` and `EXPIRED`, the expiry with "Скоро", the
last use and renewal, and who changed the value (a link to the admin's user page
for `ADMIN`). Values never reach the browser. `ReplaceCredentialDialog` holds
the new value only in a password field and the request body; it is never part
of a cache key, and closing the dialog clears the field. A 400 marks the field
"Проверьте значение"; the returned list replaces the shown one and the audit
log is forgotten. `GEMINI_API_KEY` (kind `API_KEY`) is replaceable like the
refresh token and the ISU cookie; the dialog hints "Ключ из Google AI Studio".

The list is polled every 3 s while a value that is still `UNKNOWN` was changed
less than 2 minutes ago, so the result of its first use shows up by itself.
