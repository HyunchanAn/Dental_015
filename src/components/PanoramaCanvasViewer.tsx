import React, { useRef, useEffect } from 'react';
import { FinalReportResponse, NormalizedBBox } from '../types/finalReport';

interface PanoramaCanvasViewerProps {
  imageUrl?: string;
  reportData: FinalReportResponse;
  showSuspected?: boolean; // Dual threshold toggle for under-observation lesions (0.20 <= conf < 0.45)
}

export const PanoramaCanvasViewer: React.FC<PanoramaCanvasViewerProps> = ({
  imageUrl,
  reportData,
  showSuspected = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

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
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.88)'; // slate-900
        ctx.fillRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 720), 46);
        ctx.strokeStyle = '#f59e0b'; // amber-500
        ctx.lineWidth = 1.5;
        ctx.strokeRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 720), 46);

        ctx.fillStyle = '#f59e0b';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('⚠️ 해상도 불일치로 오버레이 비활성화됨', offsetX + 35, offsetY + 38);
        ctx.fillStyle = '#94a3b8'; // slate-400
        ctx.font = '11px sans-serif';
        ctx.fillText(
          `비트맵 해상도(${drawWidth > 0 ? '불일치' : 'None'})와 리포트 메타데이터(${reportData.imageMetadata.width}x${reportData.imageMetadata.height})가 상이합니다.`,
          offsetX + 35,
          offsetY + 54
        );
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

      // 1. Render Caries (Dental_002): Rose/Red BBox
      if (reportData.findings.caries) {
        reportData.findings.caries.forEach((box) => {
          drawBBox(box, '#f43f5e', box.toothNumber ? `#${box.toothNumber} Caries` : 'Caries');
        });
      }

      // 2. Render Periapical Lesions (Dental_012): Purple BBox
      if (reportData.findings.periapicalLesions) {
        reportData.findings.periapicalLesions.forEach((box) => {
          drawBBox(box, '#a855f7', box.toothNumber ? `#${box.toothNumber} Periapical` : 'Periapical');
        });
      }

      // 3. Render Bone Loss Polygons (Dental_003): Blue Contours
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

          poly.points.forEach((pt, idx) => {
            const px = offsetX + pt.x * drawWidth;
            const py = offsetY + pt.y * drawHeight;
            if (idx === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          });
          ctx.closePath();
          ctx.stroke();

          ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
          ctx.fill();
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

    if (imageUrl) {
      const img = new Image();
      img.onload = () => {
        if (!isMounted) return;
        drawWithLetterbox(img);
      };
      img.onerror = () => {
        if (!isMounted) return;
        drawPlaceholderGrid();
      };
      img.src = imageUrl;
      if (img.complete) {
        drawWithLetterbox(img);
      }
    } else {
      drawPlaceholderGrid();
    }

    return () => {
      isMounted = false;
    };
  }, [reportData, imageUrl, showSuspected]);

  return (
    <div className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
          <span>Panoramic Dual-Threshold Canvas Viewer</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
            Solid: Conf ≥ 45% | Dashed: 20% ~ 45%
          </span>
        </h3>
        <span className="text-xs text-slate-400">
          Metadata: {reportData.imageMetadata.width}x{reportData.imageMetadata.height}px
        </span>
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
