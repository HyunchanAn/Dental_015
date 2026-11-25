import React, { useRef, useEffect, useState } from 'react';
import { FinalReportResponse, NormalizedBBox } from '../types/finalReport';
import { SimpleNormBox } from '../utils/hitlLogic';

export type HiTLToolMode = 'select' | 'add_tooth' | 'add_caries';

export interface SelectedHiTLTarget {
  kind: 'tooth' | 'caries';
  index: number;
}

interface PanoramaCanvasViewerProps {
  imageUrl?: string;
  reportData: FinalReportResponse;
  showSuspected?: boolean;
  isDemoMode?: boolean;
  uploadedFileHash?: string | null;
  hitlEditMode?: boolean;
  hitlTool?: HiTLToolMode;
  selectedTarget?: SelectedHiTLTarget | null;
  onSelectTarget?: (target: SelectedHiTLTarget | null) => void;
  onUpdateToothGeometry?: (index: number, normBox: SimpleNormBox) => void;
  onUpdateCariesGeometry?: (index: number, normBox: SimpleNormBox) => void;
  onDrawNewBox?: (kind: 'tooth' | 'caries', normBox: SimpleNormBox) => void;
}

type VerificationStatus = 'idle' | 'verifying' | 'verified' | 'mismatch' | 'error' | 'missing_metadata';

interface LetterboxTransform {
  offsetX: number;
  offsetY: number;
  drawWidth: number;
  drawHeight: number;
}

interface DragState {
  action: 'move_tooth' | 'resize_tooth' | 'move_caries' | 'resize_caries' | 'draw_new';
  index: number;
  startNormX: number;
  startNormY: number;
  origBox: SimpleNormBox;
  currentBox: SimpleNormBox;
}

const SHORT_REST_ABBR: Record<string, string> = {
  'Inlay/Onlay': 'Fil',
  'Crown/Bridge': 'Crn',
  Implant: 'Imp',
  'Endodontic (RCT)': 'RCT',
};

export const PanoramaCanvasViewer: React.FC<PanoramaCanvasViewerProps> = ({
  imageUrl,
  reportData,
  showSuspected = false,
  isDemoMode = false,
  uploadedFileHash = null,
  hitlEditMode = false,
  hitlTool = 'select',
  selectedTarget = null,
  onSelectTarget,
  onUpdateToothGeometry,
  onUpdateCariesGeometry,
  onDrawNewBox,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const transformRef = useRef<LetterboxTransform>({
    offsetX: 0,
    offsetY: 0,
    drawWidth: 1200,
    drawHeight: 600,
  });

  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');
  const [actualHash, setActualHash] = useState<string | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);

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
        const effectiveActualHash = (uploadedFileHash || hashHex).toLowerCase();
        setActualHash(effectiveActualHash);

        const blob = new Blob([buffer]);
        currentObjectUrl = URL.createObjectURL(blob);
        setBlobUrl(currentObjectUrl);

        if (!reportHash) {
          setVerificationStatus('missing_metadata');
        } else if (effectiveActualHash === reportHash) {
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
  }, [imageUrl, reportData.imageMetadata.sha256_hash, uploadedFileHash]);

  const clientEventToNorm = (e: React.MouseEvent<HTMLCanvasElement>): { nx: number; ny: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    const cx = ((e.clientX - rect.left) / rect.width) * canvas.width;
    const cy = ((e.clientY - rect.top) / rect.height) * canvas.height;
    const { offsetX, offsetY, drawWidth, drawHeight } = transformRef.current;
    if (drawWidth <= 0 || drawHeight <= 0) return null;
    const nx = Math.max(0.0, Math.min(1.0, (cx - offsetX) / drawWidth));
    const ny = Math.max(0.0, Math.min(1.0, (cy - offsetY) / drawHeight));
    return { nx, ny };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hitlEditMode || verificationStatus !== 'verified') return;
    const pt = clientEventToNorm(e);
    if (!pt) return;
    const { nx, ny } = pt;

    if (hitlTool === 'add_tooth' || hitlTool === 'add_caries') {
      const initBox: SimpleNormBox = { x: nx, y: ny, w: 0.001, h: 0.001 };
      setDragState({
        action: 'draw_new',
        index: -1,
        startNormX: nx,
        startNormY: ny,
        origBox: initBox,
        currentBox: initBox,
      });
      return;
    }

    const handleTolX = 12 / Math.max(1, transformRef.current.drawWidth);
    const handleTolY = 12 / Math.max(1, transformRef.current.drawHeight);

    // 1. Check caries boxes first (smaller foreground boxes)
    const cariesList = reportData.findings.caries || [];
    for (let i = cariesList.length - 1; i >= 0; i--) {
      const c = cariesList[i];
      const rx2 = c.x + c.w;
      const ry2 = c.y + c.h;
      if (Math.abs(nx - rx2) <= handleTolX && Math.abs(ny - ry2) <= handleTolY) {
        onSelectTarget?.({ kind: 'caries', index: i });
        const box = { x: c.x, y: c.y, w: c.w, h: c.h };
        setDragState({
          action: 'resize_caries',
          index: i,
          startNormX: nx,
          startNormY: ny,
          origBox: box,
          currentBox: box,
        });
        return;
      }
      if (nx >= c.x && nx <= rx2 && ny >= c.y && ny <= ry2) {
        onSelectTarget?.({ kind: 'caries', index: i });
        const box = { x: c.x, y: c.y, w: c.w, h: c.h };
        setDragState({
          action: 'move_caries',
          index: i,
          startNormX: nx,
          startNormY: ny,
          origBox: box,
          currentBox: box,
        });
        return;
      }
    }

    // 2. Check tooth boxes
    const teethList = reportData.findings.teeth || [];
    for (let i = teethList.length - 1; i >= 0; i--) {
      const t = teethList[i];
      const rx2 = t.x + t.w;
      const ry2 = t.y + t.h;
      if (Math.abs(nx - rx2) <= handleTolX && Math.abs(ny - ry2) <= handleTolY) {
        onSelectTarget?.({ kind: 'tooth', index: i });
        const box = { x: t.x, y: t.y, w: t.w, h: t.h };
        setDragState({
          action: 'resize_tooth',
          index: i,
          startNormX: nx,
          startNormY: ny,
          origBox: box,
          currentBox: box,
        });
        return;
      }
      if (nx >= t.x && nx <= rx2 && ny >= t.y && ny <= ry2) {
        onSelectTarget?.({ kind: 'tooth', index: i });
        const box = { x: t.x, y: t.y, w: t.w, h: t.h };
        setDragState({
          action: 'move_tooth',
          index: i,
          startNormX: nx,
          startNormY: ny,
          origBox: box,
          currentBox: box,
        });
        return;
      }
    }

    onSelectTarget?.(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!dragState) return;
    const pt = clientEventToNorm(e);
    if (!pt) return;
    const { nx, ny } = pt;
    const dx = nx - dragState.startNormX;
    const dy = ny - dragState.startNormY;

    if (dragState.action === 'draw_new') {
      const x1 = Math.min(dragState.startNormX, nx);
      const y1 = Math.min(dragState.startNormY, ny);
      const x2 = Math.max(dragState.startNormX, nx);
      const y2 = Math.max(dragState.startNormY, ny);
      setDragState({
        ...dragState,
        currentBox: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 },
      });
      return;
    }

    if (dragState.action === 'move_tooth' || dragState.action === 'move_caries') {
      const nextX = Math.max(0.0, Math.min(1.0 - dragState.origBox.w, dragState.origBox.x + dx));
      const nextY = Math.max(0.0, Math.min(1.0 - dragState.origBox.h, dragState.origBox.y + dy));
      const updated = { ...dragState.origBox, x: nextX, y: nextY };
      setDragState({ ...dragState, currentBox: updated });
      if (dragState.action === 'move_tooth') {
        onUpdateToothGeometry?.(dragState.index, updated);
      } else {
        onUpdateCariesGeometry?.(dragState.index, updated);
      }
      return;
    }

    if (dragState.action === 'resize_tooth' || dragState.action === 'resize_caries') {
      const nextW = Math.max(0.008, Math.min(1.0 - dragState.origBox.x, dragState.origBox.w + dx));
      const nextH = Math.max(0.012, Math.min(1.0 - dragState.origBox.y, dragState.origBox.h + dy));
      const updated = { ...dragState.origBox, w: nextW, h: nextH };
      setDragState({ ...dragState, currentBox: updated });
      if (dragState.action === 'resize_tooth') {
        onUpdateToothGeometry?.(dragState.index, updated);
      } else {
        onUpdateCariesGeometry?.(dragState.index, updated);
      }
    }
  };

  const handleMouseUp = () => {
    if (!dragState) return;
    if (dragState.action === 'draw_new') {
      if (dragState.currentBox.w >= 0.008 && dragState.currentBox.h >= 0.01) {
        const kind = hitlTool === 'add_caries' ? 'caries' : 'tooth';
        onDrawNewBox?.(kind, dragState.currentBox);
      }
    }
    setDragState(null);
  };

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
      const reportHash = reportData.imageMetadata.sha256_hash?.toLowerCase();
      const currentHash = (uploadedFileHash || actualHash)?.toLowerCase();
      const hasHashMismatch =
        !isDemoMode &&
        Boolean(reportData.reportId) &&
        Boolean(reportHash && currentHash && reportHash !== currentHash);

      if (hasHashMismatch) {
        ctx.save();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
        ctx.fillRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 780), 46);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 780), 46);

        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('[BLOCKED] 이미지 해시(SHA-256) 불일치로 오버레이 차단됨', offsetX + 35, offsetY + 38);
        ctx.fillStyle = '#94a3b8';
        ctx.font = '11px sans-serif';
        ctx.fillText(
          `업로드된 이미지(${currentHash?.slice(0, 8)}...)와 리포트 해시(${reportHash?.slice(0, 8)}...)가 상이하여 추론 완료 전까지 오버레이를 차단합니다.`,
          offsetX + 35,
          offsetY + 54
        );
        ctx.restore();
        return;
      }

      if (!isResolutionMatched) {
        if (reportData.imageMetadata.width > 0 && reportData.imageMetadata.height > 0) {
          ctx.save();
          ctx.fillStyle = 'rgba(15, 23, 42, 0.90)';
          ctx.fillRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 720), 46);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(offsetX + 20, offsetY + 20, Math.min(drawWidth - 40, 720), 46);

          ctx.fillStyle = '#f59e0b';
          ctx.font = 'bold 12px sans-serif';
          ctx.fillText('[WARNING] 해상도 불일치로 오버레이 비활성화됨', offsetX + 35, offsetY + 38);
          ctx.fillStyle = '#94a3b8';
          ctx.font = '11px sans-serif';
          ctx.fillText(
            `비트맵 해상도와 리포트 메타데이터(${reportData.imageMetadata.width}x${reportData.imageMetadata.height})가 상이합니다.`,
            offsetX + 35,
            offsetY + 54
          );
          ctx.restore();
          return;
        }
      }

      if (verificationStatus !== 'verified') {
        if (!reportData.reportId) {
          return;
        }
        ctx.save();
        const bannerBg = 'rgba(15, 23, 42, 0.94)';
        let bannerBorder = '#ef4444';
        let bannerTitle = '[BLOCKED] 이미지 해시(SHA-256) 불일치로 오버레이 차단됨';
        let bannerSubtitle = `표시 이미지(${actualHash?.slice(0, 8)}...)와 리포트 식별자(${reportData.imageMetadata.sha256_hash?.slice(0, 8)}...)가 상이합니다.`;

        if (verificationStatus === 'verifying') {
          bannerBorder = '#38bdf8';
          bannerTitle = '[VERIFYING] 이미지 무결성 검증 중 (SHA-256 계산 및 리포트 대조)';
          bannerSubtitle = '환자 안전을 위해 이미지 해시 검증이 완료될 때까지 오버레이 렌더링이 보류됩니다.';
        } else if (verificationStatus === 'missing_metadata') {
          bannerBorder = '#f59e0b';
          bannerTitle = '[HOLD] 리포트 내 SHA-256 메타데이터 부재로 오버레이 보류됨';
          bannerSubtitle = '안전한 판독을 위해 리포트에 SHA-256 해시가 포함되어야 합니다.';
        } else if (verificationStatus === 'error') {
          bannerBorder = '#ef4444';
          bannerTitle = '[ERROR] 이미지 무결성 검증 실패로 오버레이 차단됨';
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

      if (reportData.imageMetadata.midline_x && reportData.imageMetadata.width) {
        const midNormX = reportData.imageMetadata.midline_x / reportData.imageMetadata.width;
        const midX = offsetX + midNormX * drawWidth;
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.7)';
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(midX, offsetY);
        ctx.lineTo(midX, offsetY + drawHeight);
        ctx.stroke();
      }

      // Build tooth -> restoration tags map from both tooth.restorationTags and findings.restorations
      const toothRestMap: Record<number, Set<string>> = {};
      (reportData.findings.restorations || []).forEach((r) => {
        if (r.toothNumber != null && r.type) {
          if (!toothRestMap[r.toothNumber]) toothRestMap[r.toothNumber] = new Set();
          toothRestMap[r.toothNumber].add(r.type);
        }
      });

      // 0. Render Detected Teeth (Dental_008) + Polygon Contours + Per-Tooth Restoration Tags (Dental_013)
      if (reportData.findings.teeth) {
        reportData.findings.teeth.forEach((tooth, idx) => {
          const vx = offsetX + tooth.x * drawWidth;
          const vy = offsetY + tooth.y * drawHeight;
          const vw = tooth.w * drawWidth;
          const vh = tooth.h * drawHeight;
          const isSuper = Boolean(tooth.isSupernumerary || [19, 29, 39, 49].includes(tooth.toothNumber));
          const isSelected = Boolean(hitlEditMode && selectedTarget?.kind === 'tooth' && selectedTarget.index === idx);

          // Optional segmentation polygon contour
          if (Array.isArray(tooth.polygon) && tooth.polygon.length >= 3) {
            ctx.beginPath();
            ctx.setLineDash([]);
            ctx.strokeStyle = isSelected ? 'rgba(34, 211, 238, 0.95)' : 'rgba(16, 185, 129, 0.45)';
            ctx.lineWidth = isSelected ? 2.0 : 1.0;
            tooth.polygon.forEach((pt, pIdx) => {
              const px = offsetX + pt.x * drawWidth;
              const py = offsetY + pt.y * drawHeight;
              if (pIdx === 0) ctx.moveTo(px, py);
              else ctx.lineTo(px, py);
            });
            ctx.closePath();
            ctx.stroke();
          }

          ctx.beginPath();
          if (isSelected) {
            ctx.setLineDash([]);
            ctx.strokeStyle = '#22d3ee';
            ctx.lineWidth = 2.6;
            ctx.fillStyle = 'rgba(34, 211, 238, 0.16)';
          } else if (isSuper) {
            ctx.setLineDash([4, 2]);
            ctx.strokeStyle = 'rgba(139, 92, 246, 0.90)';
            ctx.lineWidth = 1.8;
            ctx.fillStyle = 'rgba(139, 92, 246, 0.14)';
          } else if (tooth.uncertain) {
            ctx.setLineDash([3, 3]);
            ctx.strokeStyle = 'rgba(234, 179, 8, 0.85)';
            ctx.lineWidth = 1.5;
            ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
          } else if (tooth.clinicianCorrected) {
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(56, 189, 248, 0.90)';
            ctx.lineWidth = 1.8;
            ctx.fillStyle = 'rgba(56, 189, 248, 0.10)';
          } else {
            ctx.setLineDash([]);
            ctx.strokeStyle = 'rgba(16, 185, 129, 0.55)';
            ctx.lineWidth = 1.2;
            ctx.fillStyle = 'rgba(16, 185, 129, 0.05)';
          }
          ctx.strokeRect(vx, vy, vw, vh);
          ctx.fillRect(vx, vy, vw, vh);

          if (isSelected) {
            ctx.fillStyle = '#22d3ee';
            ctx.fillRect(vx + vw - 5, vy + vh - 5, 10, 10);
          }

          const mergedTags = new Set<string>(tooth.restorationTags || []);
          const mappedSet = toothRestMap[tooth.toothNumber];
          if (mappedSet) {
            mappedSet.forEach((tg) => mergedTags.add(tg));
          }
          const shortTags = [...mergedTags].map((tg) => SHORT_REST_ABBR[tg] || tg).join('+');

          ctx.setLineDash([]);
          const isUpper = (tooth.toothNumber >= 11 && tooth.toothNumber <= 29) || (tooth.toothNumber >= 51 && tooth.toothNumber <= 65);
          const badgeY = isUpper ? Math.max(offsetY, vy - 16) : Math.min(offsetY + drawHeight - 16, vy + vh);
          const baseFdiText = isSuper
            ? `SN #${tooth.toothNumber}`
            : tooth.uncertain
            ? `?#${tooth.toothNumber}`
            : tooth.clinicianCorrected
            ? `*#${tooth.toothNumber}`
            : `#${tooth.toothNumber}`;
          const badgeText = shortTags ? `${baseFdiText} [${shortTags}]` : baseFdiText;

          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(badgeText).width;
          ctx.fillStyle = isSelected
            ? 'rgba(8, 145, 178, 0.96)'
            : isSuper
            ? 'rgba(124, 58, 237, 0.92)'
            : tooth.uncertain
            ? 'rgba(202, 138, 4, 0.9)'
            : tooth.clinicianCorrected
            ? 'rgba(2, 132, 199, 0.92)'
            : mergedTags.size > 0
            ? 'rgba(13, 148, 136, 0.92)'
            : 'rgba(5, 150, 105, 0.85)';
          ctx.fillRect(vx, badgeY, textW + 6, 15);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(badgeText, vx + 3, badgeY + 11);
        });
      }

      // 1. Render Restorations (Dental_013)
      if (reportData.findings.restorations) {
        reportData.findings.restorations.forEach((item) => {
          const vx = offsetX + item.x * drawWidth;
          const vy = offsetY + item.y * drawHeight;
          const vw = item.w * drawWidth;
          const vh = item.h * drawHeight;

          ctx.beginPath();
          ctx.setLineDash([4, 2]);
          ctx.strokeStyle = '#14b8a6';
          ctx.lineWidth = 2.0;
          ctx.fillStyle = 'rgba(20, 184, 166, 0.20)';
          ctx.strokeRect(vx, vy, vw, vh);
          ctx.fillRect(vx, vy, vw, vh);

          ctx.setLineDash([]);
          const restLabel = item.type && item.type !== 'Restoration' ? item.type : 'Restored';
          const tag = item.toothNumber ? `#${item.toothNumber} ${restLabel}` : restLabel;
          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(tag).width;
          ctx.fillStyle = '#0d9488';
          ctx.fillRect(vx, vy > 18 ? vy - 18 : vy, textW + 8, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tag, vx + 4, vy > 18 ? vy - 5 : vy + 12);
        });
      }

      // 2. Render Impacted Teeth (Dental_009)
      if (reportData.findings.impactedTeeth) {
        reportData.findings.impactedTeeth.forEach((imp) => {
          const vx = offsetX + imp.x * drawWidth;
          const vy = offsetY + imp.y * drawHeight;
          const vw = imp.w * drawWidth;
          const vh = imp.h * drawHeight;

          ctx.beginPath();
          ctx.setLineDash([5, 3]);
          ctx.strokeStyle = '#ec4899';
          ctx.lineWidth = 2.2;
          ctx.fillStyle = 'rgba(236, 72, 153, 0.22)';
          ctx.strokeRect(vx, vy, vw, vh);
          ctx.fillRect(vx, vy, vw, vh);

          ctx.setLineDash([]);
          const tag = `Impacted #${imp.toothNumber} (${imp.wintersClass})`;
          ctx.font = 'bold 11px sans-serif';
          const textW = ctx.measureText(tag).width;
          ctx.fillStyle = '#db2777';
          ctx.fillRect(vx, vy > 18 ? vy - 18 : vy, textW + 8, 16);
          ctx.fillStyle = '#ffffff';
          ctx.fillText(tag, vx + 4, vy > 18 ? vy - 5 : vy + 12);
        });
      }

      const drawBBox = (
        box: NormalizedBBox,
        defaultColor: string,
        labelPrefix: string,
        isSelectedBox: boolean = false
      ) => {
        const conf = box.confidence;
        const isHighConf = box.clinicianCorrected
          ? true
          : box.clinicalStatus
          ? box.clinicalStatus === 'DEFINITE'
          : conf >= 0.45;
        const isSuspected =
          !isHighConf &&
          (box.clinicalStatus ? box.clinicalStatus === 'REVIEW_REQUIRED' : conf >= 0.25);

        // Hide sub-threshold (< 0.25) boxes completely and hide suspected boxes when toggle is off
        if (!isHighConf && !isSuspected && !hitlEditMode) return;
        if (isSuspected && !showSuspected && !hitlEditMode) return;

        const vx = offsetX + box.x * drawWidth;
        const vy = offsetY + box.y * drawHeight;
        const vw = box.w * drawWidth;
        const vh = box.h * drawHeight;

        ctx.beginPath();
        if (isSelectedBox) {
          ctx.setLineDash([]);
          ctx.strokeStyle = '#22d3ee';
          ctx.lineWidth = 2.8;
          ctx.fillStyle = 'rgba(34, 211, 238, 0.22)';
        } else if (isHighConf) {
          ctx.setLineDash([]);
          ctx.strokeStyle = defaultColor;
          ctx.lineWidth = 2.5;
          ctx.fillStyle = `${defaultColor}26`;
        } else {
          ctx.setLineDash([6, 4]);
          ctx.strokeStyle = '#f59e0b';
          ctx.lineWidth = 1.5;
          ctx.fillStyle = 'rgba(245, 158, 11, 0.15)';
        }

        ctx.strokeRect(vx, vy, vw, vh);
        ctx.fillRect(vx, vy, vw, vh);

        if (isSelectedBox) {
          ctx.fillStyle = '#22d3ee';
          ctx.fillRect(vx + vw - 5, vy + vh - 5, 10, 10);
        }

        ctx.setLineDash([]);
        const confPercent = (conf * 100).toFixed(0);
        const tagText = box.clinicianCorrected
          ? `*${labelPrefix}`
          : isHighConf
          ? `${labelPrefix} ${confPercent}%`
          : `Suspected ${confPercent}%`;

        ctx.font = 'bold 12px sans-serif';
        const textWidth = ctx.measureText(tagText).width;

        ctx.fillStyle = isSelectedBox ? '#0891b2' : isHighConf ? defaultColor : '#f59e0b';
        ctx.fillRect(vx, vy > 20 ? vy - 20 : vy, textWidth + 10, 18);

        ctx.fillStyle = '#ffffff';
        ctx.fillText(tagText, vx + 5, vy > 20 ? vy - 6 : vy + 13);
      };

      // 3. Render Caries (Dental_002)
      if (reportData.findings.caries) {
        reportData.findings.caries.forEach((box, idx) => {
          const isSel = Boolean(hitlEditMode && selectedTarget?.kind === 'caries' && selectedTarget.index === idx);
          drawBBox(box, '#f43f5e', box.toothNumber ? `#${box.toothNumber} Caries` : 'Caries', isSel);
        });
      }

      // 4. Render Periapical Lesions (Dental_012) with optional RCT tag
      if (reportData.findings.periapicalLesions) {
        reportData.findings.periapicalLesions.forEach((box) => {
          const rctSuffix = box.rctAssociated ? ' (RCT)' : '';
          drawBBox(
            box,
            '#a855f7',
            box.toothNumber ? `#${box.toothNumber} Periapical${rctSuffix}` : `Periapical${rctSuffix}`
          );
        });
      }

      // 5. Render Bone Loss Polygons (Dental_003)
      if (reportData.findings.boneLoss) {
        reportData.findings.boneLoss.forEach((poly) => {
          if (poly.points.length === 0) return;
          const isHighConf = poly.confidence >= 0.45;
          const isSuspected = poly.confidence >= 0.25 && poly.confidence < 0.45;

          if (!isHighConf && !isSuspected) return;
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

          ctx.setLineDash([]);
          const confPercent = (poly.confidence * 100).toFixed(0);
          const rblSuffix = poly.rblPercent != null ? ` ${poly.rblPercent.toFixed(0)}%` : '';
          const tagText = isHighConf
            ? poly.toothNumber
              ? `#${poly.toothNumber} RBL${rblSuffix}`
              : `BoneLoss ${confPercent}%`
            : poly.toothNumber
            ? `Suspected #${poly.toothNumber}`
            : `Suspected ${confPercent}%`;

          ctx.font = 'bold 12px sans-serif';
          const textWidth = ctx.measureText(tagText).width;

          ctx.fillStyle = isHighConf ? '#3b82f6' : '#f59e0b';
          const badgeY = minY > 20 ? minY - 20 : minY;
          ctx.fillRect(minX, badgeY, textWidth + 10, 18);

          ctx.fillStyle = '#ffffff';
          ctx.fillText(tagText, minX + 5, badgeY + 13);
        });
      }

      // 6. Render active rubberband box during HiTL add_tooth / add_caries drawing
      if (dragState && dragState.action === 'draw_new') {
        const bx = offsetX + dragState.currentBox.x * drawWidth;
        const by = offsetY + dragState.currentBox.y * drawHeight;
        const bw = dragState.currentBox.w * drawWidth;
        const bh = dragState.currentBox.h * drawHeight;
        ctx.save();
        ctx.setLineDash([5, 3]);
        ctx.strokeStyle = hitlTool === 'add_caries' ? '#fb7185' : '#38bdf8';
        ctx.lineWidth = 2.2;
        ctx.fillStyle = hitlTool === 'add_caries' ? 'rgba(244, 63, 94, 0.2)' : 'rgba(56, 189, 248, 0.2)';
        ctx.strokeRect(bx, by, bw, bh);
        ctx.fillRect(bx, by, bw, bh);
        ctx.restore();
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

      ctx.fillStyle = '#64748b';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        '파노라마 영상을 업로드하여 실추론/HiTL 검수를 실행하거나 [데모 불러오기 (Load Demo)]를 선택하세요.',
        cWidth / 2,
        cHeight / 2
      );
      ctx.textAlign = 'start';
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
        drawWidth = cWidth;
        drawHeight = cWidth / imgAspect;
        offsetX = 0;
        offsetY = (cHeight - drawHeight) / 2;
      } else {
        drawHeight = cHeight;
        drawWidth = cHeight * imgAspect;
        offsetX = (cWidth - drawWidth) / 2;
        offsetY = 0;
      }

      transformRef.current = { offsetX, offsetY, drawWidth, drawHeight };

      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cWidth, cHeight);
      ctx.drawImage(img, offsetX, offsetY, drawWidth, drawHeight);

      const isResolutionMatched =
        imgW === reportData.imageMetadata.width && imgH === reportData.imageMetadata.height;

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
  }, [
    reportData,
    blobUrl,
    imageUrl,
    showSuspected,
    verificationStatus,
    actualHash,
    isDemoMode,
    uploadedFileHash,
    hitlEditMode,
    hitlTool,
    selectedTarget,
    dragState,
  ]);

  return (
    <div
      className={`w-full bg-slate-950 p-4 rounded-xl space-y-3 ${
        hitlEditMode
          ? 'border-2 border-cyan-500/80 shadow-lg shadow-cyan-950/30'
          : isDemoMode
          ? 'border-2 border-amber-500/80 shadow-lg shadow-amber-950/30'
          : verificationStatus === 'mismatch'
          ? 'border-2 border-rose-500/80 shadow-lg shadow-rose-950/30'
          : 'border border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center space-x-2">
          <span>Panoramic Dual-Threshold & HiTL Canvas Viewer</span>
          <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-normal">
            Solid: Conf &gt;= 45% | Dashed: 20% ~ 45%
          </span>
          {hitlEditMode && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/50 text-cyan-300 font-bold">
              HiTL EDIT ACTIVE ({hitlTool.toUpperCase()})
            </span>
          )}
          {isDemoMode && (
            <span className="text-[11px] px-2 py-0.5 rounded bg-amber-500/20 border border-amber-500/50 text-amber-300 font-bold">
              DEMO OVERLAY
            </span>
          )}
        </h3>
        <div className="flex items-center space-x-2 text-xs text-slate-400">
          <span>Metadata: {reportData.imageMetadata.width}x{reportData.imageMetadata.height}px</span>
          {reportData.imageMetadata.is_calibrated && reportData.imageMetadata.pixel_spacing_mm && (
            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-emerald-950 border border-emerald-700 text-emerald-300">
              {reportData.imageMetadata.pixel_spacing_mm[0]}mm/px
            </span>
          )}
          {reportData.imageMetadata.sha256_hash && (
            <span
              className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-900 border border-slate-700 text-sky-400"
              title={reportData.imageMetadata.sha256_hash}
            >
              SHA: {reportData.imageMetadata.sha256_hash.slice(0, 8)}...
            </span>
          )}
          {verificationStatus === 'verified' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-600 text-emerald-300 font-medium">
              Verified
            </span>
          )}
          {verificationStatus === 'verifying' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-950/80 border border-sky-600 text-sky-300 font-medium animate-pulse">
              Verifying SHA...
            </span>
          )}
          {verificationStatus === 'mismatch' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-rose-950/80 border border-rose-600 text-rose-300 font-medium">
              SHA Mismatch
            </span>
          )}
          {verificationStatus === 'missing_metadata' && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-950/80 border border-amber-600 text-amber-300 font-medium">
              SHA Unset
            </span>
          )}
        </div>
      </div>
      <div
        className={`relative w-full aspect-[2/1] overflow-hidden rounded-lg bg-black ${
          hitlEditMode ? 'border-2 border-cyan-500/70' : isDemoMode ? 'border-2 border-amber-500/70' : 'border border-slate-800'
        }`}
      >
        <canvas
          ref={canvasRef}
          width={1200}
          height={600}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          className={`w-full h-full ${hitlEditMode ? 'cursor-crosshair' : 'cursor-default'}`}
        />
      </div>
    </div>
  );
};
