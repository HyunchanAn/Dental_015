import React, { useRef, useEffect, useState } from 'react';
import { FinalReportResponse, NormalizedBBox } from '../types/finalReport';

interface PanoramaCanvasViewerProps {
  imageUrl?: string;
  reportData: FinalReportResponse;
  showSuspected?: boolean; // Dual threshold toggle for under-observation lesions (0.20 <= conf < 0.45)
}

type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'mismatch' | 'error' | 'missing_metadata';

export const PanoramaCanvasViewer: React.FC<PanoramaCanvasViewerProps> = ({
  imageUrl,
  reportData,
  showSuspected = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [actualHash, setActualHash] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Single-source-of-bytes pipeline:
  // Fetch image as Blob -> Compute SHA-256 on same buffer -> Verify against report metadata -> Create ObjectURL for display
  useEffect(() => {
    let isMounted = true;
    let currentObjectUrl: string | null = null;

    if (!imageUrl) {
      setVerificationStatus('idle');
      setActualHash(null);
      setBlobUrl(null);
      return;
    }

    const reportHash = reportData.imageMetadata.sha256_hash?.toLowerCase();
    if (!reportHash) {
      setVerificationStatus('missing_metadata');
    } else {
      setVerificationStatus('verifying');
    }

    const loadAndVerify = async () => {
      try {
        const resp = await fetch(imageUrl);
        if (!resp.ok) {
          throw new Error(`Failed to fetch image: HTTP ${resp.status}`);
        }
        const buffer = await resp.arrayBuffer();
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');

        if (!isMounted) return;
        setActualHash(hashHex);

        const blob = new Blob([buffer]);
        currentObjectUrl = URL.createObjectURL(blob);
        setBlobUrl(currentObjectUrl);

        if (!reportHash) {
          setVerificationStatus('missing_metadata');
        } else if (hashHex.toLowerCase() === reportHash) {
          setVerificationStatus('verified');
        } else {
          setVerificationStatus('mismatch');
        }
      } catch (err) {
        console.error('Image integrity verification failed:', err);
        if (isMounted) {
          setVerificationStatus('error');
        }
      }
    };

    loadAndVerify();

    return () => {
      isMounted = false;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [imageUrl, reportData.imageMetadata.sha256_hash]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isMounted = true;
    const { width: cWidth, height: cHeight } = canvas;

    const renderOverlay = (
      offsetX: number,
      offsetY: number,
      drawWidth: number,
      drawHeight: number,
      isResolutionMatched: boolean
    ) => {
      if (!isResolutionMatched) {
        // Warning Banner when image bitmap dimensions don't match report metadata
        if (reportData.imageMetadata.width > 0 && reportData.imageMetadata.height > 0) {
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
          ctx.fillRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 720), 46);
          ctx.strokeStyle = '#f59e0b'; // amber-500
          ctx.lineWidth = 1.5;
          ctx.strokeRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 720), 46);

          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('⚠️ 해상도 불일치로 오버레이 비활성화됨', offsetX + 35, offsetY + 38);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11px sans-serif';
          ctx.fillText(
            `비트맵 해상도(${drawWidth > 0 ? '불일치' : 'None'})와 리포트 메타데이터(${reportData.imageMetadata.width}x${reportData.imageMetadata.height})가 상이합니다.`,
            offsetX + 35,
            offsetY + 54
          );
          ctx.restore();
          return;
        }
      }

      // Fail-closed verification gate: Overlay is strictly blocked unless verified
      if (verificationStatus !== 'verified') {
        ctx.save();
        let bannerBg = 'rgba(15, 23, 42, 0.94)';
        let bannerBorder = '#ef4444';
        let bannerTitle = '🚫 이미지 해시(SHA-256) 불일치로 오버레이 차단됨';
        let bannerSubtitle = `표시 이미지(${actualHash?.slice(0, 8)}...)와 리포트 식별자(${reportData.imageMetadata.sha256_hash?.slice(0, 8)}...)가 상이합니다.`;

        if (verificationStatus === 'verifying') {
          bannerBorder = '#38bdf8';
          bannerTitle = '🔒 이미지 무결성 검증 중 (SHA-256 계산 및 리포트 대조)';
          bannerSubtitle = '환자 안전을 위해 이미지 해시 검증이 완료될 때까지 오버레이 렌더링이 보류됩니다.';
        } else if (verificationStatus === 'missing_metadata') {
          bannerBorder = '#f59e0b';
          bannerTitle = '⚠️ 리포트 내 SHA-256 메타데이터 부재로 오버레이 보류됨';
          bannerSubtitle = '안전한 판독을 위해 리포트에 SHA-256 해시가 포함되어야 합니다.';
        } else if (verificationStatus === 'error') {
          bannerBorder = '#ef4444';
          bannerTitle = '⚠️ 이미지 무결성 검증 실패로 오버레이 차단됨';
          bannerSubtitle = '네트워크 또는 암호화 해시 계산 오류로 인해 오버레이 표시가 안전하게 중단되었습니다.';
        }

        ctx.fillStyle = bannerBg;
        ctx.fillRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 780), 46);
        ctx.strokeStyle = bannerBorder;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 780), 46);

        ctx.fillStyle = bannerBorder;
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText(bannerTitle, offsetX + 35, offsetY + 38);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText(bannerSubtitle, offsetX + 35, offsetY + 54);
        ctx.restore();
        return;
      }

      // Dynamic Midline marker
      if (reportData.imageMetadata.midline_x && reportData.imageMetadata.width) {
        const midNormX = reportData.imageMetadata.midline_x / reportData.imageMetadata.width;
        const midX = offsetX + midNormX * drawWidth;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)'; // sky-400
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(midX, offsetY);
        ctx.lineTo(midX, offsetY + drawHeight);
        ctx.stroke();
      }

      // 0. Render Detected Teeth (Dental_008): 32 Teeth BBoxes & FDI Labels
      if (reportData.findings.teeth) {
        reportData.findings.teeth.forEach((tooth) => {
          const vx = offsetX + tooth.x * drawWidth;
          const vy = offsetY + tooth.y * drawHeight;
          const vw = tooth.w * drawWidth;
          const vh = tooth.h * drawHeight;

          ctx.beginPath();
          if (tooth.uncertain) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(234, 179, 8, 0.85)'; // yellow-500
            ctx.lineWidth = 1.5;
            ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
          } else {
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)'; // emerald-500
            ctx.lineWidth = 1.2;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
          }
          ctx.strokeRect(vx, vy, vw, vh);
          ctx.fillRect(vx, vy, vw, vh);

          // Tooth FDI Label Badge
          ctx.setLineDash([]);
          const isUpper = tooth.toothNumber < 30;
          const badgeY = isUpper ? Math.max(offsetY, vy - 16) : Math.min(offsetY + drawHeight - 16, vy + vh);
          const badgeText = tooth.uncertain ? `?#${tooth.toothNumber}` : `#${tooth.toothNumber}`;
          
          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(badgeText).width;
          ctx.fillStyle = tooth.uncertain ? 'rgba(202, 138, 4, 0.9)' : 'rgba(5, 150, 105, 0.85)';
          ctx.fillRect(vx, badgeY, textW + 6, 15);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(badgeText, vx + 3, badgeY + 11);
        });
      }

      // 1. Render Restorations (Dental_013): Teal BBoxes
      if (reportData.findings.restorations) {
        reportData.findings.restorations.forEach((item) => {
          const vx = offsetX + item.x * drawWidth;
          const vy = offsetY + item.y * drawHeight;
          const vw = item.w * drawWidth;
          const vh = item.h * drawHeight;

          ctx.beginPath();
          ctx.setLineDash([4, 2]);
          ctx.strokeStyle = '#14b8a6'; // teal-500
          ctx.lineWidth = 2.0;
          ctx.fillStyle = 'rgba(20, 184, 166, 0.20)';
          ctx.strokeRect(vx, vy, vw, vh);
          ctx.fillRect(vx, vy, vw, vh);

          // Restoration Badge
          ctx.setLineDash([]);
          const tag = item.toothNumber ? `#${item.toothNumber} Restored` : 'Restoration';
          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(tag).width;
          ctx.fillStyle = '#0d9488'; // teal-600
          ctx.fillRect(vx, vy > 18 ? vy - 18 : vy, textW + 8, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tag, vx + 4, vy > 18 ? vy - 5 : vy + 12);
        });
      }

      // 2. Render Impacted Teeth (Dental_009): Pink/Fuchsia BBoxes
      if (reportData.findings.impactedTeeth) {
        reportData.findings.impactedTeeth.forEach((imp) => {
          const vx = offsetX + imp.x * drawWidth;
          const vy = offsetY + imp.y * drawHeight;
          const vw = imp.w * drawWidth;
          const vh = imp.h * drawHeight;

          ctx.beginPath();
          ctx.setLineDash([5, 3]);
          ctx.strokeStyle = '#ec4899'; // pink-500
          ctx.lineWidth = 2.2;
          ctx.fillStyle = 'rgba(236, 72, 153, 0.22)';
          ctx.strokeRect(vx, vy, vw, vh);
          ctx.fillRect(vx, vy, vw, vh);

          // Impacted Badge
          ctx.setLineDash([]);
          const tag = `Impacted #${imp.toothNumber} (${imp.wintersClass})`;
          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(tag).width;
          ctx.fillStyle = '#db2777'; // pink-600
          ctx.fillRect(vx, vy > 18 ? vy - 18 : vy, textW + 8, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tag, vx + 4, vy > 18 ? vy - 5 : vy + 12);
        });
      }

      const drawBBox = (box: NormalizedBBox, defaultColor: string, labelPrefix: string) => {
        const conf = box.confidence;
        const isHighConf = conf >= 0.45;
        const isSuspected = conf >= 0.20 && conf < 0.45;

        // Filter based on dual-threshold policy
        if (isSuspected && !showSuspected) return;

        const vx = offsetX + box.x * drawWidth;
        const vy = offsetY + box.y * drawHeight;
        const vw = box.w * drawWidth;
        const vh = box.h * drawHeight;

        ctx.beginPath();
        if (isHighConf) {
          // High confidence: Solid Line
          ctx.setLineDash([]);
          ctx.strokeStyle = defaultColor;
          ctx.lineWidth = 2.5;
          ctx.fillStyle = `${defaultColor}26`; // 15% opacity
        } else {
          // Suspected: Dashed Line (Screening mode)
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = '#f59e0b'; // amber-500
          ctx.lineWidth = 1.5;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        }

        ctx.strokeRect(vx, vy, vw, vh);
        ctx.fillRect(vx, vy, vw, vh);

        // Label Badge with Confidence %
        ctx.setLineDash([]);
        const confPercent = (conf * 100).toFixed(0);
        const tagText = isHighConf
          ? `${labelPrefix} ${confPercent}%`
          : `Suspected ${confPercent}%`;

        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(tagText).width;

        ctx.fillStyle = isHighConf ? defaultColor : '#f59e0b';
        ctx.fillRect(vx, vy > 20 ? vy - 20 : vy, textWidth + 10, 18);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(tagText, vx + 5, vy > 20 ? vy - 6 : vy + 13);
      };

      // 3. Render Caries (Dental_002): Rose/Red BBox
      if (reportData.findings.caries) {
        reportData.findings.caries.forEach((box) => {
          drawBBox(box, '#f43f5e', box.toothNumber ? `#${box.toothNumber} Caries` : 'Caries');
        });
      }

      // 4. Render Periapical Lesions (Dental_012): Purple BBox
      if (reportData.findings.periapicalLesions) {
        reportData.findings.periapicalLesions.forEach((box) => {
          drawBBox(box, '#a855f7', box.toothNumber ? `#${box.toothNumber} Periapical` : 'Periapical');
        });
      }

      // 5. Render Bone Loss Polygons (Dental_003): Blue Contours
      if (reportData.findings.boneLoss) {
        reportData.findings.boneLoss.forEach((poly) => {
          if (poly.points.length === 0) return;
          const isHighConf = poly.confidence >= 0.45;
          const isSuspected = poly.confidence >= 0.20 && poly.confidence < 0.45;

          if (isSuspected && !showSuspected) return;

          ctx.beginPath();
          if (isHighConf) {
            ctx.setLineDash([]);
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 2;
          } else {
            ctx.setLineDash([4, 4]);
            ctx.strokeStyle = '#60a5fa';
            ctx.lineWidth = 1.5;
          }

          let minX = Infinity;
          let minY = Infinity;

          poly.points.forEach((pt, idx) => {
            const px = offsetX + pt.x * drawWidth;
            const py = offsetY + pt.y * drawHeight;
            if (px < minX) minX = px;
            if (py < minY) minY = py;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fill();

          // Bone Loss Label Badge with Tooth Number and Confidence
          ctx.setLineDash([]);
          const confPercent = (poly.confidence * 100).toFixed(0);
          const tagText = isHighConf
            ? (poly.toothNumber ? `#${poly.toothNumber} BoneLoss ${confPercent}%` : `BoneLoss ${confPercent}%`)
            : (poly.toothNumber ? `Suspected #${poly.toothNumber} ${confPercent}%` : `Suspected ${confPercent}%`);

          ctx.font = 'bold 12px sans-serif';
          const textWidth = ctx.measureText(tagText).width;

          ctx.fillStyle = isHighConf ? '#3b82f6' : '#f59e0b';
          const badgeY = minY > 20 ? minY - 20 : minY;
          ctx.fillRect(minX, badgeY, textWidth + 10, 18);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(tagText, minX + 5, badgeY + 13);
        });
      }
    };

    const drawPlaceholderGrid = () => {
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, cWidth, cHeight);

      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      for (let x = 0; x < cWidth; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, cHeight);
        ctx.stroke();
      }
      for (let y = 0; y < cHeight; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(cWidth, y);
        ctx.stroke();
      }
    };

    const drawWithLetterbox = (img: HTMLImageElement) => {
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;

      if (!imgW || !imgH) {
        drawPlaceholderGrid();
        return;
      }

      const imgAspect = imgW / imgH;
      const canvasAspect = cWidth / cHeight;
      let drawWidth = cWidth;
      let drawHeight = cHeight;
      let offsetX = 0;
      let offsetY = 0;

      if (imgAspect > canvasAspect) {
        // 이미지가 캔버스보다 와이드함 -> 상하 레터박스
        drawWidth = cWidth;
        drawHeight = cWidth / imgAspect;
        offsetX = 0;
        offsetY = (cHeight - drawHeight) / 2;
      } else {
        // 이미지가 캔버스보다 톨함 -> 좌우 필러박스
        drawHeight = cHeight;
        drawWidth = cHeight * imgAspect;
        offsetX = (cWidth - drawWidth) / 2;
        offsetY = 0;
      }

      // 캔버스 배경을 검은색으로 클리어
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cWidth, cHeight);

      // 종횡비 보존 레터박스 이미지 그리기
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      // 해상도 검증: 로드된 비트맵 naturalWidth/Height vs reportData.imageMetadata.width/height
      const isResolutionMatched =
        imgW === reportData.imageMetadata.width &&
        imgH === reportData.imageMetadata.height;

      renderOverlay(offsetX, offsetY, drawWidth, drawHeight, isResolutionMatched);
    };

    ctx.clearRect(0, 0, cWidth, cHeight);

    const activeSrc = blobUrl || imageUrl;
    if (activeSrc) {
      const img = new Image();
      img.onload = () => {
        if (!isMounted) return;
        drawWithLetterbox(img);
      };
      img.onerror = () => {
        if (!isMounted) return;
        drawPlaceholderGrid();
      };
      img.src = activeSrc;
      if (img.complete) {
        drawWithLetterbox(img);
      }
    } else {
      drawPlaceholderGrid();
    }

    return () => {
      isMounted = false;
    };
  }, [reportData, blobUrl, imageUrl, showSuspected, verificationStatus, actualHash]);

  return (
    <div className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
          <span>Panoramic Dual-Threshold Canvas Viewer</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
            Solid: Conf ≥ 45% | Dashed: 20% ~ 45%
          </span>
        </h3>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Metadata: {reportData.imageMetadata.width}x{reportData.imageMetadata.height}px</span>
          {reportData.imageMetadata.sha256_hash && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-400" title={reportData.imageMetadata.sha256_hash}>
              SHA: {reportData.imageMetadata.sha256_hash.slice(0, 8)}...
            </span>
          )}
          {verificationStatus === 'verified' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-medium">
              ✓ Verified
            </span>
          )}
          {verificationStatus === 'verifying' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-600 text-sky-300 font-medium animate-pulse">
              Verifying SHA...
            </span>
          )}
          {verificationStatus === 'mismatch' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-600 text-rose-300 font-medium">
              ✗ SHA Mismatch
            </span>
          )}
          {verificationStatus === 'missing_metadata' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600 text-amber-300 font-medium">
              SHA Unset
            </span>
          )}
          {reportData.imageMetadata.preprocessing_id && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-emerald-400 font-mono">
              {reportData.imageMetadata.preprocessing_id}
            </span>
          )}
        </div>
      </div>
      <div className="relative w-full aspect-[2/1] overflow-hidden rounded-lg border border-slate-800 bg-black">
        <canvas
          ref={canvasRef}
          width={1200}
          height={600}
          className="w-full h-full cursor-crosshair"
        />
      </div>
    </div>
  );
};
