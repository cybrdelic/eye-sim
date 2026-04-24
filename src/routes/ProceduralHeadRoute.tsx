import React, { startTransition, useDeferredValue, useMemo, useState } from 'react';
import AppNav from '../components/AppNav';
import CanvasErrorBoundary from '../components/CanvasErrorBoundary';
import { ProceduralHeadCanvas } from '../features/procedural-head/scene';
import type {
  ProceduralExpressionPreset,
  ProceduralHeadIdentity,
  ProceduralHeadMaterialMode,
  ProceduralHeadQuality,
  ProceduralHeadStats,
} from '../features/procedural-head/types';
import {
  DEFAULT_PROCEDURAL_IDENTITY,
  PROCEDURAL_EXPRESSION_PRESETS,
  PROCEDURAL_QUALITY_CONFIG,
} from '../features/procedural-head/types';

const IDENTITY_CONTROLS: Array<{
  key: keyof Omit<ProceduralHeadIdentity, 'seed'>;
  label: string;
}> = [
  { key: 'faceWidth', label: 'Face width' },
  { key: 'skullHeight', label: 'Skull height' },
  { key: 'jawWidth', label: 'Jaw width' },
  { key: 'cheekbone', label: 'Cheekbone' },
  { key: 'browRidge', label: 'Brow ridge' },
  { key: 'noseProjection', label: 'Nose projection' },
  { key: 'noseWidth', label: 'Nose width' },
  { key: 'lipFullness', label: 'Lip fullness' },
  { key: 'eyeSpacing', label: 'Eye spacing' },
  { key: 'eyeScale', label: 'Eye scale' },
  { key: 'melanin', label: 'Melanin' },
  { key: 'hemoglobin', label: 'Hemoglobin' },
  { key: 'poreScale', label: 'Pore scale' },
  { key: 'oiliness', label: 'Oiliness' },
  { key: 'age', label: 'Age detail' },
];

function Slider({
  identity,
  identityKey,
  label,
  setIdentity,
}: {
  identity: ProceduralHeadIdentity;
  identityKey: keyof Omit<ProceduralHeadIdentity, 'seed'>;
  label: string;
  setIdentity: React.Dispatch<React.SetStateAction<ProceduralHeadIdentity>>;
}) {
  return (
    <label className="grid gap-1 text-[11px] text-stone-300">
      <span className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono text-stone-500">{identity[identityKey].toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={identity[identityKey]}
        onChange={(event) => {
          const value = Number(event.target.value);
          startTransition(() => {
            setIdentity((current) => ({ ...current, [identityKey]: value }));
          });
        }}
        className="accent-lime-300"
      />
    </label>
  );
}
function RouteShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative h-screen w-full overflow-hidden bg-[#151716] text-stone-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_28%_18%,rgba(203,255,183,0.16),transparent_32%),radial-gradient(circle_at_78%_12%,rgba(255,214,170,0.12),transparent_28%),linear-gradient(135deg,rgba(255,255,255,0.03),transparent_42%)]" />
      <div className="absolute left-0 right-0 top-0 z-30 flex items-center justify-between px-4 py-3">
        <AppNav />
        <div className="pointer-events-none hidden rounded-full border border-lime-200/15 bg-lime-200/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-lime-100/75 md:block">
          Procedural Generator
        </div>
      </div>
      {children}
    </div>
  );
}

export default function ProceduralHeadRoute() {
  const [identity, setIdentity] = useState<ProceduralHeadIdentity>(DEFAULT_PROCEDURAL_IDENTITY);
  const [quality, setQuality] = useState<ProceduralHeadQuality>('balanced');
  const [materialMode, setMaterialMode] = useState<ProceduralHeadMaterialMode>('beauty');
  const [preset, setPreset] = useState<ProceduralExpressionPreset>('neutral');
  const [strength, setStrength] = useState(1);
  const [showStats, setShowStats] = useState(false);
  const [stats, setStats] = useState<ProceduralHeadStats | null>(null);
  const deferredIdentity = useDeferredValue(identity);

  const expressions = useMemo(() => PROCEDURAL_EXPRESSION_PRESETS[preset].values, [preset]);
  const activePreset = PROCEDURAL_EXPRESSION_PRESETS[preset];

  return (
    <RouteShell>
      <CanvasErrorBoundary>
        <div className="absolute inset-0">
          <ProceduralHeadCanvas
            expressions={expressions}
            identity={deferredIdentity}
            materialMode={materialMode}
            onStats={setStats}
            quality={quality}
            showStats={showStats}
            strength={strength}
          />
        </div>
      </CanvasErrorBoundary>

      <section className="absolute bottom-4 left-4 top-20 z-20 flex w-[min(360px,calc(100vw-2rem))] flex-col gap-3 overflow-hidden rounded-[2rem] border border-white/10 bg-black/52 p-4 text-sm shadow-2xl backdrop-blur-2xl">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-lime-200/75">In-house procedural head</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-50">Generated, baked, then rendered</h1>
          <p className="mt-2 text-xs leading-5 text-stone-400">
            This lab creates procedural topology, procedural skin maps, separate oral materials, and ARKit-style expression targets without Facecap or photogrammetry.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1 text-xs">
          {(['beauty', 'maps', 'topology'] as ProceduralHeadMaterialMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setMaterialMode(mode)}
              className={`rounded-xl px-2 py-1.5 capitalize transition ${materialMode === mode ? 'bg-lime-200 text-stone-950' : 'text-stone-300 hover:bg-white/10'}`}
            >
              {mode}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-white/5 p-1 text-xs">
          {(Object.keys(PROCEDURAL_QUALITY_CONFIG) as ProceduralHeadQuality[]).map((nextQuality) => (
            <button
              key={nextQuality}
              onClick={() => setQuality(nextQuality)}
              className={`rounded-xl px-2 py-1.5 transition ${quality === nextQuality ? 'bg-stone-100 text-stone-950' : 'text-stone-300 hover:bg-white/10'}`}
            >
              {PROCEDURAL_QUALITY_CONFIG[nextQuality].label}
            </button>
          ))}
        </div>

        <label className="grid gap-1 text-[11px] text-stone-300">
          <span className="flex items-center justify-between">
            <span>Seed</span>
            <span className="font-mono text-stone-500">{identity.seed}</span>
          </span>
          <input
            value={identity.seed}
            onChange={(event) => {
              const seed = event.target.value;
              startTransition(() => setIdentity((current) => ({ ...current, seed })));
            }}
            className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-mono text-xs text-stone-100 outline-none transition focus:border-lime-200/50"
          />
        </label>

        <div className="min-h-0 flex-1 overflow-auto pr-1">
          <div className="grid gap-2">
            {IDENTITY_CONTROLS.map((control) => (
              <Slider
                key={control.key}
                identity={identity}
                identityKey={control.key}
                label={control.label}
                setIdentity={setIdentity}
              />
            ))}
          </div>
        </div>
      </section>

      <section className="absolute bottom-4 right-4 z-20 w-[min(420px,calc(100vw-2rem))] rounded-[2rem] border border-white/10 bg-black/52 p-4 shadow-2xl backdrop-blur-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-amber-200/75">Expression system</p>
            <h2 className="mt-1 text-lg font-semibold text-stone-50">{activePreset.label}</h2>
            <p className="mt-1 text-xs leading-5 text-stone-400">{activePreset.description}</p>
          </div>
          <label className="flex items-center gap-2 text-[11px] text-stone-400">
            <input type="checkbox" checked={showStats} onChange={(event) => setShowStats(event.target.checked)} className="accent-lime-300" />
            Stats
          </label>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-1">
          {(Object.keys(PROCEDURAL_EXPRESSION_PRESETS) as ProceduralExpressionPreset[]).map((nextPreset) => (
            <button
              key={nextPreset}
              onClick={() => setPreset(nextPreset)}
              className={`rounded-xl px-2 py-1.5 text-xs transition ${preset === nextPreset ? 'bg-amber-200 text-stone-950' : 'bg-white/5 text-stone-300 hover:bg-white/10'}`}
            >
              {PROCEDURAL_EXPRESSION_PRESETS[nextPreset].label}
            </button>
          ))}
        </div>

        <label className="mt-3 grid gap-1 text-[11px] text-stone-300">
          <span className="flex items-center justify-between">
            <span>Expression strength</span>
            <span className="font-mono text-stone-500">{strength.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1.25}
            step={0.01}
            value={strength}
            onChange={(event) => setStrength(Number(event.target.value))}
            className="accent-amber-200"
          />
        </label>

        <div className="mt-3 grid grid-cols-4 gap-2 text-[10px] uppercase tracking-[0.16em] text-stone-500">
          <div className="rounded-2xl border border-white/8 bg-white/5 p-2">
            <span className="block text-stone-300">{stats ? Math.round(stats.vertices).toLocaleString() : '-'}</span>
            vertices
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-2">
            <span className="block text-stone-300">{stats ? Math.round(stats.triangles).toLocaleString() : '-'}</span>
            tris
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-2">
            <span className="block text-stone-300">{stats?.morphTargets ?? '-'}</span>
            morphs
          </div>
          <div className="rounded-2xl border border-white/8 bg-white/5 p-2">
            <span className="block text-stone-300">{stats ? `${stats.mapResolution}px` : '-'}</span>
            maps
          </div>
        </div>
      </section>
    </RouteShell>
  );
}
