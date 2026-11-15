# AGENTS.md

Repository of `widgets.alllexey.dev`: one Vite app in `web/` (React 19, TypeScript, the Astryx design
system) that builds both the prerendered public pages (landing, policy, link pages) and the cabinet SPA
under `/app/`, served by one nginx image behind the shared Caddy edge.

- Layout, public pages, app links, headers and deploy: [README.md](README.md).
- Cabinet, commands and section docs: [web/README.md](web/README.md).
- Architecture and conventions: [web/docs/architecture.md](web/docs/architecture.md).
- Design rules: [web/docs/design.md](web/docs/design.md); Astryx cheat sheet: [web/AGENTS.md](web/AGENTS.md).
- Ecosystem rules: `AGENTS.md` of the ITMO.Widgets app repository.

Before calling work done, run `scripts/verify.sh` from the repository root (Node 22, `web/.nvmrc`); for
changes to public pages, `deploy/` or `Dockerfile` also `scripts/verify.sh site`. User-visible changes get
a line in `CHANGELOG.md` under `## Unreleased`.

Never commit or push unless asked. Commit messages: one short line, no body, no AI attribution.
Deploys happen only on request and follow the README.
