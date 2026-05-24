'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeoPosition } from '@/lib/hooks/useGeolocation';

// Mapbox token required
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface MapboxEngineProps {
  position: GeoPosition | null;
  onTrafficDensityChange?: (density: number) => void;
}

// ── Haversine Distance Calculation ──
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  return R * c;
}

export function MapboxEngine({ position, onTrafficDensityChange }: MapboxEngineProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapLoadedRef = useRef(false);
  const animationFrameId = useRef<number | null>(null);
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
      if (map.current) {
        if (!map.current.getSource('mapbox-traffic')) {
          map.current.addSource('mapbox-traffic', {
            type: 'vector',
            url: 'mapbox://mapbox.mapbox-traffic-v1',
          });
        }

        // Add traffic glow (pulsing neon effect)
        if (!map.current.getLayer('traffic-glow')) {
          map.current.addLayer(
            {
              id: 'traffic-glow',
              type: 'line',
              source: 'mapbox-traffic',
              'source-layer': 'traffic',
              filter: ['!=', 'congestion', 'low'], // Sadece trafik olan (yoğun) yerler
              paint: {
                'line-width': 12,
                'line-blur': 8,
                'line-color': [
                  'match',
                  ['get', 'congestion'],
                  'moderate', '#FF9F0A', // Amber
                  'heavy', '#FF453A', // Red
                  'severe', '#BF5AF2', // Purple for severe
                  'transparent',
                ],
                'line-opacity': 0.8,
              },
            },
            'waterway-label' // Insert below labels
          );
        }

        if (!map.current.getLayer('traffic-lines')) {
          // Add traffic lines (core representation)
          map.current.addLayer(
            {
              id: 'traffic-lines',
              type: 'line',
              source: 'mapbox-traffic',
              'source-layer': 'traffic',
              paint: {
                'line-width': 4,
                'line-color': [
                  'match',
                  ['get', 'congestion'],
                  'low', '#30D158',
                  'moderate', '#FF9F0A',
                  'heavy', '#FF453A',
                  'severe', '#BF5AF2',
                  'transparent',
                ],
                'line-opacity': 0.9,
              },
            },
            'waterway-label'
          );
        }

        // Start pulse animation
        const animateGlow = (timestamp: number) => {
          if (!map.current || !map.current.getLayer('traffic-glow')) return;
          // Sine wave calculation for breathing effect
          const progress = timestamp / 600; 
          const opacity = 0.2 + (0.6 * (Math.sin(progress) + 1) / 2);
          
          try {
            map.current.setPaintProperty('traffic-glow', 'line-opacity', opacity);
          } catch (e) {
            // map might be unmounting
          }
          
          animationFrameId.current = requestAnimationFrame(animateGlow);
        };
        animationFrameId.current = requestAnimationFrame(animateGlow);
      }

      // Create a highly professional, Apple Maps / Tesla style location marker
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center w-10 h-10';
      el.innerHTML = `
        <div class="absolute inset-0 bg-[#0A84FF] rounded-full opacity-20 animate-ping" style="animation-duration: 3s;"></div>
        <div class="relative w-4 h-4 bg-[#0A84FF] rounded-full border-[2.5px] border-white shadow-[0_2px_10px_rgba(0,0,0,0.5)]"></div>
      `;
      
      marker.current = new mapboxgl.Marker({ element: el })
        .setLngLat([startLng, startLat])
        .addTo(map.current!);
    });

    return () => {
      if (animationFrameId.current) cancelAnimationFrame(animationFrameId.current);
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

    // Update marker position
    marker.current?.setLngLat([position.longitude, position.latitude]);
  }, [position, mapLoaded]);

  // ── Traffic Density Real-time Spatial Calculation ──
  useEffect(() => {
    if (!map.current || !mapLoaded || !position || !onTrafficDensityChange) return;

    const interval = setInterval(() => {
      try {
        // Only query features currently rendered on screen (saves API calls, purely client-side)
        const features = map.current?.queryRenderedFeatures({ layers: ['traffic-lines'] });
        if (!features || features.length === 0) {
          onTrafficDensityChange(0);
          return;
        }

        let totalWeight = 0;
        let weightedCongestion = 0;

        features.forEach((f) => {
          const congestion = f.properties?.congestion;
          if (!congestion) return;

          // Mapbox Traffic v1 congestion values
          let congestionValue = 0;
          if (congestion === 'low') congestionValue = 10; // green
          else if (congestion === 'moderate') congestionValue = 45; // yellow/orange
          else if (congestion === 'heavy') congestionValue = 85; // red
          else if (congestion === 'severe') congestionValue = 100; // dark red

          // Extract coordinates to approximate distance to the feature
          const geom: any = f.geometry;
          const coords = geom.coordinates;
          if (!coords || !coords[0]) return;
          
          let lng, lat;
          if (typeof coords[0][0] === 'number') {
            [lng, lat] = coords[0]; // LineString
          } else if (typeof coords[0][0][0] === 'number') {
            [lng, lat] = coords[0][0]; // MultiLineString
          } else {
            return;
          }

          // Distance from user to this specific road segment
          const distKm = getDistanceFromLatLonInKm(position.latitude, position.longitude, lat, lng);
          
          // Optimization: Ignore roads further than 3km
          if (distKm > 3) return;
          
          // Spatial Weighting: Inverse Square Law
          // Closer roads (0.1km) have massive weight (e.g., 100)
          // Further roads (3km) have very small weight (e.g., ~0.1)
          const weight = 1 / (1 + Math.pow(distKm * 3, 2));

          weightedCongestion += congestionValue * weight;
          totalWeight += weight;
        });

        const finalDensity = totalWeight > 0 ? Math.round(weightedCongestion / totalWeight) : 0;
        onTrafficDensityChange(finalDensity);

      } catch (err) {
        console.error("Traffic calculation error:", err);
      }
    }, 2000); // Recalculate every 2 seconds for butter-smooth UI

    return () => clearInterval(interval);
  }, [position?.latitude, position?.longitude, mapLoaded, onTrafficDensityChange]);

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
