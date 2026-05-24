'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeoPosition } from '@/lib/hooks/useGeolocation';

// Mapbox token required
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface MapboxEngineProps {
  position: GeoPosition | null;
}

export function MapboxEngine({ position }: MapboxEngineProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  // Initialize Map
  useEffect(() => {
    if (map.current || !mapContainer.current) return;

    // Start coordinates (default or from initial position)
    const startLng = position?.longitude ?? 28.9784; // Istanbul default
    const startLat = position?.latitude ?? 41.0082;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/navigation-night-v1', // Dark driving theme
      center: [startLng, startLat],
      zoom: 15,
      pitch: 45, // Initial tilt
      bearing: position?.heading ?? 0,
      interactive: false, // Prevent user from manually panning/zooming
      attributionControl: false, // Hide attribution for cleaner UI
      logoPosition: 'bottom-left',
    });

    map.current.on('load', () => {
      setMapLoaded(true);

      // Add traffic layer if supported by the style
      // Note: Mapbox Traffic v1 plugin might require additional setup,
      // but 'navigation-night-v1' already includes some traffic data.
      // Let's add the standard traffic layer if available:
      if (map.current) {
        map.current.addSource('mapbox-traffic', {
          type: 'vector',
          url: 'mapbox://mapbox.mapbox-traffic-v1',
        });

        // Add traffic lines (simple representation)
        map.current.addLayer(
          {
            id: 'traffic-lines',
            type: 'line',
            source: 'mapbox-traffic',
            'source-layer': 'traffic',
            paint: {
              'line-width': 3,
              'line-color': [
                'match',
                ['get', 'congestion'],
                'low', '#30D158', // Green
                'moderate', '#FF9F0A', // Amber
                'heavy', '#FF453A', // Red
                'severe', '#8B0000', // Dark Red
                'transparent', // Fallback
              ],
              'line-opacity': 0.7,
            },
          },
          'waterway-label' // Insert below labels
        );
      }
    });

    return () => {
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update Map based on Telemetry
  useEffect(() => {
    if (!map.current || !mapLoaded || !position) return;

    // Calculate dynamic camera properties based on speed
    // Speed increases -> pitch (tilt) increases and zoom increases
    const speed = position.speed_kmh;
    
    // Zoom: 15 (stopped) to 18 (highway speeds)
    const targetZoom = 15 + Math.min(speed / 40, 3);
    
    // Pitch: 45 (stopped) to 75 (highway speeds)
    const targetPitch = 45 + Math.min(speed / 3, 30);

    map.current.easeTo({
      center: [position.longitude, position.latitude],
      bearing: position.heading,
      zoom: targetZoom,
      pitch: targetPitch,
      duration: 1000, // Smooth transition matching GPS 1/sec frequency
      easing: (t) => t, // Linear easing for continuous movement
    });
  }, [position, mapLoaded]);

  return (
    <div className="absolute inset-0 z-0 bg-black">
      <div 
        ref={mapContainer} 
        className="w-full h-full opacity-80" 
        style={{ 
          // Subtle vignette effect to blend map edges into darkness
          maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)'
        }}
      />
    </div>
  );
}
