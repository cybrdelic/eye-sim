import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import MainRoute from './routes/MainRoute';

const BeautyMaterialLabRoute = lazy(() => import('./routes/BeautyMaterialLabRoute'));
const ProceduralHeadRoute = lazy(() => import('./routes/ProceduralHeadRoute'));
const MaterialParityRoute = lazy(() => import('./routes/MaterialParityRoute'));
const AssetConditioningRoute = lazy(() => import('./routes/AssetConditioningRoute'));

function RouteFallback({ label }: { label: string }) {
  return <div className="flex h-screen w-full items-center justify-center bg-stone-950 text-stone-200">Loading {label}...</div>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<MainRoute />} />
      <Route
        path="/labs/beauty-webgpu"
        element={(
          <Suspense fallback={<RouteFallback label="beauty lab" />}>
            <BeautyMaterialLabRoute />
          </Suspense>
        )}
      />
      <Route
        path="/labs/procedural-head"
        element={(
          <Suspense fallback={<RouteFallback label="procedural head" />}>
            <ProceduralHeadRoute />
          </Suspense>
        )}
      />
      <Route
        path="/labs/material-parity"
        element={(
          <Suspense fallback={<RouteFallback label="material parity" />}>
            <MaterialParityRoute />
          </Suspense>
        )}
      />
      <Route
        path="/labs/asset-conditioning"
        element={(
          <Suspense fallback={<RouteFallback label="asset conditioning" />}>
            <AssetConditioningRoute />
          </Suspense>
        )}
      />
      <Route path="*" element={<Navigate replace to="/" />} />
    </Routes>
  );
}
