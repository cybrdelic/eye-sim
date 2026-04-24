# Scripts

- `pnpm inspect:facecap` — Reads the local `public/models/facecap.glb` used by the app and prints the ranked list of mesh candidates under each eye node (useful for debugging auto-fit selection without opening the browser).
- `pnpm condition:facecap` — Rebuilds the conditioned facecap payload in `data/conditioning/facecapConditioning.json` and refreshes the bake manifest in `data/conditioning/facecap.conditioning.json`.
- `scripts/conditioning/probes/` — Holds disposable inspection probes for conditioning/debug work so they do not live at the repo root.
