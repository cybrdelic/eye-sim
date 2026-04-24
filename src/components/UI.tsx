import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  Bug,
  Camera,
  CircleDot,
  Eye,
  Settings2,
  SlidersHorizontal,
  Smile,
  Sparkles,
  Sun,
  UserRound,
  Video,
} from 'lucide-react';
import {
  PRESENTATION_SHOT_ORDER,
  PRESENTATION_SHOTS,
  type AnimationMode,
  type LightingMode,
  type PresentationShotId,
} from '../features/presentation/shots';

interface UIProps {
  color1: string;
  setColor1: (color: string) => void;
  color2: string;
  setColor2: (color: string) => void;
  envMapIntensity: number;
  setEnvMapIntensity: (v: number) => void;
  ior: number;
  setIor: (v: number) => void;
  thickness: number;
  setThickness: (v: number) => void;
  screenBrightness: number;
  setScreenBrightness: (v: number) => void;
  lightingMode: LightingMode;
  setLightingMode: (v: LightingMode) => void;
  trackingEnabled: boolean;
  setTrackingEnabled: (v: boolean) => void;
  trackingStatus: 'idle' | 'loading' | 'tracking' | 'error';
  debugOverlayEnabled: boolean;
  setDebugOverlayEnabled: (v: boolean) => void;
  videoEnvEnabled: boolean;
  setVideoEnvEnabled: (v: boolean) => void;
  animationMode: AnimationMode;
  setAnimationMode: (v: AnimationMode) => void;
  pupilSize: number;
  setPupilSize: (v: number) => void;
  activeShot: PresentationShotId;
  setActiveShot: (v: PresentationShotId) => void;
  advancedRigOpen: boolean;
  setAdvancedRigOpen: (v: boolean) => void;
}

const PRESETS = [
  { name: 'Aegean', c1: '#0f2f6f', c2: '#51a5ff' },
  { name: 'Moss', c1: '#123b22', c2: '#6ee7a0' },
  { name: 'Umber', c1: '#3a1605', c2: '#c5893f' },
  { name: 'Hazel', c1: '#31410f', c2: '#d5a13d' },
  { name: 'Steel', c1: '#1d3344', c2: '#b8d7e8' },
  { name: 'Amber', c1: '#5a2106', c2: '#f6b44d' },
];

const SHOT_ICONS: Record<PresentationShotId, LucideIcon> = {
  portrait: UserRound,
  eyes: Eye,
  mouth: Smile,
  trackingTwin: Activity,
  inspect: SlidersHorizontal,
};

const SHOT_OPTIONS = PRESENTATION_SHOT_ORDER.map((value) => ({
  value,
  label: PRESENTATION_SHOTS[value].shortLabel,
  title: PRESENTATION_SHOTS[value].label,
  description: PRESENTATION_SHOTS[value].description,
  icon: SHOT_ICONS[value],
}));

const LIGHTING_OPTIONS: Array<{ value: UIProps['lightingMode']; label: string; icon: LucideIcon }> = [
  { value: 'studio', label: 'Studio', icon: Sparkles },
  { value: 'outdoor', label: 'Outdoor', icon: Sun },
];

const ANIMATION_OPTIONS: Array<{ value: UIProps['animationMode']; label: string }> = [
  { value: 'mouse', label: 'Cursor' },
  { value: 'calm', label: 'Calm' },
  { value: 'saccades', label: 'Saccades' },
  { value: 'scanning', label: 'Scan' },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function SectionLabel({ icon: Icon, children }: { icon: LucideIcon; children: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/45">
      <Icon className="h-3.5 w-3.5" />
      {children}
    </div>
  );
}

function PillButton({
  active,
  icon: Icon,
  label,
  onClick,
  title,
}: {
  active: boolean;
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  title?: string;
}) {
  return (
    <button
      type="button"
      title={title ?? label}
      onClick={onClick}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition',
        active
          ? 'border-white/25 bg-white text-neutral-950 shadow-[0_0_30px_rgba(255,255,255,0.14)]'
          : 'border-white/10 bg-white/[0.045] text-white/62 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
      )}
    >
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

function RangeControl({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format = (v) => v.toFixed(2),
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  format?: (value: number) => string;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between gap-3 text-[11px] text-white/55">
        <span>{label}</span>
        <span className="font-mono text-white/80">{format(value)}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(parseFloat(event.target.value))}
        className="h-1.5 w-full cursor-pointer accent-white"
      />
    </label>
  );
}

function StatusDot({ status, enabled }: { status: UIProps['trackingStatus']; enabled: boolean }) {
  const color = enabled
    ? {
        idle: 'bg-white/35',
        loading: 'bg-sky-300',
        tracking: 'bg-emerald-300',
        error: 'bg-red-300',
      }[status]
    : 'bg-white/25';

  return <span className={cx('h-2 w-2 rounded-full shadow-[0_0_12px_currentColor]', color)} />;
}

export default function UI({
  color1,
  setColor1,
  color2,
  setColor2,
  envMapIntensity,
  setEnvMapIntensity,
  ior,
  setIor,
  thickness,
  setThickness,
  screenBrightness,
  setScreenBrightness,
  lightingMode,
  setLightingMode,
  trackingEnabled,
  setTrackingEnabled,
  trackingStatus,
  debugOverlayEnabled,
  setDebugOverlayEnabled,
  videoEnvEnabled,
  setVideoEnvEnabled,
  animationMode,
  setAnimationMode,
  pupilSize,
  setPupilSize,
  activeShot,
  setActiveShot,
  advancedRigOpen,
  setAdvancedRigOpen,
}: UIProps) {
  const activeShotConfig = PRESENTATION_SHOTS[activeShot];

  return (
    <>
      <div className="pointer-events-none absolute inset-0 z-10 bg-[radial-gradient(circle_at_50%_16%,rgba(255,241,219,0.09),transparent_30%),linear-gradient(180deg,rgba(0,0,0,0.18),transparent_38%,rgba(0,0,0,0.42))]" />

      <div className="pointer-events-none absolute right-4 top-4 z-20 hidden sm:block">
        <div className="rounded-full border border-white/10 bg-black/35 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/60 backdrop-blur-xl">
          Eye Sim
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 p-3 sm:p-5">
        <section className="pointer-events-auto mx-auto w-full max-w-md rounded-[1.45rem] border border-white/10 bg-[#080b10]/78 p-3 shadow-[0_24px_80px_rgba(0,0,0,0.5)] backdrop-blur-2xl sm:hidden">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold tracking-tight text-white">Digital face rig</h1>
              <p className="mt-0.5 text-xs text-white/46">{activeShotConfig.description}</p>
            </div>
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/60">
              <StatusDot enabled={trackingEnabled} status={trackingStatus} />
              {trackingEnabled ? trackingStatus : 'manual'}
            </div>
          </div>

          <div className="mt-3 grid grid-cols-5 gap-1 rounded-full border border-white/8 bg-black/22 p-1">
            {SHOT_OPTIONS.map(({ value, label, title, description, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setActiveShot(value)}
                aria-label={`${title} shot`}
                title={description}
                className={cx(
                  'flex items-center justify-center gap-1 rounded-full px-1.5 py-2 text-[10px] font-semibold transition',
                  activeShot === value ? 'bg-white text-neutral-950' : 'text-white/56 hover:bg-white/8 hover:text-white',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          <div className="mt-3 flex items-center justify-between gap-2">
            <div className="flex gap-1.5">
              {PRESETS.slice(0, 5).map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  title={preset.name}
                  onClick={() => {
                    setColor1(preset.c1);
                    setColor2(preset.c2);
                  }}
                  className="h-7 w-7 rounded-full border border-white/15 shadow-inner transition hover:scale-105 hover:border-white/40"
                  style={{ background: `radial-gradient(circle at 38% 40%, ${preset.c2}, ${preset.c1} 66%, #05070a 100%)` }}
                />
              ))}
            </div>

            <div className="flex gap-1.5">
              <PillButton active={trackingEnabled} icon={Activity} label="Tracking" onClick={() => setTrackingEnabled(!trackingEnabled)} />
              <PillButton active={videoEnvEnabled} icon={Video} label="Reflections" onClick={() => setVideoEnvEnabled(!videoEnvEnabled)} />
              <PillButton active={advancedRigOpen} icon={Settings2} label="Rig" onClick={() => setAdvancedRigOpen(!advancedRigOpen)} />
            </div>
          </div>

          <details className="mt-3 rounded-[1rem] border border-white/8 bg-white/[0.035] px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-[0.16em] text-white/55">Controls</summary>
            <div className="mt-3 max-h-[40vh] space-y-3 overflow-y-auto pr-1">
              <div className="grid grid-cols-2 gap-1 rounded-full border border-white/8 bg-black/22 p-1">
                {LIGHTING_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLightingMode(value)}
                    className={cx(
                      'flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold transition',
                      lightingMode === value ? 'bg-white text-neutral-950' : 'text-white/56 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-4 gap-1 rounded-full border border-white/8 bg-black/22 p-1">
                {ANIMATION_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAnimationMode(value)}
                    className={cx(
                      'rounded-full px-2 py-2 text-[11px] font-semibold transition',
                      animationMode === value ? 'bg-white text-neutral-950' : 'text-white/56 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <RangeControl label="Pupil" value={pupilSize} min={0.05} max={0.35} step={0.01} onChange={setPupilSize} />
              <RangeControl
                label="Reflection"
                value={envMapIntensity}
                min={0}
                max={10}
                step={0.1}
                onChange={setEnvMapIntensity}
                format={(v) => v.toFixed(1)}
              />
              <RangeControl
                label="Brightness"
                value={screenBrightness}
                min={0}
                max={5}
                step={0.1}
                onChange={setScreenBrightness}
                format={(v) => v.toFixed(1)}
              />
              <RangeControl label="IOR" value={ior} min={1} max={2} step={0.01} onChange={setIor} />
              <RangeControl label="Cornea" value={thickness} min={0} max={1} step={0.01} onChange={setThickness} />
              <button
                type="button"
                onClick={() => setDebugOverlayEnabled(!debugOverlayEnabled)}
                className={cx(
                  'inline-flex w-full items-center justify-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition',
                  debugOverlayEnabled
                    ? 'border-amber-300/30 bg-amber-300/18 text-amber-50'
                    : 'border-white/10 bg-white/[0.045] text-white/62 hover:border-white/20 hover:bg-white/[0.08] hover:text-white',
                )}
              >
                <Bug className="h-4 w-4" />
                {debugOverlayEnabled ? 'Hide tracker debug' : 'Show tracker debug'}
              </button>
            </div>
          </details>
        </section>

        <section className="pointer-events-auto mx-auto hidden max-h-[52vh] w-full max-w-6xl overflow-y-auto rounded-[1.65rem] border border-white/10 bg-[#080b10]/75 p-3 shadow-[0_28px_90px_rgba(0,0,0,0.46)] backdrop-blur-2xl sm:block sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[0.9fr_1.15fr_1fr] xl:grid-cols-[1fr_1.2fr_1fr_1.15fr]">
            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h1 className="text-lg font-semibold tracking-tight text-white">Digital face rig</h1>
                  <p className="mt-0.5 text-xs text-white/46">{activeShotConfig.description}</p>
                </div>
                <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/30 px-2.5 py-1.5 text-[10px] uppercase tracking-[0.14em] text-white/60">
                  <StatusDot enabled={trackingEnabled} status={trackingStatus} />
                  {trackingEnabled ? trackingStatus : 'manual'}
                </div>
              </div>

              <SectionLabel icon={Camera}>Capture</SectionLabel>
              <div className="flex flex-wrap gap-2">
                <PillButton
                  active={trackingEnabled}
                  icon={Activity}
                  label="Tracking"
                  onClick={() => setTrackingEnabled(!trackingEnabled)}
                  title="Toggle webcam face tracking"
                />
                <PillButton
                  active={videoEnvEnabled}
                  icon={Video}
                  label="Reflections"
                  onClick={() => setVideoEnvEnabled(!videoEnvEnabled)}
                  title="Use webcam feed as reflection source"
                />
                <PillButton
                  active={debugOverlayEnabled}
                  icon={Bug}
                  label="Debug"
                  onClick={() => setDebugOverlayEnabled(!debugOverlayEnabled)}
                  title="Show MediaPipe debug overlay"
                />
                <PillButton
                  active={advancedRigOpen}
                  icon={Settings2}
                  label="Rig"
                  onClick={() => setAdvancedRigOpen(!advancedRigOpen)}
                  title="Show advanced rig controls"
                />
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-3">
              <SectionLabel icon={CircleDot}>Iris</SectionLabel>
              <div className="grid grid-cols-[1fr_auto] gap-3">
                <div className="flex flex-wrap gap-2">
                  {PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      title={preset.name}
                      onClick={() => {
                        setColor1(preset.c1);
                        setColor2(preset.c2);
                      }}
                      className="h-9 w-9 rounded-full border border-white/15 shadow-inner transition hover:scale-105 hover:border-white/40"
                      style={{ background: `radial-gradient(circle at 38% 40%, ${preset.c2}, ${preset.c1} 66%, #05070a 100%)` }}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    aria-label="Inner iris color"
                    type="color"
                    value={color1}
                    onChange={(event) => setColor1(event.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                  <input
                    aria-label="Outer iris color"
                    type="color"
                    value={color2}
                    onChange={(event) => setColor2(event.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0"
                  />
                </div>
              </div>

              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <RangeControl label="Pupil" value={pupilSize} min={0.05} max={0.35} step={0.01} onChange={setPupilSize} />
                <RangeControl
                  label="Reflection"
                  value={envMapIntensity}
                  min={0}
                  max={10}
                  step={0.1}
                  onChange={setEnvMapIntensity}
                  format={(v) => v.toFixed(1)}
                />
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-3">
              <SectionLabel icon={Eye}>Shot</SectionLabel>
              <div className="grid grid-cols-5 gap-1 rounded-full border border-white/8 bg-black/22 p-1">
                {SHOT_OPTIONS.map(({ value, label, title, description, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setActiveShot(value)}
                    aria-label={`${title} shot`}
                    title={description}
                    className={cx(
                      'flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-[11px] font-semibold transition',
                      activeShot === value ? 'bg-white text-neutral-950' : 'text-white/56 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-1 rounded-full border border-white/8 bg-black/22 p-1">
                {LIGHTING_OPTIONS.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setLightingMode(value)}
                    className={cx(
                      'flex items-center justify-center gap-1.5 rounded-full px-2 py-2 text-xs font-semibold transition',
                      lightingMode === value ? 'bg-white text-neutral-950' : 'text-white/56 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {label}
                  </button>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-4 gap-1 rounded-full border border-white/8 bg-black/22 p-1">
                {ANIMATION_OPTIONS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setAnimationMode(value)}
                    className={cx(
                      'rounded-full px-2 py-2 text-xs font-semibold transition',
                      animationMode === value ? 'bg-white text-neutral-950' : 'text-white/56 hover:bg-white/8 hover:text-white',
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-[1.2rem] border border-white/8 bg-white/[0.035] p-3 lg:col-span-3 xl:col-span-1">
              <SectionLabel icon={SlidersHorizontal}>Optics</SectionLabel>
              <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                <RangeControl
                  label="Brightness"
                  value={screenBrightness}
                  min={0}
                  max={5}
                  step={0.1}
                  onChange={setScreenBrightness}
                  format={(v) => v.toFixed(1)}
                />
                <RangeControl label="IOR" value={ior} min={1} max={2} step={0.01} onChange={setIor} />
                <RangeControl label="Cornea" value={thickness} min={0} max={1} step={0.01} onChange={setThickness} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
