import { FinalReportResponse } from '../types/finalReport';

export const mockFinalReport: FinalReportResponse = {
  reportId: "REP-20260825-001",
  patientId: "PATIENT-78921",
  timestamp: "2026-08-25T10:30:00Z",
  imageMetadata: {
    filename: "sample_panoramic_001.png",
    width: 3000,
    height: 1500,
  },
  findings: {
    caries: [
      {
        x: 0.35,
        y: 0.52,
        w: 0.04,
        h: 0.06,
        confidence: 0.92,
        label: "Dental Caries",
        toothNumber: 16,
      },
      {
        x: 0.62,
        y: 0.48,
        w: 0.035,
        h: 0.05,
        confidence: 0.88,
        label: "Dental Caries",
        toothNumber: 26,
      },
    ],
    boneLoss: [
      {
        points: [
          { x: 0.32, y: 0.60 },
          { x: 0.38, y: 0.61 },
          { x: 0.37, y: 0.68 },
          { x: 0.31, y: 0.67 },
        ],
        confidence: 0.85,
        label: "Alveolar Bone Loss",
        toothNumber: 16,
      },
    ],
    periapicalLesions: [
      {
        x: 0.61,
        y: 0.58,
        w: 0.05,
        h: 0.07,
        confidence: 0.79,
        label: "Periapical Lesion",
        toothNumber: 26,
      },
    ],
    osteoporosisRisk: {
      score: 0.23,
      category: "LOW",
    },
  },
  summary: "치아 16, 26번 부위 우식증 및 치근단 병변 의심 소견. 전반적인 골다공증 위험도는 낮음(LOW).",
};
