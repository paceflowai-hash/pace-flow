'use client';

import { useEffect, useRef } from 'react';

export function TeslaCanvasEngine() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) return;

    let width = 0;
    let height = 0;
    let animationId: number;

    // Simülasyon Durumu
    let time = 0;
    const speed = 4;
    const maxZ = 2500;
    
    // Ağdaki Araçlar (Entities)
    const vehicles = Array.from({ length: 5 }).map(() => ({
      laneOffset: (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 1.5 + 0.8),
      z: Math.random() * maxZ,
      speedOffset: (Math.random() - 0.5) * 1.2,
      color: Math.random() > 0.5 ? '#30D158' : '#FF9F0A'
    }));

    // Binalar (Procedural City)
    const buildings = Array.from({ length: 40 }).map(() => {
      const isLeft = Math.random() > 0.5;
      return {
        x: (isLeft ? -1 : 1) * (200 + Math.random() * 400),
        z: Math.random() * maxZ,
        w: 60 + Math.random() * 80,
        h: 100 + Math.random() * 400,
        d: 60 + Math.random() * 80,
        opacity: Math.random() * 0.3 + 0.1
      };
    });

    // ResizeObserver
    const resizeObserver = new ResizeObserver((entries) => {
      for (let entry of entries) {
        const dpr = window.devicePixelRatio || 1;
        width = entry.contentRect.width;
        height = entry.contentRect.height;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
      }
    });
    
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    // 3D -> 2D Projeksiyon
    const project = (x: number, y: number, z: number, curveOffset: number) => {
      const cameraY = -120;
      const cameraZ = -200;
      const focalLength = 350;
      
      const relativeZ = z - cameraZ;
      if (relativeZ < 1) return null;
      
      const scale = focalLength / relativeZ;
      
      return {
        x: width / 2 + (x + curveOffset) * scale,
        y: height / 2 + (y - cameraY) * scale + 50,
        scale
      };
    };

    // Render Döngüsü
    const render = () => {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);

      time += speed;
      const currentCurveTarget = Math.sin(time * 0.003) * 200; // Daha yumuşak, uzun virajlar

      // --- BİNALAR (Arka Plan Şehri) ---
      // Uzaktan yakına doğru çizmek için Z'ye göre sırala (Ressam Algoritması)
      const sortedBuildings = [...buildings].sort((a, b) => b.z - a.z);

      sortedBuildings.forEach(b => {
        b.z -= speed;
        if (b.z < -100) {
          b.z = maxZ;
          b.h = 100 + Math.random() * 400; // Yeni yükseklik
        }

        const cFront = Math.sin(b.z * 0.002) * currentCurveTarget;
        const cBack = Math.sin((b.z + b.d) * 0.002) * currentCurveTarget;

        // Köşeleri Hesapla
        const bl = project(b.x - b.w/2, 0, b.z, cFront); // Bottom-Left (Front)
        const br = project(b.x + b.w/2, 0, b.z, cFront); // Bottom-Right (Front)
        const tl = project(b.x - b.w/2, -b.h, b.z, cFront); // Top-Left (Front)
        const tr = project(b.x + b.w/2, -b.h, b.z, cFront); // Top-Right (Front)

        const bl_back = project(b.x - b.w/2, 0, b.z + b.d, cBack); // Bottom-Left (Back)
        const br_back = project(b.x + b.w/2, 0, b.z + b.d, cBack); // Bottom-Right (Back)
        const tl_back = project(b.x - b.w/2, -b.h, b.z + b.d, cBack); // Top-Left (Back)
        const tr_back = project(b.x + b.w/2, -b.h, b.z + b.d, cBack); // Top-Right (Back)

        if (bl && br && tl && tr && bl_back && br_back && tl_back && tr_back) {
          ctx.lineWidth = 1;
          
          // Yan Yüzey (Kameraya dönük olan)
          ctx.fillStyle = `rgba(10, 10, 12, ${b.opacity})`; // Çok koyu gri/siyah
          ctx.strokeStyle = `rgba(48, 209, 88, ${b.opacity * 0.5})`; // Neon yeşil ince çizgiler

          // Ön Yüz
          ctx.beginPath();
          ctx.moveTo(bl.x, bl.y); ctx.lineTo(br.x, br.y);
          ctx.lineTo(tr.x, tr.y); ctx.lineTo(tl.x, tl.y);
          ctx.closePath();
          ctx.fill(); ctx.stroke();

          // Üst Yüz
          ctx.beginPath();
          ctx.moveTo(tl.x, tl.y); ctx.lineTo(tr.x, tr.y);
          ctx.lineTo(tr_back.x, tr_back.y); ctx.lineTo(tl_back.x, tl_back.y);
          ctx.closePath();
          ctx.fill(); ctx.stroke();

          // İç/Dış Yan Yüz (Aracın solundaysa sağ yüz, sağındaysa sol yüz çizilir)
          ctx.beginPath();
          if (b.x < 0) { // Soldaki binaların sağ yüzü
            ctx.moveTo(br.x, br.y); ctx.lineTo(br_back.x, br_back.y);
            ctx.lineTo(tr_back.x, tr_back.y); ctx.lineTo(tr.x, tr.y);
          } else { // Sağdaki binaların sol yüzü
            ctx.moveTo(bl.x, bl.y); ctx.lineTo(bl_back.x, bl_back.y);
            ctx.lineTo(tl_back.x, tl_back.y); ctx.lineTo(tl.x, tl.y);
          }
          ctx.closePath();
          ctx.fill(); ctx.stroke();
        }
      });

      // --- YOL (Şeritler) ---
      const laneWidth = 140;
      const segmentLength = 120;

      // A. Dış Şerit Çizgileri
      ctx.lineWidth = 2;
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#30D158';
      ctx.strokeStyle = '#30D158';

      // Sol Şerit Sınırı
      ctx.beginPath();
      for (let z = 0; z < maxZ; z += 50) {
        const curveOffset = Math.sin(z * 0.002) * currentCurveTarget;
        const pt = project(-laneWidth * 1.5, 0, z, curveOffset);
        if (pt) {
          if (z === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();

      // Sağ Şerit Sınırı
      ctx.beginPath();
      for (let z = 0; z < maxZ; z += 50) {
        const curveOffset = Math.sin(z * 0.002) * currentCurveTarget;
        const pt = project(laneWidth * 1.5, 0, z, curveOffset);
        if (pt) {
          if (z === 0) ctx.moveTo(pt.x, pt.y);
          else ctx.lineTo(pt.x, pt.y);
        }
      }
      ctx.stroke();

      ctx.shadowBlur = 0;

      // B. Kesikli Şerit Çizgileri
      const zOffset = time % segmentLength;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      
      for (let z = 0; z < maxZ; z += segmentLength) {
        const drawZ = z - zOffset;
        if (drawZ < 0) continue;
        
        const curveOffset1 = Math.sin(drawZ * 0.002) * currentCurveTarget;
        const curveOffset2 = Math.sin((drawZ + segmentLength * 0.4) * 0.002) * currentCurveTarget;

        const pt1 = project(0, 0, drawZ, curveOffset1);
        const pt2 = project(0, 0, drawZ + segmentLength * 0.4, curveOffset2);

        if (pt1 && pt2) {
          const w = 4 * pt1.scale;
          ctx.beginPath();
          ctx.moveTo(pt1.x - w, pt1.y);
          ctx.lineTo(pt1.x + w, pt1.y);
          ctx.lineTo(pt2.x + w, pt2.y);
          ctx.lineTo(pt2.x - w, pt2.y);
          ctx.fill();
        }
      }

      // C. Ağdaki Araçlar
      vehicles.forEach(v => {
        v.z -= speed * v.speedOffset;
        if (v.z < -200) {
           v.z = maxZ;
           v.laneOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 1.5 + 0.8);
        } else if (v.z > maxZ) {
           v.z = -200;
           v.laneOffset = (Math.random() > 0.5 ? 1 : -1) * (Math.random() * 1.5 + 0.8);
        }

        const curveOffset = Math.sin(v.z * 0.002) * currentCurveTarget;
        const pt = project(v.laneOffset * laneWidth, -15, v.z, curveOffset);
        
        if (pt) {
           const size = 18 * pt.scale;
           ctx.shadowBlur = 15;
           ctx.shadowColor = v.color;
           ctx.fillStyle = v.color;
           
           ctx.beginPath();
           ctx.arc(pt.x, pt.y, size, 0, Math.PI * 2);
           ctx.fill();
           ctx.shadowBlur = 0;
        }
      });

      // Ufuk Çizgisi Derinlik Fade-out
      const grad = ctx.createLinearGradient(0, 0, 0, height * 0.6);
      grad.addColorStop(0, '#000000');
      grad.addColorStop(0.2, 'rgba(0,0,0,0.9)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);

      animationId = requestAnimationFrame(render);
    };

    animationId = requestAnimationFrame(render);

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
    };
  }, []);

  return (
    <canvas 
      ref={canvasRef} 
      className="absolute inset-0 w-full h-full pointer-events-none z-0 will-change-transform"
    />
  );
}
