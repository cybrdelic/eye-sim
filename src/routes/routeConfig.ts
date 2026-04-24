export const APP_NAV_ITEMS = [
  { to: '/', label: 'Main App', surface: 'product' },
  { to: '/labs/procedural-head', label: 'Procedural Head', surface: 'lab' },
  { to: '/labs/beauty-webgpu', label: 'Beauty WebGPU', surface: 'lab' },
  { to: '/labs/material-parity', label: 'Material Parity', surface: 'lab' },
  { to: '/labs/asset-conditioning', label: 'Asset Conditioning', surface: 'lab' },
] as const;

export const PRODUCT_NAV_ITEMS = APP_NAV_ITEMS.filter((item) => item.surface === 'product');
export const LAB_NAV_ITEMS = APP_NAV_ITEMS.filter((item) => item.surface === 'lab');
