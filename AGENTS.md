# AGENTS.md

Repository of `widgets.alllexey.dev`: the static landing and policy pages (`site/`) and the
Svelte 5 web app on `@alllexey/ui` (`web/`), served by one nginx image behind the shared Caddy edge.

- Layout, app links, policy pages and deploy: [README.md](README.md).
- Web app, commands and section docs: [web/README.md](web/README.md).
- Architecture and conventions: [web/docs/architecture.md](web/docs/architecture.md).
- Design rules: [web/docs/design.md](web/docs/design.md) and `UX.md` in `@alllexey/ui`.
- Ecosystem rules: `AGENTS.md` of the ITMO.Widgets app repository.

Before calling work done, run `scripts/verify.sh` from the repository root (Node 22,
`web/.nvmrc`); for changes to `site/`, `deploy/` or `Dockerfile` also `scripts/verify.sh site`.
User-visible changes get a line in `CHANGELOG.md` under `## Unreleased`.

Never commit or push unless asked. Commit messages: one short line, no body, no AI attribution.
Deploys happen only on request and follow the README.
