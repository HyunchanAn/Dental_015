// Standard Final Report Response Schema for Dental MSA (SSOT alignment)

export interface ImageMetadata {
  width: number;
  height: number;
  filename: string;
  midline_x?: number;
  sha256_hash?: string;
  preprocessing_id?: string;
}

export interface NormalizedBBox {
  // Coordinates normalized from 0.0 to 1.0
  x: number; // top-left x
  y: number; // top-left y
  w: number; // width
  h: number; // height
  confidence: number;
  label: string;
  toothNumber?: number | null; // FDI dental notation (e.g. 11, 21, 46)
  fdi_label?: string;
  relative_label?: string;
  uncertain_fdi?: boolean;
  confidence_level?: 'HIGH' | 'SUSPECTED';
}

export interface NormalizedPolygon {
  points: Array<{ x: number; y: number }>; // Each x, y normalized 0.0 ~ 1.0
  confidence: number;
  label: string;
  toothNumber?: number | null;
  confidence_level?: 'HIGH' | 'SUSPECTED';
}

export interface DetectedTooth {
  toothNumber: number;
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  uncertain?: boolean;
}

export interface RestorationItem {
  toothNumber?: number | null;
  type: string;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ImpactedToothItem {
  toothNumber: number;
  wintersClass: string;
  eruptionStatus: string;
  angleDiff: number;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MissingTeethAnalysis {
  verified_missing: number[];
  uncertain_missing: number[];
  details?: Array<{
    fdi: number;
    status: string;
    r_gap?: number;
    reason?: string;
  }>;
}

export interface TreatmentQueueItem {
  priority: 'EMERGENT' | 'HIGH' | 'MODERATE' | 'PREVENTIVE';
  fdi?: number | null;
  condition: string;
  recommendation: string;
}

export interface OdontogramToothStatus {
  status: 'Sound' | 'Caries' | 'Periapical' | 'BoneLoss' | 'Missing' | 'Suspected' | 'Restored' | 'Impacted';
  label: string;
  details?: string;
}

export interface ClinicalSynthesis {
  treatmentQueue: TreatmentQueueItem[];
  odontogram: Record<string, OdontogramToothStatus>;
}

export interface DiagnosticFindings {
  teeth?: DetectedTooth[];
  caries?: NormalizedBBox[];
  boneLoss?: NormalizedPolygon[];
  periapicalLesions?: NormalizedBBox[];
  restorations?: RestorationItem[];
  impactedTeeth?: ImpactedToothItem[];
  missingTeeth?: MissingTeethAnalysis;
  osteoporosisRisk?: {
    score: number;
    category: 'LOW' | 'MODERATE' | 'HIGH';
    status?: string;
  };
  clinicalSynthesis?: ClinicalSynthesis;
}

export interface FinalReportResponse {
  reportId: string;
  patientId: string;
  timestamp: string;
  imageMetadata: ImageMetadata;
  findings: DiagnosticFindings;
  summary: string;
}
