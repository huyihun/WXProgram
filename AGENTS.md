# AGENTS.md

## Project overview

This repository is a Uni App + Vue 3 mini-program project for a personal WeChat app. It also contains cloud functions under `cloudfunctions/`, a local code-assist system under `code-assist/`, and app logic under `src/`.

## Core working rules

- Follow the project rules in `.cursor/rules/*.md`.
- Keep changes minimal and consistent with the existing code style.
- Prefer the existing patterns already used in the surrounding file instead of introducing a new abstraction.
- Do not add broad refactors unrelated to the current task.
- Prefer early returns and flat logic over deeply nested conditionals.

## Required conventions

### Vue / page code

- Use `<script setup>` for Vue SFCs.
- Use `PageRoot` as the root of pages; do not manually build a page shell or custom nav.
- Do not add custom navigation bar code inside pages.
- Use `onMounted` or `onLoad` for initial data fetches; avoid `onShow` for primary data loading.
- Keep templates simple; avoid long inline logic.

### JS / project code

- Do not use optional chaining `?.`.
- Do not use nullish coalescing `??`; use `||` for defaults.
- Keep business logic readable and direct.
- Add brief comments only when the intent is not obvious.

### Cloud DB rules

- When fetching list data from cloud DB, do not assume a single `.limit(20).get()` call is the full result set.
- Must use pagination loops (`skip + limit(20)`) until fewer than 20 records are returned.
- Prefer one collection with a `kind` / `type` discriminator instead of creating many collections unless the access pattern strongly differs.

## Repo-specific commands

Use the existing scripts in `package.json`:

- `npm run dev` for local app dev
- `npm run build` for production build
- `npm run code-assist:publish -- --project <slug>` for the code-assist publish flow
- other asset scripts as needed for books, wallpapers, and resources

## When patching code

1. Read the exact file and nearby usage before editing.
2. Match the existing file’s structure and naming.
3. Make the smallest valid change.
4. Validate with the closest relevant command, usually a targeted build or script check when available.

## Constraints

- Do not claim the fix is complete without verification.
- Do not invent missing API contracts, routes, or business flows when the repo does not provide evidence.
- If evidence is missing, say so clearly and propose the minimal next step.
