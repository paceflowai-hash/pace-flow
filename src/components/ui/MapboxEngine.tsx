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

      if (map.current) {
        // Hide default Mapbox traffic layers to prevent the default green roads from showing
        const style = map.current.getStyle();
        if (style && style.layers) {
          for (const layer of style.layers) {
            // Hide default traffic
            if (layer.id.includes('traffic')) {
              map.current.setLayoutProperty(layer.id, 'visibility', 'none');
            }
            
            // Ultra-dark premium styling for non-traffic elements
            try {
              if (layer.type === 'background') {
                map.current.setPaintProperty(layer.id, 'background-color', '#050505'); // Neredeyse zift siyah
              }
              if (layer.id.includes('water')) {
                map.current.setPaintProperty(layer.id, 'fill-color', '#080808'); // Koyu sular
              }
              if (layer.id.includes('landuse') || layer.id.includes('building') || layer.id.includes('park') || layer.id.includes('structure')) {
                if (layer.type === 'fill') {
                  map.current.setPaintProperty(layer.id, 'fill-color', '#0c0c0c');
                } else if (layer.type === 'fill-extrusion') {
                  map.current.setPaintProperty(layer.id, 'fill-extrusion-color', '#0c0c0c');
                }
              }
              // Normal yolları (trafiksiz) Tron/Neon tarzı ince mavi çizgiler yapalım
              if (layer.id.includes('road') && layer.type === 'line' && !layer.id.includes('traffic')) {
                if (layer.id.includes('case') || layer.id.includes('casing')) {
                  // Çerçeveleri gizle (çift çizgi karmaşasını önler)
                  map.current.setPaintProperty(layer.id, 'line-opacity', 0);
                } else {
                  // Sadece yolun içini beyaz yapıyoruz ama kalınlığı azaltıp zarifleştiriyoruz
                  map.current.setPaintProperty(layer.id, 'line-color', '#FFFFFF'); 
                  map.current.setPaintProperty(layer.id, 'line-opacity', 0.6); 
                  try {
                    // Kullanıcı talebi: Beyaz çizgileri çok ince (zarif) yap
                    map.current.setPaintProperty(layer.id, 'line-width', 0.8); 
                  } catch (e) {}
                }
              }
            } catch (e) {
              // Bazı katmanlarda bu özellikler olmayabilir, sessizce geç
            }
          }
        }
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
                'line-width': 40,
                'line-blur': 20,
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
                'line-width': [
                  'match',
                  ['get', 'congestion'],
                  'low', 1, // Tek bir ince çizgi
                  8 // Diğerleri kalın (4'ten 8'e çıkarıldı)
                ],
                'line-color': [
                  'match',
                  ['get', 'congestion'],
                  'low', '#000000',
                  'moderate', '#FF9F0A',
                  'heavy', '#FF453A',
                  'severe', '#BF5AF2',
                  'transparent',
                ],
                'line-opacity': [
                  'match',
                  ['get', 'congestion'],
                  'low', 0.8, // Siyah yolların belirgin olması için
                  0.9 // Diğerleri parlak
                ],
              },
            },
            'waterway-label'
          );
        }

        // Start pulse animation (Heartbeat Effect)
        const animateGlow = (timestamp: number) => {
          if (!map.current || !map.current.getLayer('traffic-glow')) return;
          
          // Heartbeat calculation (1.5s cycle: lub-dub... pause)
          const t = (timestamp % 1500) / 1500;
          let opacity = 0.2; // Base glow opacity
          
          if (t < 0.15) {
            // First beat (lub) - Strong
            opacity = 0.2 + 0.8 * Math.sin((t / 0.15) * Math.PI); // reaches 1.0
          } else if (t > 0.25 && t < 0.4) {
            // Second beat (dub) - Slightly weaker
            opacity = 0.2 + 0.6 * Math.sin(((t - 0.25) / 0.15) * Math.PI); // reaches 0.8
          }
          
          try {
            map.current.setPaintProperty('traffic-glow', 'line-opacity', opacity);
          } catch (e) {
            // map might be unmounting
          }
          
          // --- Ambient Traffic Reflection (Left/Right) ---
          try {
            const leftStop = document.getElementById('leftConeStop');
            const rightStop = document.getElementById('rightConeStop');
            const m = marker.current?.getLngLat();
            
            if (m && leftStop && rightStop && map.current) {
              const pt = map.current.project(m);
              
              // İlerideki trafiği (ekranın üst kısmına doğru geniş bir alan) taramak için
              // pt.y aracın konumu. 0 ise ekranın en üstü (ilerisi).
              // Sol ilerisi için: Aracın solundan 400px sola, ve ekranın en üstüne kadar olan kutu.
              const leftBbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [[Math.max(0, pt.x - 400), 0], [pt.x, pt.y]];
              // Sağ ilerisi için: Aracın sağından 400px sağa, ve ekranın en üstüne kadar olan kutu.
              const rightBbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [[pt.x, 0], [pt.x + 400, pt.y]];
              
              const getTrafficColor = (bbox: [mapboxgl.PointLike, mapboxgl.PointLike]) => {
                const features = map.current!.queryRenderedFeatures(bbox, { layers: ['traffic-glow', 'traffic-lines'] });
                let maxLevel = 0;
                let color = '#0A84FF'; // Default blue (clear)
                for (const f of features) {
                  const congestion = f.properties?.congestion;
                  if (congestion === 'severe' && maxLevel < 4) { maxLevel = 4; color = '#BF5AF2'; }
                  else if (congestion === 'heavy' && maxLevel < 3) { maxLevel = 3; color = '#FF453A'; }
                  else if (congestion === 'moderate' && maxLevel < 2) { maxLevel = 2; color = '#FF9F0A'; }
                }
                return color;
              };
              
              const leftColor = getTrafficColor(leftBbox);
              const rightColor = getTrafficColor(rightBbox);
              
              leftStop.setAttribute('stop-color', leftColor);
              rightStop.setAttribute('stop-color', rightColor);
            }
          } catch (e) {
            // Ignore spatial query errors
          }

          animationFrameId.current = requestAnimationFrame(animateGlow);
        };
        animationFrameId.current = requestAnimationFrame(animateGlow);
      }

      // Create a highly professional, Apple Maps / Tesla style location marker
      const el = document.createElement('div');
      el.className = 'relative flex items-center justify-center w-24 h-24';
      el.innerHTML = `
        <div class="absolute inset-0 bg-[#0A84FF] rounded-full opacity-10 animate-ping" style="animation-duration: 3s;"></div>
        
        <!-- Directional Cone (Split Left/Right for ambient reflection) -->
        <svg class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[85%] pointer-events-none" width="100" height="100" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="leftConeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop id="leftConeStop" offset="0%" stop-color="#0A84FF" stop-opacity="0.8" />
              <stop offset="100%" stop-color="#0A84FF" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="rightConeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop id="rightConeStop" offset="0%" stop-color="#0A84FF" stop-opacity="0.8" />
              <stop offset="100%" stop-color="#0A84FF" stop-opacity="0" />
            </linearGradient>
          </defs>
          <!-- Left Cone Half -->
          <polygon points="50,100 15,0 50,0" fill="url(#leftConeGrad)" />
          <!-- Right Cone Half -->
          <polygon points="50,100 50,0 85,0" fill="url(#rightConeGrad)" />
        </svg>

        <div class="relative z-10 w-5 h-5 bg-[#0A84FF] rounded-full border-[3px] border-white shadow-[0_2px_15px_rgba(0,0,0,0.8)]"></div>
      `;
      
      marker.current = new mapboxgl.Marker({ 
        element: el,
        rotationAlignment: 'viewport'
      })
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
    
    // Bearing: 0 (north) if stopped, align with heading if moving fast
    const targetBearing = speed > 5 ? position.heading : map.current.getBearing();

    // Directional Marker Rotation (Google Maps Style)
    // If map is rotated to heading, cone points UP (0deg).
    // If map is stationary, cone rotates to show heading relative to map.
    const markerRotation = position.heading - targetBearing;
    
    map.current.easeTo({
      center: [position.longitude, position.latitude],
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      duration: 1000,
      easing: (t) => t * (2 - t),
    });

    // Update marker position and rotation
    marker.current?.setLngLat([position.longitude, position.latitude]);
    marker.current?.setRotation(markerRotation);
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
