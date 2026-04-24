# Eye Sim

Eye Sim is a React + Three.js facial rendering sandbox for procedural eyes, MediaPipe-driven face tracking, and renderer/material investigation. The repo includes the main interactive app plus lab routes for material parity, beauty shading, and offline facecap conditioning.

## Stack

- React 19 + Vite
- Three.js / React Three Fiber / Drei
- MediaPipe face landmarker
- Leva for live controls

## Run Locally

Prerequisite: Node.js 22+ and `pnpm`.

1. Install dependencies:
   `pnpm install`
2. Start the dev server:
   `pnpm dev`
3. Open `http://localhost:3003`

## Commands

- `pnpm dev` starts the local app.
- `pnpm build` builds the production bundle.
- `pnpm lint` runs the TypeScript no-emit check.
- `pnpm inspect:facecap` prints ranked eye-mesh candidates for the facecap asset.
- `pnpm condition:facecap` regenerates the conditioned facecap payload under `data/conditioning/`.

## Project Layout

- `src/routes/` contains the main app route and lab routes.
- `src/features/tracking/` contains the MediaPipe tracking pipeline.
- `src/features/face/` contains face runtime, eye-fit, and material modules.
- `data/conditioning/` stores generated conditioning payloads and manifests.
- `scripts/conditioning/probes/` contains one-off inspection probes for the conditioning bake.
