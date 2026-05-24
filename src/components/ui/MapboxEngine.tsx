'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { GeoPosition } from '@/lib/hooks/useGeolocation';

// Mapbox token required
mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export interface DirectionalDensity {
  front: number;
  right: number;
  back: number;
  left: number;
}

interface MapboxEngineProps {
  position: GeoPosition | null;
  targetSpeed?: number;
  currentSpeed?: number;
  showShockAlert?: boolean;
  onTrafficDensityChange?: (density: number) => void;
  onDirectionalDensityChange?: (dirs: DirectionalDensity) => void;
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

function getBearingFromLatLon(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const lat1Rad = lat1 * Math.PI / 180;
  const lat2Rad = lat2 * Math.PI / 180;
  const y = Math.sin(dLon) * Math.cos(lat2Rad);
  const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) - Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLon);
  let brng = Math.atan2(y, x) * 180 / Math.PI;
  return (brng + 360) % 360;
}

// ── Offset Calculation (Meters to LatLng) ──
function getOffsetLatLng(lat: number, lng: number, distanceMeters: number, bearingDegrees: number): [number, number] {
  const R = 6378137; // Earth's radius in meters
  const dLat = distanceMeters * Math.cos(bearingDegrees * Math.PI / 180) / R;
  const dLng = distanceMeters * Math.sin(bearingDegrees * Math.PI / 180) / (R * Math.cos(lat * Math.PI / 180));
  return [lng + (dLng * 180 / Math.PI), lat + (dLat * 180 / Math.PI)];
}

export function MapboxEngine({ position, targetSpeed = 0, currentSpeed = 0, showShockAlert = false, onTrafficDensityChange, onDirectionalDensityChange }: MapboxEngineProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const marker = useRef<mapboxgl.Marker | null>(null);
  const rabbitMarker = useRef<mapboxgl.Marker | null>(null);
  const hiveMarkers = useRef<mapboxgl.Marker[]>([]);
  const shockMarker = useRef<mapboxgl.Marker | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapLoadedRef = useRef(false);
  const animationFrameId = useRef<number | null>(null);
  const stopTimeRef = useRef<number | null>(null);

  const [overviewMode, setOverviewMode] = useState(false);
  const prevOverviewMode = useRef(false);

  // Overview Interval (Her 25 saniyede bir 6 saniyeliğine geniş trafiği gösterir)
  useEffect(() => {
    const interval = setInterval(() => {
      setOverviewMode(true);
      setTimeout(() => setOverviewMode(false), 6000);
    }, 25000);
    return () => clearInterval(interval);
  }, []);

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
                  map.current.setPaintProperty(layer.id, 'line-opacity', 0.8); 
                  try {
                    // Kullanıcı talebi: Beyaz çizgileri daha belirgin (kalın) yap
                    map.current.setPaintProperty(layer.id, 'line-width', 2); 
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
                'line-width': 60,
                'line-blur': 15,
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
          
          // --- Ambient Traffic Reflection is moved to Radar ---
          try {
            const forwardStop = document.getElementById('forwardConeStop');
            const forwardFade = document.getElementById('forwardConeFade');
            if (forwardStop && forwardFade) {
              forwardStop.setAttribute('stop-color', '#FFFFFF');
              forwardStop.setAttribute('stop-opacity', '0.3');
              forwardFade.setAttribute('stop-color', '#FFFFFF');
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
      el.className = 'relative flex items-center justify-center w-20 h-20'; // Biraz daha küçültüldü
      el.innerHTML = `
        <div class="absolute inset-0 bg-[#FFFFFF] rounded-full opacity-10 animate-ping" style="animation-duration: 3s;"></div>
        
        <!-- Directional Cone (Single Professional Forward Cone) -->
        <svg class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[85%] pointer-events-none" width="70" height="70" viewBox="0 0 100 100">
          <defs>
            <linearGradient id="forwardConeGrad" x1="0%" y1="100%" x2="0%" y2="0%">
              <stop id="forwardConeStop" offset="0%" stop-color="#FFFFFF" stop-opacity="0.3" />
              <stop id="forwardConeFade" offset="100%" stop-color="#FFFFFF" stop-opacity="0" />
            </linearGradient>
          </defs>
          <!-- Single Solid Cone -->
          <polygon points="50,100 25,0 75,0" fill="url(#forwardConeGrad)" />
        </svg>

        <div class="relative z-10 w-4 h-4 bg-[#FFFFFF] rounded-full border-[3px] border-[#0A84FF] shadow-[0_2px_15px_rgba(0,0,0,0.8)]"></div>
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

    const speed = position.speed_kmh;
    
    // Geçiş kontrolü (Smooth animasyon için)
    const isModeChange = prevOverviewMode.current !== overviewMode;
    prevOverviewMode.current = overviewMode;

    // Apple Maps Style Dynamic Camera
    const normalizedSpeed = Math.min(speed / 120, 1); // 0.0 to 1.0
    
    // Geniş Mod aktifse zoom'u 14'e, pitch'i 10'a çekerek kuşbakışı trafik durumunu gösterir.
    const targetZoom = overviewMode ? 14 : 18 - (normalizedSpeed * 3.5);
    const targetPitch = overviewMode ? 10 : 40 + (normalizedSpeed * 25);
    
    // Bearing: Her zaman konumu takip et (dururken bile dönebilmesi için)
    const targetBearing = position.heading;

    // Directional Marker Rotation (Google Maps Style)
    const markerRotation = position.heading - targetBearing;
    
    // Yavaş ve smooth geçiş için duration'u ayarla
    const camDuration = (overviewMode || isModeChange) ? 3000 : 100;
    
    map.current.easeTo({
      center: [position.longitude, position.latitude],
      zoom: targetZoom,
      pitch: targetPitch,
      bearing: targetBearing,
      duration: camDuration,
      easing: (t) => t, // Linear easing for zero perceived latency
    });

    // Update Main Marker
    marker.current?.setLngLat([position.longitude, position.latitude]);
    marker.current?.setRotation(markerRotation);

    // Update Pace Rabbit (Ghost Car)
    // Sadece hareket halindeyken (hız > 5) tavşanı göster, yoksa üçgenin ortasında parlayıp kafa karıştırıyor.
    if (targetSpeed > 0 && currentSpeed > 5 && rabbitMarker.current) {
      const speedDiff = targetSpeed - currentSpeed;
      // Tavşanı en az 250 metre ileri atalım ki üçgenin (160px) altından çıksın
      const distanceMeters = 250 + (speedDiff * 5); 
      const rabbitPos = getOffsetLatLng(position.latitude, position.longitude, Math.max(150, distanceMeters), position.heading);
      rabbitMarker.current.setLngLat(rabbitPos);
    } else {
      rabbitMarker.current?.setLngLat([0, 0]);
    }

    // Update Hive Vehicles (Sürü Modu)
    hiveMarkers.current.forEach((hm, idx) => {
      if (currentSpeed > 5) {
        // Hız 5'ten büyükse etrafta kovan araçları dolsun (en az 100 metre uzakta)
        const rDist = 120 + (idx * 50) + (Math.sin(Date.now() / 2000 + idx) * 20);
        const rBearing = position.heading + (idx % 2 === 0 ? 90 : -90) + (Math.cos(Date.now() / 3000 + idx) * 30);
        const hivePos = getOffsetLatLng(position.latitude, position.longitude, rDist, rBearing);
        hm.setLngLat(hivePos);
      } else {
        // Dururken gizle
        hm.setLngLat([0, 0]);
      }
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

  }, [position, mapLoaded, targetSpeed, currentSpeed, showShockAlert, overviewMode]);

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

        let dFront = 0, dFrontWeight = 0;
        let dRight = 0, dRightWeight = 0;
        let dBack = 0, dBackWeight = 0;
        let dLeft = 0, dLeftWeight = 0;

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
          const weight = 1 / (1 + Math.pow(distKm * 3, 2));

          weightedCongestion += congestionValue * weight;
          totalWeight += weight;

          // Calculate Directional
          const bearing = getBearingFromLatLon(position.latitude, position.longitude, lat, lng);
          const relativeAngle = (bearing - position.heading + 360) % 360;

          if (relativeAngle >= 315 || relativeAngle < 45) {
            dFront += congestionValue * weight; dFrontWeight += weight;
          } else if (relativeAngle >= 45 && relativeAngle < 135) {
            dRight += congestionValue * weight; dRightWeight += weight;
          } else if (relativeAngle >= 135 && relativeAngle < 225) {
            dBack += congestionValue * weight; dBackWeight += weight;
          } else {
            dLeft += congestionValue * weight; dLeftWeight += weight;
          }
        });

        if (onTrafficDensityChange) {
          const finalDensity = totalWeight > 0 ? Math.round(weightedCongestion / totalWeight) : 0;
          onTrafficDensityChange(finalDensity);
        }

        if (onDirectionalDensityChange) {
          onDirectionalDensityChange({
            front: dFrontWeight > 0 ? Math.round(dFront / dFrontWeight) : 0,
            right: dRightWeight > 0 ? Math.round(dRight / dRightWeight) : 0,
            back: dBackWeight > 0 ? Math.round(dBack / dBackWeight) : 0,
            left: dLeftWeight > 0 ? Math.round(dLeft / dLeftWeight) : 0,
          });
        }

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
