'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeoPosition } from '@/lib/hooks/useGeolocation';

// Mapbox token required
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface MapboxEngineProps {
  position: GeoPosition | null;
  targetSpeed?: number;
  currentSpeed?: number;
  showShockAlert?: boolean;
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

// ── Offset Calculation (Meters to LatLng) ──
function getOffsetLatLng(lat: number, lng: number, distanceMeters: number, bearingDegrees: number): [number, number] {
  const R = 6378137; // Earth's radius in meters
  const dLat = distanceMeters * Math.cos(bearingDegrees * Math.PI / 180) / R;
  const dLng = distanceMeters * Math.sin(bearingDegrees * Math.PI / 180) / (R * Math.cos(lat * Math.PI / 180));
  return [lng + (dLng * 180 / Math.PI), lat + (dLat * 180 / Math.PI)];
}

export function MapboxEngine({ position, targetSpeed = 0, currentSpeed = 0, showShockAlert = false, onTrafficDensityChange }: MapboxEngineProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const rabbitMarker = useRef<mapboxgl.Marker | null>(null);
  const hiveMarkers = useRef<mapboxgl.Marker[]>([]);
  const shockMarker = useRef<mapboxgl.Marker | null>(null);
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
              // 1KM tarama alanı (Zoom 15 seviyesinde ortalama 150-200 piksel)
              // Sol Koni için: Aracın tam sol-ön çaprazı (100px sola, 200px ileriye kadar dar bir tünel)
              const leftBbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
                [pt.x - 100, Math.max(0, pt.y - 200)], 
                [pt.x - 5, pt.y]
              ];
              // Sağ Koni için: Aracın tam sağ-ön çaprazı (100px sağa, 200px ileriye kadar dar bir tünel)
              const rightBbox: [mapboxgl.PointLike, mapboxgl.PointLike] = [
                [pt.x + 5, Math.max(0, pt.y - 200)], 
                [pt.x + 100, pt.y]
              ];
              
              const getTrafficState = (bbox: [mapboxgl.PointLike, mapboxgl.PointLike]) => {
                const features = map.current!.queryRenderedFeatures(bbox, { layers: ['traffic-glow', 'traffic-lines'] });
                let maxLevel = 0;
                let color = '#FFFFFF'; // Default white (clear)
                let opacity = '0.15'; // Çok hafif beyaz ışık
                for (const f of features) {
                  const congestion = f.properties?.congestion;
                  // Opacity değerlerini yüksek tutuyoruz ki yoldaki trafik rengiyle BİREBİR aynı görünsün
                  if (congestion === 'severe' && maxLevel < 4) { maxLevel = 4; color = '#BF5AF2'; opacity = '0.8'; }
                  else if (congestion === 'heavy' && maxLevel < 3) { maxLevel = 3; color = '#FF453A'; opacity = '0.8'; }
                  else if (congestion === 'moderate' && maxLevel < 2) { maxLevel = 2; color = '#FF9F0A'; opacity = '0.8'; }
                }
                return { color, opacity };
              };
              
              const leftState = getTrafficState(leftBbox);
              const rightState = getTrafficState(rightBbox);
              
              leftStop.setAttribute('stop-color', leftState.color);
              leftStop.setAttribute('stop-opacity', leftState.opacity);
              const leftFade = document.getElementById('leftConeFade');
              if (leftFade) leftFade.setAttribute('stop-color', leftState.color);

              rightStop.setAttribute('stop-color', rightState.color);
              rightStop.setAttribute('stop-opacity', rightState.opacity);
              const rightFade = document.getElementById('rightConeFade');
              if (rightFade) rightFade.setAttribute('stop-color', rightState.color);
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
        <div class="absolute inset-0 bg-[#FFFFFF] rounded-full opacity-10 animate-ping" style="animation-duration: 3s;"></div>
        
        <!-- Directional Cone (Split Left/Right for ambient reflection) -->
        <svg class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[85%] pointer-events-none" width="100" height="100" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="leftConeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop id="leftConeStop" offset="0%" stop-color="#FFFFFF" stop-opacity="0.2" />
              <stop id="leftConeFade" offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
            </linearGradient>
            <linearGradient id="rightConeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop id="rightConeStop" offset="0%" stop-color="#FFFFFF" stop-opacity="0.2" />
              <stop id="rightConeFade" offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
            </linearGradient>
          </defs>
          <!-- Left Cone Half -->
          <polygon points="50,100 15,0 50,0" fill="url(#leftConeGrad)" />
          <!-- Right Cone Half -->
          <polygon points="50,100 50,0 85,0" fill="url(#rightConeGrad)" />
        </svg>

        <div class="relative z-10 w-5 h-5 bg-[#FFFFFF] rounded-full border-[3px] border-[#0A84FF] shadow-[0_2px_15px_rgba(0,0,0,0.8)]"></div>
      `;
      
      marker.current = new mapboxgl.Marker({ 
        element: el,
        rotationAlignment: 'viewport'
      })
        .setLngLat([startLng, startLat])
        .addTo(map.current!);
      // Create Pace Rabbit Marker
      const rabbitEl = document.createElement('div');
      rabbitEl.className = 'w-6 h-6 rounded-full bg-white/80 blur-[2px] shadow-[0_0_20px_#FFF] animate-pulse';
      rabbitMarker.current = new mapboxgl.Marker({ element: rabbitEl }).setLngLat([startLng, startLat]).addTo(map.current!);

      // Create Hive Markers
      for (let i = 0; i < 4; i++) {
        const hiveEl = document.createElement('div');
        hiveEl.className = 'w-3 h-3 rounded-full bg-[#0A84FF]/60 blur-[1px] shadow-[0_0_10px_#0A84FF] transition-all duration-1000';
        const hMarker = new mapboxgl.Marker({ element: hiveEl }).setLngLat([startLng, startLat]).addTo(map.current!);
        hiveMarkers.current.push(hMarker);
      }

      // Create Shock Marker
      const shockEl = document.createElement('div');
      shockEl.className = 'w-96 h-96 rounded-full border-[8px] border-[#FF453A] bg-[#FF453A]/20 scale-0 opacity-0 transition-all duration-700 pointer-events-none';
      shockMarker.current = new mapboxgl.Marker({ element: shockEl }).setLngLat([startLng, startLat]).addTo(map.current!);

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
    const markerRotation = position.heading - targetBearing;
    
    map.current.easeTo({
      center: [position.longitude, position.latitude],
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      duration: 1000,
      easing: (t) => t * (2 - t),
    });

    // Update Main Marker
    marker.current?.setLngLat([position.longitude, position.latitude]);
    marker.current?.setRotation(markerRotation);

    // Update Pace Rabbit (Ghost Car)
    if (targetSpeed > 0 && rabbitMarker.current) {
      // Rabbit is a few meters ahead based on speed difference
      const speedDiff = targetSpeed - currentSpeed;
      const distanceMeters = 50 + (speedDiff * 2); // default 50m ahead, increases if we are too slow
      const rabbitPos = getOffsetLatLng(position.latitude, position.longitude, Math.max(20, distanceMeters), position.heading);
      rabbitMarker.current.setLngLat(rabbitPos);
    } else {
      // Hide rabbit if no target speed
      rabbitMarker.current?.setLngLat([0, 0]);
    }

    // Update Hive Vehicles (Sürü Modu)
    hiveMarkers.current.forEach((hm, idx) => {
      // Randomly offset them by 20-50 meters around the user
      const rDist = 30 + (idx * 15) + (Math.sin(Date.now() / 2000 + idx) * 10);
      const rBearing = position.heading + (idx % 2 === 0 ? 90 : -90) + (Math.cos(Date.now() / 3000 + idx) * 20);
      const hivePos = getOffsetLatLng(position.latitude, position.longitude, rDist, rBearing);
      hm.setLngLat(hivePos);
    });

    // Update Shock Wave Radar
    if (showShockAlert && shockMarker.current) {
      // Show shockwave 1km ahead
      const shockPos = getOffsetLatLng(position.latitude, position.longitude, 1000, position.heading);
      shockMarker.current.setLngLat(shockPos);
      const el = shockMarker.current.getElement();
      el.classList.remove('scale-0', 'opacity-0');
      el.classList.add('scale-100', 'opacity-100', 'animate-ping');
    } else if (shockMarker.current) {
      const el = shockMarker.current.getElement();
      el.classList.remove('scale-100', 'opacity-100', 'animate-ping');
      el.classList.add('scale-0', 'opacity-0');
    }

  }, [position, mapLoaded, targetSpeed, currentSpeed, showShockAlert]);

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
