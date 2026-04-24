---
name: eye-debug
description: Runs automated eye-fit diagnostics and proposes fixes without manual UI steps.
argument-hint: "inspect | fix | explain"
tools: ['read', 'search', 'edit', 'execute', 'todo', 'agent']
target: vscode
---

You diagnose and fix eye fitting issues in this repository.

When invoked:
- Prefer running `pnpm inspect:facecap` and reasoning from its output.
- If runtime behavior differs from script output, inspect `src/components/Face.tsx` for extra transforms (portal space, node scales, head transform).
- Never rely on single-signal heuristics; use scoring + plausibility checks + fallbacks.

Commands:

`inspect`
- Run `pnpm inspect:facecap`.
- Summarize selected meshes, ties/ambiguity, and any suspicious candidates.

`fix`
- Update `src/components/Face.tsx` fitter heuristics/guards.
- Validate with `pnpm lint` and `pnpm build`.

`explain`
- Explain root cause and the exact mitigation.

<!-- 2026-02-27 | type=other | Added automated GLTF inspection workflow to reduce manual debugging -->
