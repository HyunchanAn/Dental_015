export const HITL_SCHEMA_VERSION = 'dental_core.panorama_hitl.v1';

export const SUPERNUMERARY_FDI_SET = new Set([19, 29, 39, 49]);

export const ALL_Selectable_FDI = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38,
  19, 29, 39, 49,
  55, 54, 53, 52, 51, 61, 62, 63, 64, 65,
  85, 84, 83, 82, 81, 71, 72, 73, 74, 75,
];

export const RESTORATION_TAG_OPTIONS = [
  'Inlay/Onlay',
  'Crown/Bridge',
  'Implant',
  'Endodontic (RCT)',
];

function clamp01(v) {
  return Math.max(0.0, Math.min(1.0, Number(v) || 0.0));
}

function roundN(v, digits = 4) {
  const f = Math.pow(10, digits);
  return Math.round(Number(v) * f) / f;
}

export function normBoxToPxXyxy(box, width, height) {
  const x1 = clamp01(box.x) * width;
  const y1 = clamp01(box.y) * height;
  const x2 = clamp01(box.x + box.w) * width;
  const y2 = clamp01(box.y + box.h) * height;
  return [roundN(x1, 2), roundN(y1, 2), roundN(x2, 2), roundN(y2, 2)];
}

export function pxXyxyToNormBox(xyxy, width, height) {
  const wImg = Math.max(1, Number(width) || 1);
  const hImg = Math.max(1, Number(height) || 1);
  const x1 = Math.min(xyxy[0], xyxy[2]);
  const y1 = Math.min(xyxy[1], xyxy[3]);
  const x2 = Math.max(xyxy[0], xyxy[2]);
  const y2 = Math.max(xyxy[1], xyxy[3]);
  return {
    x: roundN(clamp01(x1 / wImg), 6),
    y: roundN(clamp01(y1 / hImg), 6),
    w: roundN(clamp01((x2 - x1) / wImg), 6),
    h: roundN(clamp01((y2 - y1) / hImg), 6),
  };
}

export function serializeReportToHiTLGolden(report, annotator = 'clinician_015') {
  const meta = report.imageMetadata || {};
  const w = Math.max(1, Number(meta.width) || 2000);
  const h = Math.max(1, Number(meta.height) || 1000);
  const nowIso = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
  const findings = report.findings || {};

  const teeth = (findings.teeth || []).map((t, idx) => {
    const bboxPx = normBoxToPxXyxy(t, w, h);
    let polyPx;
    if (Array.isArray(t.polygon) && t.polygon.length >= 3) {
      polyPx = t.polygon.map((pt) => [roundN(clamp01(pt.x) * w, 2), roundN(clamp01(pt.y) * h, 2)]);
    } else {
      polyPx = [
        [bboxPx[0], bboxPx[1]],
        [bboxPx[2], bboxPx[1]],
        [bboxPx[2], bboxPx[3]],
        [bboxPx[0], bboxPx[3]],
      ];
    }
    const fdi = Number(t.toothNumber) || 0;
    return {
      instance_id: t.instanceId || `tooth-${idx + 1}`,
      fdi,
      bbox_xyxy: bboxPx,
      polygon_px: polyPx,
      confidence: roundN(t.confidence ?? 1.0, 4),
      uncertain: Boolean(t.uncertain),
      is_supernumerary: Boolean(t.isSupernumerary || SUPERNUMERARY_FDI_SET.has(fdi)),
      restoration_tags: Array.isArray(t.restorationTags) ? [...new Set(t.restorationTags)] : [],
      clinician_corrected: Boolean(t.clinicianCorrected),
      original_fdi: t.originalToothNumber != null ? Number(t.originalToothNumber) : null,
    };
  });

  const lesions = [];
  (findings.caries || []).forEach((c, idx) => {
    lesions.push({
      instance_id: c.instanceId || `caries-${idx + 1}`,
      category: 'caries',
      label: c.label || 'Dental Caries',
      bbox_xyxy: normBoxToPxXyxy(c, w, h),
      fdi: c.toothNumber != null ? Number(c.toothNumber) : null,
      confidence: roundN(c.confidence ?? 1.0, 4),
      clinical_status: c.clinicalStatus || 'DEFINITE',
      rct_associated: null,
      clinician_corrected: Boolean(c.clinicianCorrected),
    });
  });

  (findings.periapicalLesions || []).forEach((p, idx) => {
    lesions.push({
      instance_id: p.instanceId || `periapical-${idx + 1}`,
      category: 'periapical',
      label: p.label || 'Periapical Lesion',
      bbox_xyxy: normBoxToPxXyxy(p, w, h),
      fdi: p.toothNumber != null ? Number(p.toothNumber) : null,
      confidence: roundN(p.confidence ?? 1.0, 4),
      clinical_status: p.clinicalStatus || 'DEFINITE',
      rct_associated: p.rctAssociated ?? null,
      clinician_corrected: Boolean(p.clinicianCorrected),
    });
  });

  (findings.restorations || []).forEach((r, idx) => {
    lesions.push({
      instance_id: r.instanceId || `restoration-${idx + 1}`,
      category: 'restoration',
      label: r.type || 'Restoration',
      bbox_xyxy: normBoxToPxXyxy(r, w, h),
      fdi: r.toothNumber != null ? Number(r.toothNumber) : null,
      confidence: roundN(r.confidence ?? 1.0, 4),
      clinical_status: 'DEFINITE',
      rct_associated: r.type === 'Endodontic (RCT)',
      clinician_corrected: Boolean(r.clinicianCorrected),
    });
  });

  const boneLoss = (findings.boneLoss || [])
    .filter((b) => b.toothNumber != null)
    .map((b) => ({
      fdi: Number(b.toothNumber),
      polygon_px: (b.points || []).map((pt) => [roundN(clamp01(pt.x) * w, 2), roundN(clamp01(pt.y) * h, 2)]),
      rbl_percent: roundN(b.rblPercent ?? 0.0, 2),
      loss_mm: b.lossMm != null ? roundN(b.lossMm, 2) : null,
      mm_calibrated: Boolean(b.mmCalibrated),
      stage: b.stage || 'Stage I',
      confidence: roundN(b.confidence ?? 0.85, 4),
    }));

  const missingFdi = (findings.missingTeeth?.verified_missing || []).map((n) => Number(n));

  return {
    schema_version: HITL_SCHEMA_VERSION,
    document_id: report.reportId || `HITL-${Date.now()}`,
    created_at: report.timestamp || nowIso,
    updated_at: nowIso,
    hitl_status: 'verified_golden',
    annotator,
    source_model: 'Dental_008+Dental_015_HiTL',
    image_meta: {
      filename: meta.filename || 'panorama.png',
      width: w,
      height: h,
      sha256_hash: meta.sha256_hash || '',
      source_format: meta.source_format || 'PNG',
      pixel_spacing_mm: Array.isArray(meta.pixel_spacing_mm) ? meta.pixel_spacing_mm : null,
      is_calibrated: Boolean(meta.is_calibrated && Array.isArray(meta.pixel_spacing_mm)),
      midline_x: meta.midline_x != null ? Number(meta.midline_x) : null,
    },
    teeth,
    lesions,
    bone_loss: boneLoss,
    missing_fdi: missingFdi,
  };
}

export function hydrateReportFromHiTLGolden(golden, overrideSha256 = null) {
  const im = golden.image_meta || {};
  const w = Math.max(1, Number(im.width) || 2000);
  const h = Math.max(1, Number(im.height) || 1000);
  const effectiveHash = overrideSha256 || im.sha256_hash || '';

  const teeth = (golden.teeth || []).map((t) => {
    const nb = pxXyxyToNormBox(t.bbox_xyxy, w, h);
    const poly = Array.isArray(t.polygon_px)
      ? t.polygon_px.map((pt) => ({ x: roundN(clamp01(pt[0] / w), 6), y: roundN(clamp01(pt[1] / h), 6) }))
      : undefined;
    return {
      instanceId: t.instance_id,
      toothNumber: Number(t.fdi),
      x: nb.x,
      y: nb.y,
      w: nb.w,
      h: nb.h,
      polygon: poly,
      confidence: Number(t.confidence ?? 1.0),
      uncertain: Boolean(t.uncertain),
      isSupernumerary: Boolean(t.is_supernumerary || SUPERNUMERARY_FDI_SET.has(Number(t.fdi))),
      restorationTags: Array.isArray(t.restoration_tags) ? [...t.restoration_tags] : [],
      clinicianCorrected: Boolean(t.clinician_corrected),
      originalToothNumber: t.original_fdi != null ? Number(t.original_fdi) : undefined,
    };
  });

  const caries = [];
  const periapicalLesions = [];
  const restorations = [];

  (golden.lesions || []).forEach((l) => {
    const nb = pxXyxyToNormBox(l.bbox_xyxy, w, h);
    if (l.category === 'caries') {
      caries.push({
        instanceId: l.instance_id,
        ...nb,
        confidence: Number(l.confidence ?? 1.0),
        label: l.label || 'Dental Caries',
        toothNumber: l.fdi != null ? Number(l.fdi) : null,
        clinicalStatus: l.clinical_status || 'DEFINITE',
        clinicianCorrected: Boolean(l.clinician_corrected),
      });
    } else if (l.category === 'periapical') {
      periapicalLesions.push({
        instanceId: l.instance_id,
        ...nb,
        confidence: Number(l.confidence ?? 1.0),
        label: l.label || 'Periapical Lesion',
        toothNumber: l.fdi != null ? Number(l.fdi) : null,
        clinicalStatus: l.clinical_status || 'DEFINITE',
        rctAssociated: l.rct_associated ?? null,
        clinicianCorrected: Boolean(l.clinician_corrected),
      });
    } else if (l.category === 'restoration') {
      restorations.push({
        instanceId: l.instance_id,
        toothNumber: l.fdi != null ? Number(l.fdi) : null,
        type: l.label || 'Restoration',
        confidence: Number(l.confidence ?? 1.0),
        ...nb,
        clinicianCorrected: Boolean(l.clinician_corrected),
      });
    }
  });

  const boneLoss = (golden.bone_loss || []).map((b) => ({
    points: (b.polygon_px || []).map((pt) => ({
      x: roundN(clamp01(pt[0] / w), 6),
      y: roundN(clamp01(pt[1] / h), 6),
    })),
    confidence: Number(b.confidence ?? 0.85),
    label: 'Alveolar Bone Loss',
    toothNumber: Number(b.fdi),
    rblPercent: b.rbl_percent,
    lossMm: b.loss_mm,
    mmCalibrated: Boolean(b.mm_calibrated),
    stage: b.stage,
  }));

  return {
    reportId: golden.document_id || `HITL-${Date.now()}`,
    patientId: effectiveHash ? `ANON-${effectiveHash.slice(0, 12).toUpperCase()}` : 'ANON-HITL',
    timestamp: golden.updated_at || new Date().toISOString(),
    imageMetadata: {
      filename: im.filename || 'panorama.png',
      width: w,
      height: h,
      midline_x: im.midline_x ?? w / 2,
      sha256_hash: effectiveHash,
      source_format: im.source_format || 'PNG',
      pixel_spacing_mm: im.pixel_spacing_mm || null,
      is_calibrated: Boolean(im.is_calibrated),
      fdiStatus: 'FDI_ACTIVE',
    },
    findings: {
      teeth,
      supernumeraryTeeth: teeth.filter((t) => t.isSupernumerary),
      caries,
      periapicalLesions,
      restorations,
      boneLoss,
      missingTeeth: {
        verified_missing: Array.isArray(golden.missing_fdi) ? golden.missing_fdi.map(Number) : [],
        uncertain_missing: [],
        status: 'FDI_ACTIVE',
      },
    },
    summary: `HiTL 문서 로드 완료: 치아 ${teeth.length}개, 병변/수복 ${caries.length + periapicalLesions.length + restorations.length}건 (${golden.hitl_status || 'seed'}).`,
  };
}

export function addToothToReport(report, normBox, fdi = 11, restorationTags = []) {
  const prevTeeth = report.findings?.teeth || [];
  const nextTooth = {
    instanceId: `tooth-hitl-${Date.now()}`,
    toothNumber: Number(fdi),
    x: roundN(clamp01(normBox.x), 4),
    y: roundN(clamp01(normBox.y), 4),
    w: roundN(Math.max(0.008, clamp01(normBox.w)), 4),
    h: roundN(Math.max(0.015, clamp01(normBox.h)), 4),
    confidence: 1.0,
    uncertain: false,
    isSupernumerary: SUPERNUMERARY_FDI_SET.has(Number(fdi)),
    restorationTags: [...restorationTags],
    clinicianCorrected: true,
  };
  const nextTeeth = [...prevTeeth, nextTooth];
  return {
    ...report,
    findings: {
      ...report.findings,
      teeth: nextTeeth,
      supernumeraryTeeth: nextTeeth.filter((t) => t.isSupernumerary),
    },
  };
}

export function updateToothGeometryInReport(report, index, normBox) {
  const prevTeeth = report.findings?.teeth || [];
  if (index < 0 || index >= prevTeeth.length) return report;
  const nextTeeth = prevTeeth.map((t, idx) => {
    if (idx !== index) return t;
    const nx = roundN(clamp01(normBox.x), 4);
    const ny = roundN(clamp01(normBox.y), 4);
    const nw = roundN(Math.max(0.006, Math.min(1.0 - nx, normBox.w)), 4);
    const nh = roundN(Math.max(0.01, Math.min(1.0 - ny, normBox.h)), 4);
    // Shift polygon proportionally if present
    let nextPoly = undefined;
    if (Array.isArray(t.polygon) && t.w > 0 && t.h > 0) {
      nextPoly = t.polygon.map((pt) => ({
        x: roundN(clamp01(nx + ((pt.x - t.x) / t.w) * nw), 6),
        y: roundN(clamp01(ny + ((pt.y - t.y) / t.h) * nh), 6),
      }));
    }
    return {
      ...t,
      x: nx,
      y: ny,
      w: nw,
      h: nh,
      polygon: nextPoly,
      uncertain: false,
      clinicianCorrected: true,
    };
  });
  return {
    ...report,
    findings: {
      ...report.findings,
      teeth: nextTeeth,
      supernumeraryTeeth: nextTeeth.filter((t) => t.isSupernumerary),
    },
  };
}

export function deleteToothFromReport(report, index) {
  const prevTeeth = report.findings?.teeth || [];
  if (index < 0 || index >= prevTeeth.length) return report;
  const nextTeeth = prevTeeth.filter((_, idx) => idx !== index);
  return {
    ...report,
    findings: {
      ...report.findings,
      teeth: nextTeeth,
      supernumeraryTeeth: nextTeeth.filter((t) => t.isSupernumerary),
    },
  };
}

export function toggleToothRestorationTag(report, index, tag) {
  const prevTeeth = report.findings?.teeth || [];
  if (index < 0 || index >= prevTeeth.length) return report;
  const nextTeeth = prevTeeth.map((t, idx) => {
    if (idx !== index) return t;
    const curr = new Set(t.restorationTags || []);
    if (curr.has(tag)) curr.delete(tag);
    else curr.add(tag);
    return {
      ...t,
      restorationTags: [...curr],
      clinicianCorrected: true,
    };
  });
  return {
    ...report,
    findings: {
      ...report.findings,
      teeth: nextTeeth,
    },
  };
}

export function findContainingToothFdi(teeth, normBox) {
  const cx = normBox.x + normBox.w * 0.5;
  const cy = normBox.y + normBox.h * 0.5;
  let bestFdi = null;
  let bestOverlap = 0;
  for (const t of teeth || []) {
    const ix1 = Math.max(normBox.x, t.x);
    const iy1 = Math.max(normBox.y, t.y);
    const ix2 = Math.min(normBox.x + normBox.w, t.x + t.w);
    const iy2 = Math.min(normBox.y + normBox.h, t.y + t.h);
    if (ix2 > ix1 && iy2 > iy1) {
      const area = (ix2 - ix1) * (iy2 - iy1);
      if (area > bestOverlap) {
        bestOverlap = area;
        bestFdi = t.toothNumber;
      }
    } else if (bestOverlap === 0 && cx >= t.x && cx <= t.x + t.w && cy >= t.y && cy <= t.y + t.h) {
      bestFdi = t.toothNumber;
    }
  }
  return bestFdi;
}

export function addCariesBoxToReport(report, normBox, explicitFdi = null) {
  const teeth = report.findings?.teeth || [];
  const fdi = explicitFdi != null ? Number(explicitFdi) : findContainingToothFdi(teeth, normBox);
  const newItem = {
    instanceId: `caries-hitl-${Date.now()}`,
    x: roundN(clamp01(normBox.x), 4),
    y: roundN(clamp01(normBox.y), 4),
    w: roundN(Math.max(0.006, clamp01(normBox.w)), 4),
    h: roundN(Math.max(0.008, clamp01(normBox.h)), 4),
    confidence: 1.0,
    label: 'Dental Caries',
    toothNumber: fdi,
    fdi_label: fdi ? `FDI-${fdi}` : 'Unassigned',
    clinicalStatus: 'DEFINITE',
    clinicianCorrected: true,
  };
  return {
    ...report,
    findings: {
      ...report.findings,
      caries: [...(report.findings?.caries || []), newItem],
    },
  };
}

export function updateCariesBoxInReport(report, index, normBox, newFdi = undefined) {
  const prev = report.findings?.caries || [];
  if (index < 0 || index >= prev.length) return report;
  const teeth = report.findings?.teeth || [];
  const next = prev.map((c, idx) => {
    if (idx !== index) return c;
    const updatedBox = normBox
      ? {
          x: roundN(clamp01(normBox.x), 4),
          y: roundN(clamp01(normBox.y), 4),
          w: roundN(Math.max(0.005, Math.min(1.0 - clamp01(normBox.x), normBox.w)), 4),
          h: roundN(Math.max(0.006, Math.min(1.0 - clamp01(normBox.y), normBox.h)), 4),
        }
      : { x: c.x, y: c.y, w: c.w, h: c.h };
    const resolvedFdi =
      newFdi !== undefined
        ? newFdi
        : normBox
        ? findContainingToothFdi(teeth, updatedBox) ?? c.toothNumber
        : c.toothNumber;
    return {
      ...c,
      ...updatedBox,
      toothNumber: resolvedFdi ?? null,
      fdi_label: resolvedFdi ? `FDI-${resolvedFdi}` : 'Unassigned',
      uncertain_fdi: resolvedFdi == null,
      clinicalStatus: 'DEFINITE',
      clinicianCorrected: true,
    };
  });
  return {
    ...report,
    findings: {
      ...report.findings,
      caries: next,
    },
  };
}

export function deleteCariesBoxFromReport(report, index) {
  const prev = report.findings?.caries || [];
  if (index < 0 || index >= prev.length) return report;
  return {
    ...report,
    findings: {
      ...report.findings,
      caries: prev.filter((_, idx) => idx !== index),
    },
  };
}
