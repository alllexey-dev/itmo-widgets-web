# Changelog

## Unreleased

- WV-05: Build the student sections of the web v3: friend requests, sport queues, audiences and the app on Главная; Друзья with tabs, local search and adding by ISU; a person's page with schedule, sport and friends by capability; own sport queues with leaving and the auto-sign limit; Профиль with privacy, an active restriction and sign-out.
- WV-03: Build the web v3 home with the staff attention card and the admin 7-day card, statistics on the shared uPlot chart, users with search, devices per platform and the moderator switch, and the audit log.
- WV-02: Port moderation to the Svelte web v3: one queue for links and reviews with a split view on wide screens, case details with diffs, decisions with required reasons and typed confirmation, J/K/A/R shortcuts, shareable URL state, and the restrictions tab at the old address.
- WV-04: Build Система and Отзывы in the web v3: per-platform app versions with the iOS editor only on a Backend that keeps platforms apart, credentials with replacement and polling, sport automation (also at /app/admin/sport), moderation rules, reviews sync, ISU check, AI summaries, the teachers table and the summary dialog.
- WV-01: Start the Svelte web v3 in web-next/ with the role-based cabinet shell, history router keeping every /app/ URL, session and lost-session dialog, phone sign-in, CSP preview, and run both apps in scripts/verify.sh.
- WB-16a: Rebuild the web app on the shared @alllexey/ui design system and its UX rules: navigation rail, shared alllexey.dev theme, package fonts and icons, four states per screen and typed confirmation for destructive actions.
- BK-15w: Match the signed-out fixture to Backend 401 responses and verify legacy session compatibility and access-error routing.
- WB-11a: Generate landing and app tokens from one recorded web token source.

- WB-02: Drop the untracked design drafts by owner decision, exclude design/ from the image context, and fail verification on unreferenced landing images.
- WB-15: Guard moderation labels and icons against the recorded app catalog with explicit moderator wording exceptions.

- WB-06: Prepare verified immutable GHCR delivery to dev and approved production delivery; keep server onboarding owner-only and compose local.
- WB-04: Self-host typed Material Symbols with a verified subset, add CSP and Permissions-Policy, and update the approved privacy wording and date.

- WB-01: Correct Caddy routing and the temporary production /app/ procedure; remove the obsolete edge snippet and document all shared UI components.
- CI-04: Add locked-dependency verification, local image smoke checks and pull request CI.
- WB-03: Refresh React and pin container images and QR dependencies.
- WB-05: Enforce feature boundaries and centralize shared types.
- WB-13: Load feature routes lazily through a data router.
- WB-07: Generate API type aliases from the recorded Backend OpenAPI snapshot and verify drift.

## Pre-v2.3 history

### 2026-10-03

- `e8c6f36`: Move the landing to the day-in-the-life layout and share its style across pages.
- `9f4f2e4`: Rewrite the privacy policy and add the account deletion page.

### 2026-10-02

- `0e4cd2c`: Document assetlinks.json and the app link pages.
- `f4ade46`: Serve assetlinks.json and app-free pages for shared profile and sport links.

### 2026-09-29

- `678e22a`: Document AI summaries, the Gemini key and their audit entries in the admin.
- `be1ba54`: Add AI summaries, the Gemini key and their audit entries to the admin.
- `53a7e99`: Document review cases, service credentials and ISU check counters in the admin.
- `5824537`: Add teacher reviews, service credentials and ISU check counters to the admin.

### 2026-09-24

- `6834fd7`: Document the reviews sync.
- `ba3fdd7`: Add reviews sync to the admin.
- `00a390a`: Document the web app sections, architecture and design.
- `519ebb9`: Add moderation, users, dashboard, sport, system and audit to the admin.
- `ae99c8e`: Sign in to the web app with a QR code approved in the app.
- `73c3495`: Add the web app shell under /app with the landing in one image.
- `1d7cc58`: Rename the site container and server directory to itmowidgets-web.

### 2026-09-20

- `923ac6c`: Keep compose at the repository root so the site path resolves.
- `451f789`: Drop the FAQ section.
- `94d134d`: Four features, one sentence each, unstretched screenshots.
- `5b43660`: Add the container and nginx-hub snippet for deployment.
- `46db836`: Show more of each screen in the feature cards.
- `50ffeb2`: Landing page, privacy policy and FAQ with fixture screenshots.
