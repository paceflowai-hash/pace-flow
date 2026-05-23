'use client';

import { memo } from 'react';
import { TeslaCanvasEngine } from './TeslaCanvasEngine';

export const TeslaRoad = memo(function TeslaRoad() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      <TeslaCanvasEngine />
    </div>
  );
});
