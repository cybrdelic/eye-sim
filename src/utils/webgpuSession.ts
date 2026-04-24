export type WebGPUSessionProbeFailure =
  | 'unsupported'
  | 'adapter-unavailable'
  | 'canvas-context-unavailable'
  | 'preferred-format-unavailable';

export type WebGPUSessionProbeResult = {
  ok: boolean;
  failure: WebGPUSessionProbeFailure | null;
  message: string;
};

type ProbeOptions = {
  canvas?: HTMLCanvasElement | null;
  compatibility?: boolean;
};

export const WEBGPU_SESSION_RECOVERY_HINT =
  'Hard reload this tab, reopen the in-app browser, or restart the host app if the GPU session is stale.';

export async function probeWebGPUSession({
  canvas = null,
  compatibility = false,
}: ProbeOptions = {}): Promise<WebGPUSessionProbeResult> {
  const gpu = typeof navigator !== 'undefined' ? (navigator as Navigator & { gpu?: GPU }).gpu : undefined;
  if (!gpu?.requestAdapter) {
    return {
      ok: false,
      failure: 'unsupported',
      message: 'WebGPU is not available in this browser session.',
    };
  }

  if (typeof document === 'undefined') {
    return {
      ok: false,
      failure: 'unsupported',
      message: 'WebGPU probing requires a browser document context.',
    };
  }

  try {
    const adapter = await gpu.requestAdapter(compatibility ? { featureLevel: 'compatibility' } : undefined);
    if (!adapter) {
      return {
        ok: false,
        failure: 'adapter-unavailable',
        message: `WebGPU is exposed, but no adapter is available in this page session. ${WEBGPU_SESSION_RECOVERY_HINT}`,
      };
    }
  } catch {
    return {
      ok: false,
      failure: 'adapter-unavailable',
      message: `WebGPU adapter probing failed in this page session. ${WEBGPU_SESSION_RECOVERY_HINT}`,
    };
  }

  const probeCanvas = canvas ?? document.createElement('canvas');
  const context = probeCanvas.getContext('webgpu');
  if (!context) {
    return {
      ok: false,
      failure: 'canvas-context-unavailable',
      message: `WebGPU adapter exists, but this page cannot create a WebGPU canvas context provider. ${WEBGPU_SESSION_RECOVERY_HINT}`,
    };
  }

  try {
    gpu.getPreferredCanvasFormat();
  } catch {
    return {
      ok: false,
      failure: 'preferred-format-unavailable',
      message: `WebGPU adapter and context exist, but no preferred canvas format is available. ${WEBGPU_SESSION_RECOVERY_HINT}`,
    };
  }

  return {
    ok: true,
    failure: null,
    message: 'WebGPU session preflight succeeded.',
  };
}
