# Audit - `/admin/audit`, administrator

The log records who and when changed roles, moderation rules and app version,
started review sync or AI recalculation, hid, showed or regenerated a teacher
summary, or replaced credentials (without values). Actions are listed in
Backend `docs/contracts/admin.md` (Audit); an unknown action shows its own name.

An app version change names its platform: details starting with `IOS: ` are
iOS, others Android.

AI actions are `AI_SUMMARIES_RUN_STARTED` (administrator starts only, target
`ai-summaries`), `AI_SUMMARY_HIDDEN`, `AI_SUMMARY_SHOWN` and
`AI_SUMMARY_REGENERATION_REQUESTED` (target `teacher:N`). Gemini key replacement
has target `credential:GEMINI_API_KEY`.

The page is kept in the URL as `page`.
