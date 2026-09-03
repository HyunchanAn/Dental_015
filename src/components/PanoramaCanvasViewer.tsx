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

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const { width: cWidth, height: cHeight } = canvas;

    // Draw background placeholder
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, cWidth, cHeight);

    // Grid lines for visual aid
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

    // Dynamic Midline marker
    if (reportData.imageMetadata.midline_x) {
      const midNormX = (reportData.imageMetadata.midline_x / reportData.imageMetadata.width) * cWidth;
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)'; // sky-400
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(midNormX, 0);
      ctx.lineTo(midNormX, cHeight);
      ctx.stroke();
    }

    const drawBBox = (box: NormalizedBBox, defaultColor: string, labelPrefix: string) => {
      const conf = box.confidence;
      const isHighConf = conf >= 0.45;
      const isSuspected = conf >= 0.20 && conf < 0.45;

      // Filter based on dual-threshold policy
      if (isSuspected && !showSuspected) return;

      const vx = box.x * cWidth;
      const vy = box.y * cHeight;
      const vw = box.w * cWidth;
      const vh = box.h * cHeight;

      ctx.beginPath();
      if (isHighConf) {
        // High confidence: Solid Line
        ctx.setLineDash([]);
        ctx.strokeStyle = defaultColor;
        ctx.lineWidth = 2.5;
        ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
      } else {
        // Suspected: Dashed Line (Screening mode)
        ctx.setLineDash([6, 4]);
        ctx.strokeStyle = '#f59e0b'; // amber-500
        ctx.lineWidth = 1.5;
        ctx.fillStyle = 'rgba(245, 158, 11, 0.1)';
      }

      ctx.strokeRect(vx, vy, vw, vh);
      ctx.fillRect(vx, vy, vw, vh);

      // Label Badge with Confidence %
      ctx.setLineDash([]);
      const confPercent = (conf * 100).toFixed(0);
      const tagText = isHighConf
        ? `${labelPrefix} ${confPercent}%`
        : `Suspected ${confPercent}%`;

      ctx.font = 'bold 11px sans-serif';
      const textWidth = ctx.measureText(tagText).width;

      ctx.fillStyle = isHighConf ? defaultColor : '#f59e0b';
      ctx.fillRect(vx, vy > 18 ? vy - 18 : vy, textWidth + 8, 16);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(tagText, vx + 4, vy > 18 ? vy - 5 : vy + 12);
    };

    // Render Caries
    if (reportData.findings.caries) {
      reportData.findings.caries.forEach((box) => {
        drawBBox(box, '#f43f5e', box.toothNumber ? `#${box.toothNumber} Caries` : 'Caries');
      });
    }

    // Render Periapical Lesions
    if (reportData.findings.periapicalLesions) {
      reportData.findings.periapicalLesions.forEach((box) => {
        drawBBox(box, '#a855f7', box.toothNumber ? `#${box.toothNumber} Periapical` : 'Periapical');
      });
    }

    // Render Bone Loss Polygons
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
          const px = pt.x * cWidth;
          const py = pt.y * cHeight;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();
        ctx.stroke();

        ctx.fillStyle = 'rgba(59, 130, 246, 0.15)';
        ctx.fill();
      });
    }
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
          Resolution: {reportData.imageMetadata.width}x{reportData.imageMetadata.height}px
        </span>
      </div>
      <div className="relative w-full aspect-[2/1] overflow-hidden rounded-lg border border-slate-800">
        <canvas
          ref={canvasRef}
          width={800}
          height={400}
          className="w-full h-full object-contain cursor-crosshair"
        />
      </div>
    </div>
  );
};
