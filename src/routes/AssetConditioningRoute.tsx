import AppNav from '../components/AppNav';

const PHASES = [
  {
    title: 'Phase 1: Asset Conditioning',
    body:
      'Isolate head skin, separate non-skin meshes, preserve morph targets, and author canonical anatomical anchors plus semantic region masks.',
  },
  {
    title: 'Phase 2: Material Foundation',
    body:
      'Build the baseline skin stack around stable UV-tied signals: albedo, roughness, AO, cavity, micro normal, thickness, and region atlases.',
  },
  {
    title: 'Phase 3: Expression Overlays',
    body:
      'Drive blush, wrinkles, folds, and lip response from semantic masks multiplied by expression strength, not from runtime geometry discovery.',
  },
  {
    title: 'Phase 4: WebGPU Beauty Lab',
    body:
      'Compare conditioned baseline against beauty overlays in a controlled route so renderer work is isolated from asset-prep work.',
  },
];

const OUTPUTS = [
  'Head skin mesh separated from eyes, teeth, and mouth interior',
  'Canonical anchor manifest with left/right eye, nose tip, nose base, mouth center, chin, and forehead center',
  'Semantic region masks for cheeks, nose, lips, philtrum, forehead, under-eyes, chin, neck exclusion, ear exclusion, and scalp exclusion',
  'Stable material inputs for albedo, roughness, AO, cavity, micro normal, and thickness or scatter masking',
];

const RULES = [
  'Runtime can modulate mask strength from smile, squint, brow raise, or lip compression.',
  'Runtime does not discover where cheeks, lips, forehead, or chin live on the mesh.',
  'Spatial semantics belong in the conditioned asset, not in ad hoc object-space math.',
];

export default function AssetConditioningRoute() {
  return (
    <div className="min-h-screen bg-stone-950 text-stone-100">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col px-6 py-8">
        <AppNav />

        <div className="mt-10 grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(251,191,36,0.12),_transparent_38%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 shadow-2xl shadow-black/20">
            <p className="text-xs uppercase tracking-[0.32em] text-stone-400">Clean Page</p>
            <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight text-stone-50">Offline Asset Conditioning Pipeline</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-300">
              This route replaces the failed coordinate-hack approach with an asset-first pipeline. Facial regions should be authored once, baked into stable data, and only modulated at runtime. The beauty lab should consume conditioned inputs, not discover anatomy from shared materials and raw vertex positions.
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {PHASES.map((phase) => (
                <article key={phase.title} className="rounded-[1.5rem] border border-white/10 bg-black/25 p-5">
                  <h2 className="text-lg font-medium text-stone-100">{phase.title}</h2>
                  <p className="mt-2 text-sm leading-6 text-stone-300">{phase.body}</p>
                </article>
              ))}
            </div>
          </section>

          <section className="space-y-6">
            <article className="rounded-[2rem] border border-amber-300/20 bg-amber-100/5 p-6">
              <p className="text-xs uppercase tracking-[0.28em] text-amber-200/70">Immediate Next Step</p>
              <p className="mt-3 text-sm leading-6 text-amber-50/90">
                Run <span className="font-mono text-amber-100">pnpm condition:facecap</span> to emit the conditioning JSON payload and manifest in <span className="font-mono text-amber-100">data/conditioning</span>. That directory is the handoff point for anchor authoring, mesh separation, and semantic mask baking.
              </p>
            </article>

            <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-stone-100">Conditioned Outputs</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                {OUTPUTS.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">{item}</li>
                ))}
              </ul>
            </article>

            <article className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
              <h2 className="text-xl font-semibold text-stone-100">Runtime Rules</h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-stone-300">
                {RULES.map((item) => (
                  <li key={item} className="rounded-2xl border border-white/8 bg-black/20 px-4 py-3">{item}</li>
                ))}
              </ul>
            </article>
          </section>
        </div>
      </div>
    </div>
  );
}
