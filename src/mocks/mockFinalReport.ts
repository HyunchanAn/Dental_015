import { FinalReportResponse } from '../types/finalReport';

// Realistically calibrated mock report aligning with sample_panorama.png anatomy
export const mockFinalReport: FinalReportResponse = {
  reportId: "REP-20260825-001",
  patientId: "PATIENT-78921",
  timestamp: "2026-08-25T10:30:00Z",
  imageMetadata: {
    filename: "sample_panorama.png",
    width: 2872,
    height: 1504,
    midline_x: 1436.0,
  },
  findings: {
    caries: [
      {
        x: 0.373,
        y: 0.468,
        w: 0.028,
        h: 0.050,
        confidence: 0.92,
        label: "Dental Caries",
        toothNumber: 14, // Anatomically calibrated to #14 crown center in sample_panorama.png
        fdi_label: "FDI-14",
      },
      {
        x: 0.615,
        y: 0.448,
        w: 0.033,
        h: 0.052,
        confidence: 0.88,
        label: "Dental Caries",
        toothNumber: 24, // Anatomically calibrated to #24 crown center (distal to #23 canine)
        fdi_label: "FDI-24",
      },
    ],
    boneLoss: [
      {
        points: [
          { x: 0.315, y: 0.585 },
          { x: 0.342, y: 0.595 },
          { x: 0.338, y: 0.665 },
          { x: 0.308, y: 0.655 },
        ],
        confidence: 0.85,
        label: "Alveolar Bone Loss",
        toothNumber: 47, // Calibrated to existing mesially tilted #47 2nd molar angular bone loss
      },
    ],
    periapicalLesions: [
      {
        x: 0.605,
        y: 0.575,
        w: 0.05,
        h: 0.075,
        confidence: 0.79,
        label: "Periapical Lesion",
        toothNumber: 34, // FDI-34 (Lower Left 1st Premolar apex)
        fdi_label: "FDI-34",
      },
    ],
    missingTeeth: {
      verified_missing: [45, 46],
      uncertain_missing: [],
      details: [
        {
          fdi: 46,
          status: "VERIFIED_MISSING",
          reason: "Edentulous space confirmed between #44 and mesially tilted #47",
        },
        {
          fdi: 45,
          status: "VERIFIED_MISSING",
          reason: "Edentulous space confirmed between #44 and mesially tilted #47",
        },
      ],
    },
    osteoporosisRisk: {
      score: 0.23,
      category: "LOW",
      status: "MOCK_SCREENING",
    },
    clinicalSynthesis: {
      treatmentQueue: [
        {
          priority: "EMERGENT",
          fdi: 34,
          condition: "Periapical Lesion",
          recommendation: "FDI #34 치근단 병소: 정밀 방사선 및 근관 치료(Endodontics) 우선 고려 요망.",
        },
        {
          priority: "HIGH",
          fdi: 14,
          condition: "Dental Caries",
          recommendation: "FDI #14 치아 우식증: 와동 형성 및 보철/수복(Restoration) 치료 권고.",
        },
        {
          priority: "HIGH",
          fdi: 24,
          condition: "Dental Caries",
          recommendation: "FDI #24 치아 우식증: 와동 형성 및 보철/수복(Restoration) 치료 권고.",
        },
        {
          priority: "MODERATE",
          fdi: 46,
          condition: "Missing Tooth",
          recommendation: "FDI #46 결손치: 무치악 공간 보철 수복(임플란트/브릿지) 계획 수립 권고.",
        },
        {
          priority: "MODERATE",
          fdi: 47,
          condition: "Alveolar Bone Loss",
          recommendation: "FDI #47 근심 치조골 흡수: 치주낭 계측 및 치근활택술/치주 치료 권고.",
        },
        {
          priority: "PREVENTIVE",
          fdi: null,
          condition: "General Periodontal Care",
          recommendation: "정기 치주 스케일링 및 6개월 단위 임상 파노라마 추적 관찰 추천.",
        },
      ],
      odontogram: {
        "14": { status: "Caries", label: "Caries" },
        "24": { status: "Caries", label: "Caries" },
        "34": { status: "Periapical", label: "Periapical" },
        "45": { status: "Missing", label: "Missing" },
        "46": { status: "Missing", label: "Missing" },
        "47": { status: "BoneLoss", label: "BoneLoss" },
      },
    },
  },
  summary: "상악 소구치(#14, #24) 우식 의심 소견. 하악 좌측 제1소구치(#34) 치근단 병소, 하악 우측 결손치(#45, #46) 및 잔존 제2대구치(#47) 근심 치조골 흡수 관찰.",
};
