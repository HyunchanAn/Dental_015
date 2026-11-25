// Standard Final Report & HiTL Contract Types for Dental_015 (aligned with dental_core.panorama_hitl.v1)

export interface ModuleExecutionStatusEntry {
  status: 'executed' | 'skipped' | 'unavailable' | string;
  reason?: string | null;
}

export interface ImageMetadata {
  width: number;
  height: number;
  filename: string;
  midline_x?: number | null;
  sha256_hash?: string;
  preprocessing_id?: string;
  fdiStatus?: string;
  source_format?: string;
  pixel_spacing_mm?: [number, number] | null;
  is_calibrated?: boolean;
  previewImageDataUrl?: string;
  moduleVersions?: Record<string, string>;
  moduleExecutionStatus?: Record<string, ModuleExecutionStatusEntry>;
}

export interface NormalizedBBox {
  instanceId?: string;
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
  clinicalStatus?: 'DEFINITE' | 'REVIEW_REQUIRED';
  isolatedAnatomicalSuspicion?: boolean;
  rctAssociated?: boolean | null;
  lesionSubtype?: string | null;
  clinicianCorrected?: boolean;
}

export interface NormalizedPolygon {
  points: Array<{ x: number; y: number }>; // Each x, y normalized 0.0 ~ 1.0
  confidence: number;
  label: string;
  toothNumber?: number | null;
  rblPercent?: number | null;
  lossMm?: number | null;
  mmCalibrated?: boolean;
  stage?: string | null;
  confidence_level?: 'HIGH' | 'SUSPECTED';
}

export interface DetectedTooth {
  instanceId?: string;
  toothNumber: number;
  x: number;
  y: number;
  w: number;
  h: number;
  polygon?: Array<{ x: number; y: number }>;
  confidence: number;
  uncertain?: boolean;
  isSupernumerary?: boolean;
  restorationTags?: string[];
  clinicianCorrected?: boolean;
  originalToothNumber?: number | null;
}

export interface RestorationItem {
  instanceId?: string;
  toothNumber?: number | null;
  type: string;
  rawClass?: string | null;
  confidence: number;
  x: number;
  y: number;
  w: number;
  h: number;
  clinicianCorrected?: boolean;
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
  implant_replaced?: number[];
  supernumerary_fdi?: number[];
  status?: string;
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
  restorationTags?: string[];
}

export interface ClinicalSynthesis {
  treatmentQueue: TreatmentQueueItem[];
  odontogram: Record<string, OdontogramToothStatus>;
}

export interface AgeEstimationFinding {
  predictedAge: number | null;
  confidenceInterval95?: [number, number] | null;
  status?: string;
  model?: string | null;
}

export interface ClinicalPatientMetadata {
  psiScore?: number | null; // 0 ~ 4
  bopPercent?: number | null; // 0 ~ 100
  plaqueIndex?: number | null; // 0 ~ 100
  smokingStatus?: 'never' | 'former' | 'current_light' | 'current_heavy' | '' | null;
  diabetesStatus?: 'none' | 'controlled' | 'uncontrolled' | '' | null;
  hba1cPercent?: number | null;
  ageYears?: number | null;
}

export interface PeriodontalRiskAssessment {
  assessmentStatus: 'COMPLETE' | 'INCOMPLETE_CLINICAL_DATA';
  missingClinicalFields: string[];
  warningMessage?: string | null;
  stage?: string | null;
  grade?: string | null;
  riskLevel?: 'LOW' | 'MODERATE' | 'HIGH' | null;
  visionEvidenceSummary?: string;
  recommendations?: string[];
  hallucinationGuardBlockedClaims?: string[];
}

export interface DiagnosticFindings {
  teeth?: DetectedTooth[];
  supernumeraryTeeth?: DetectedTooth[];
  caries?: NormalizedBBox[];
  boneLoss?: NormalizedPolygon[];
  periapicalLesions?: NormalizedBBox[];
  restorations?: RestorationItem[];
  impactedTeeth?: ImpactedToothItem[];
  missingTeeth?: MissingTeethAnalysis;
  osteoporosisRisk?: {
    score: number | null;
    category: 'LOW' | 'MODERATE' | 'HIGH' | null;
    status?: string;
    predictedClass?: string | null;
    probabilities?: Record<string, number> | null;
  };
  ageEstimation?: AgeEstimationFinding;
  periodontalRiskAssessment?: PeriodontalRiskAssessment;
  moduleExecutionStatus?: Record<string, ModuleExecutionStatusEntry>;
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

export interface PanoramaHiTLGoldenJson {
  schema_version: string;
  document_id: string;
  created_at: string;
  updated_at: string;
  hitl_status: 'seed' | 'in_review' | 'verified_golden' | string;
  annotator?: string | null;
  source_model: string;
  image_meta: {
    filename: string;
    width: number;
    height: number;
    sha256_hash: string;
    source_format: string;
    pixel_spacing_mm: [number, number] | null;
    is_calibrated: boolean;
    midline_x: number | null;
  };
  teeth: Array<{
    instance_id: string;
    fdi: number;
    bbox_xyxy: [number, number, number, number];
    polygon_px: Array<[number, number]>;
    confidence: number;
    uncertain: boolean;
    is_supernumerary: boolean;
    restoration_tags: string[];
    clinician_corrected: boolean;
    original_fdi: number | null;
  }>;
  lesions: Array<{
    instance_id: string;
    category: 'caries' | 'periapical' | 'restoration' | string;
    label: string;
    bbox_xyxy: [number, number, number, number];
    fdi: number | null;
    confidence: number;
    clinical_status: string;
    rct_associated?: boolean | null;
    clinician_corrected: boolean;
  }>;
  bone_loss: Array<{
    fdi: number;
    polygon_px: Array<[number, number]>;
    rbl_percent: number;
    loss_mm: number | null;
    mm_calibrated: boolean;
    stage: string;
    confidence: number;
  }>;
  missing_fdi: number[];
}
