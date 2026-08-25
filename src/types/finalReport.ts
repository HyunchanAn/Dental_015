// Standard Final Report Response Schema for Dental MSA (SSOT alignment)

export interface ImageMetadata {
  width: number;
  height: number;
  filename: string;
}

export interface NormalizedBBox {
  // Coordinates normalized from 0.0 to 1.0
  x: number; // top-left x
  y: number; // top-left y
  w: number; // width
  h: number; // height
  confidence: number;
  label: string;
  toothNumber?: number; // FDI dental notation (e.g. 11, 21, 46)
}

export interface NormalizedPolygon {
  points: Array<{ x: number; y: number }>; // Each x, y normalized 0.0 ~ 1.0
  confidence: number;
  label: string;
  toothNumber?: number;
}

export interface DiagnosticFindings {
  caries?: NormalizedBBox[];
  boneLoss?: NormalizedPolygon[];
  periapicalLesions?: NormalizedBBox[];
  cystsAndTumors?: NormalizedBBox[];
  osteoporosisRisk?: {
    score: number;
    category: 'LOW' | 'MODERATE' | 'HIGH';
  };
}

export interface FinalReportResponse {
  reportId: string;
  patientId: string;
  timestamp: string;
  imageMetadata: ImageMetadata;
  findings: DiagnosticFindings;
  summary: string;
}
