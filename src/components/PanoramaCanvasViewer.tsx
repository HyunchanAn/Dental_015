import React, { useRef, useEffect } from 'react';
import { FinalReportResponse } from '../types/finalReport';

interface PanoramaCanvasViewerProps {
  imageUrl?: string;
  reportData: FinalReportResponse;
}

export const PanoramaCanvasViewer: React.FC<PanoramaCanvasViewerProps> = ({
  imageUrl,
  reportData,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const { width: cWidth, height: cHeight } = canvas;

    // Draw background placeholder if no image
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.fillRect(0, 0, cWidth, cHeight);

    // Grid lines for visual aid
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
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

    // Render BBoxes for Caries (Normalized 0.0 ~ 1.0)
    if (reportData.findings.caries) {
      reportData.findings.caries.forEach((box) => {
        const vx = box.x * cWidth;
        const vy = box.y * cHeight;
        const vw = box.w * cWidth;
        const vh = box.h * cHeight;

        // BBox outline
        ctx.strokeStyle = '#f43f5e'; // rose-500
        ctx.lineWidth = 2;
        ctx.strokeRect(vx, vy, vw, vh);

        // Fill highlight
        ctx.fillStyle = 'rgba(244, 63, 94, 0.15)';
        ctx.fillRect(vx, vy, vw, vh);

        // Label tag
        ctx.fillStyle = '#f43f5e';
        ctx.font = '12px sans-serif';
        const tagText = `#${box.toothNumber || ''} ${box.label} (${(box.confidence * 100).toFixed(0)}%)`;
        ctx.fillText(tagText, vx, vy > 15 ? vy - 4 : vy + 12);
      });
    }

    // Render Polygons for Bone Loss
    if (reportData.findings.boneLoss) {
      reportData.findings.boneLoss.forEach((poly) => {
        if (poly.points.length === 0) return;

        ctx.beginPath();
        poly.points.forEach((pt, idx) => {
          const px = pt.x * cWidth;
          const py = pt.y * cHeight;
          if (idx === 0) ctx.moveTo(px, py);
          else ctx.lineTo(px, py);
        });
        ctx.closePath();

        ctx.strokeStyle = '#3b82f6'; // blue-500
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        ctx.fill();
      });
    }
  }, [reportData, imageUrl]);

  return (
    <div className="w-full bg-slate-950 p-4 rounded-xl border border-slate-800">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">
          Panoramic Overlay Canvas Viewer (Normalized Coordinates Engine)
        </h3>
        <span className="text-xs text-slate-400">
          Source Res: {reportData.imageMetadata.width}x{reportData.imageMetadata.height}px
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
