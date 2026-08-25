export interface AnalysisTask {
  id: string;
  patientId: string;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
  modules: string[]; // e.g., ['Dental_001', 'Dental_002', 'Dental_003']
  createdAt: string;
}

export interface DiagnosticResult {
  taskId: string;
  cariesDetected: boolean;
  boneLossMm?: number;
  cystOrTumorDetected?: boolean;
  osteoporosisRisk?: string;
  summary: string;
}
