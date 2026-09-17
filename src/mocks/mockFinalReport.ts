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
        x: 0.368,
        y: 0.470,
        w: 0.033,
        h: 0.055,
        confidence: 0.92,
        label: "Dental Caries",
        toothNumber: 14, // Anatomically calibrated to #14 crown in sample_panorama.png
        fdi_label: "FDI-14",
      },
      {
        x: 0.589,
        y: 0.470,
        w: 0.033,
        h: 0.058,
        confidence: 0.88,
        label: "Dental Caries",
        toothNumber: 24, // Anatomically calibrated to #24 crown in sample_panorama.png
        fdi_label: "FDI-24",
      },
    ],
    boneLoss: [
      {
        points: [
          { x: 0.32, y: 0.62 },
          { x: 0.38, y: 0.63 },
          { x: 0.37, y: 0.70 },
          { x: 0.31, y: 0.69 },
        ],
        confidence: 0.85,
        label: "Alveolar Bone Loss",
        toothNumber: 46, // Corrected from 16 to 46 (Lower Right 1st Molar crest)
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
        toothNumber: 34, // Corrected from 26 to 34 (Lower Left 1st Premolar apex)
        fdi_label: "FDI-34",
      },
    ],
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
          condition: "Alveolar Bone Loss",
          recommendation: "FDI #46 치조골 흡수: 치주낭 계측 및 치근활택술/치주치료 권고.",
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
        "46": { status: "BoneLoss", label: "BoneLoss" },
      },
    },
  },
  summary: "상악 소구치(#14, #24) 우식 의심 소견. 하악 좌측 제1소구치(#34) 치근단 병소 및 하악 우측(#46) 치조골 흡수 관찰.",
};
