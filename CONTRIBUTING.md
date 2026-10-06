# Contributing to AngeLifeline

Thanks for helping improve the crisis overlay and embed packages. This project is **MIT** — contributions are welcome under the same license.

## Before you start

- **Bugs and ideas:** Open a GitHub issue. Describe what you expected, what happened, and whether it affects embedders, routing, or the sandbox app.
- **Security:** Do not open public issues for undisclosed vulnerabilities. Contact the maintainers privately.

## Pull requests

PRs are welcome. Prefer **small, focused** changes (one fix or feature per PR).

1. Fork and create a branch from `main`.
2. Install and run locally:

   ```bash
   npm install
   npm run dev          # optional: manual check of the sandbox
   npm run lint
   npm test             # rule-based crisis detection
   npm run build        # required before you open a PR
   ```

3. If you change routing, disclaimers, or API shapes, update **README.md** or **docs/** when behavior or embed steps change.
4. Keep default user-facing copy in `packages/*` generic so any host app can embed the plugin.
5. Open a PR with a short summary and how you tested (e.g. `npm run build`, sandbox chat).

Maintainers may ask for edits or suggest splitting large PRs. We do not require a CLA.

## Where code lives

| Area | Path |
|------|------|
| Routing, helplines, disclaimers | `packages/core` |
| Overlay UI | `packages/react` |
| Next.js API route handlers | `packages/next` |
| Sandbox app | repo root (`app/`, `next.config.ts`) |

## Questions

Open an issue if you are unsure about routing policy or embed responsibilities — especially anything that affects emergency numbers or user-facing disclaimers.
