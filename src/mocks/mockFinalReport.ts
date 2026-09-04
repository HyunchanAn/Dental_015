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
        x: 0.355,
        y: 0.53,
        w: 0.04,
        h: 0.06,
        confidence: 0.92,
        label: "Dental Caries",
        toothNumber: 14, // Corrected from 16 to 14 (Upper Right 1st Premolar)
        fdi_label: "FDI-14",
      },
      {
        x: 0.615,
        y: 0.50,
        w: 0.038,
        h: 0.05,
        confidence: 0.88,
        label: "Dental Caries",
        toothNumber: 24, // Corrected from 26 to 24 (Upper Left 1st Premolar)
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
    },
  },
  summary: "상악 소구치(#14, #24) 우식 의심 소견. 하악 좌측 제1소구치(#34) 치근단 병소 및 하악 우측(#46) 치조골 흡수 관찰.",
};
