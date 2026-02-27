import React from 'react';

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
  lightingMode: 'webcam' | 'diagnostic';
  setLightingMode: (v: 'webcam' | 'diagnostic') => void;
  animationMode: 'mouse' | 'calm' | 'saccades' | 'scanning';
  setAnimationMode: (v: 'mouse' | 'calm' | 'saccades' | 'scanning') => void;
  pupilSize: number;
  setPupilSize: (v: number) => void;
}

const PRESETS = [
  { name: 'Blue', c1: '#1e3a8a', c2: '#3b82f6' },
  { name: 'Green', c1: '#14532d', c2: '#4ade80' },
  { name: 'Brown', c1: '#451a03', c2: '#a16207' },
  { name: 'Hazel', c1: '#3f6212', c2: '#ca8a04' },
  { name: 'Violet', c1: '#4c1d95', c2: '#8b5cf6' },
  { name: 'Red', c1: '#7f1d1d', c2: '#ef4444' },
];

export default function UI({ 
  color1, setColor1, 
  color2, setColor2,
  envMapIntensity, setEnvMapIntensity,
  ior, setIor,
  thickness, setThickness,
  screenBrightness, setScreenBrightness,
  lightingMode, setLightingMode,
  animationMode, setAnimationMode,
  pupilSize, setPupilSize
}: UIProps) {
  return (
    <div className="absolute top-0 left-0 p-6 z-10 pointer-events-none w-full flex flex-col items-start gap-4">
      <div className="pointer-events-auto bg-black/40 backdrop-blur-md border border-white/10 p-6 rounded-2xl shadow-2xl w-80">
        <h1 className="text-2xl font-semibold tracking-tight text-white mb-1">Oculus</h1>
        <p className="text-sm text-white/60 mb-6">Photorealistic procedural eye simulation</p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
              Presets
            </label>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((preset) => (
                <button
                  key={preset.name}
                  onClick={() => {
                    setColor1(preset.c1);
                    setColor2(preset.c2);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-white/80"
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-white/10 my-4" />

          <div className="flex gap-4">
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Inner Color
              </label>
              <input 
                type="color" 
                value={color1} 
                onChange={(e) => setColor1(e.target.value)}
                className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
                Outer Color
              </label>
              <input 
                type="color" 
                value={color2} 
                onChange={(e) => setColor2(e.target.value)}
                className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
              />
            </div>
          </div>

          <div className="h-px w-full bg-white/10 my-4" />

          <div>
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
              Lighting Mode
            </label>
            <div className="flex bg-white/5 rounded-lg p-1">
              <button
                onClick={() => setLightingMode('webcam')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  lightingMode === 'webcam' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                Webcam
              </button>
              <button
                onClick={() => setLightingMode('diagnostic')}
                className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  lightingMode === 'diagnostic' ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                Diagnostic
              </button>
            </div>
          </div>

          <div className="h-px w-full bg-white/10 my-4" />

          <div>
            <label className="block text-xs font-medium text-white/50 uppercase tracking-wider mb-2">
              Animation Mode
            </label>
            <div className="grid grid-cols-2 gap-1 bg-white/5 rounded-lg p-1">
              {(['mouse', 'calm', 'saccades', 'scanning'] as const).map(mode => (
                <button
                  key={mode}
                  onClick={() => setAnimationMode(mode)}
                  className={`py-1.5 text-xs font-medium rounded-md transition-colors capitalize ${
                    animationMode === mode ? 'bg-white/20 text-white' : 'text-white/50 hover:text-white/80'
                  }`}
                >
                  {mode}
                </button>
              ))}
            </div>
          </div>

          <div className="h-px w-full bg-white/10 my-4" />

          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Reflection Intensity</label>
                <span className="text-xs text-white/80">{envMapIntensity.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="0" max="10" step="0.1" 
                value={envMapIntensity} onChange={(e) => setEnvMapIntensity(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Screen Brightness</label>
                <span className="text-xs text-white/80">{screenBrightness.toFixed(1)}</span>
              </div>
              <input 
                type="range" min="0" max="5" step="0.1" 
                value={screenBrightness} onChange={(e) => setScreenBrightness(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Pupil Size</label>
                <span className="text-xs text-white/80">{pupilSize.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0.05" max="0.35" step="0.01" 
                value={pupilSize} onChange={(e) => setPupilSize(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Index of Refraction</label>
                <span className="text-xs text-white/80">{ior.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="1.0" max="2.0" step="0.01" 
                value={ior} onChange={(e) => setIor(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-xs font-medium text-white/50 uppercase tracking-wider">Cornea Thickness</label>
                <span className="text-xs text-white/80">{thickness.toFixed(2)}</span>
              </div>
              <input 
                type="range" min="0" max="1" step="0.01" 
                value={thickness} onChange={(e) => setThickness(parseFloat(e.target.value))}
                className="w-full accent-white"
              />
            </div>
          </div>
        </div>
      </div>
      
      <div className="absolute bottom-6 right-6 pointer-events-auto">
        <div className="bg-black/40 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full text-xs text-white/50">
          Move cursor to look around
        </div>
      </div>
    </div>
  );
}
