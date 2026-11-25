import React, { useState, useEffect } from 'react';
import {
  Activity,
  Stethoscope,
  Layers,
  CheckCircle2,
  ShieldAlert,
  Upload,
  Loader2,
  AlertCircle,
  Eye,
  EyeOff,
  Info,
  Cpu,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  RotateCcw,
  Edit3,
  Download,
  Save,
  PlusSquare,
  Trash2,
  MousePointer,
  FileJson,
} from 'lucide-react';
import {
  PanoramaCanvasViewer,
  HiTLToolMode,
  SelectedHiTLTarget,
} from './components/PanoramaCanvasViewer';
import { mockFinalReport } from './mocks/mockFinalReport';
import { checkHealth, inferPanorama, saveHiTLGoldenToServer } from './api/client';
import {
  ClinicalPatientMetadata,
  FinalReportResponse,
  PanoramaHiTLGoldenJson,
} from './types/finalReport';
import {
  ALL_Selectable_FDI,
  RESTORATION_TAG_OPTIONS,
  SUPERNUMERARY_FDI_SET,
  SimpleNormBox,
  addCariesBoxToReport,
  addToothToReport,
  deleteCariesBoxFromReport,
  deleteToothFromReport,
  hydrateReportFromHiTLGolden,
  serializeReportToHiTLGolden,
  toggleToothRestorationTag,
  updateCariesBoxInReport,
  updateToothGeometryInReport,
} from './utils/hitlLogic';

interface ModuleStatusItem {
  id: string;
  name: string;
  type: string;
  status: 'ONLINE' | 'OFFLINE' | 'STANDBY' | string;
  weights: string;
  version: string;
}

const emptyReport: FinalReportResponse = {
  reportId: '',
  patientId: '',
  timestamp: '',
  imageMetadata: { filename: '', width: 0, height: 0 },
  findings: {},
  summary: '',
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis'>('analysis');
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [isGpuAvailable, setIsGpuAvailable] = useState<boolean>(false);
  const [vramFree, setVramFree] = useState<number>(0);
  const [modulesList, setModulesList] = useState<ModuleStatusItem[]>([
    { id: 'Dental_008', name: '치아 식별 및 FDI 분할', type: 'YOLOv8 Seg', status: 'OFFLINE', weights: 'yolov8m_best.pt', version: 'Tooth Cls' },
    { id: 'Dental_002', name: '치아 우식증 (2-Stage)', type: 'YOLO Patch', status: 'OFFLINE', weights: 'best_refined.onnx', version: 'Precision 83%' },
    { id: 'Dental_012', name: '치근단 병소 (음성증강)', type: 'YOLO11s', status: 'OFFLINE', weights: 'best.onnx', version: 'mAP 73.7%' },
    { id: 'Dental_010', name: '결손치 식별 및 갭', type: 'Heuristic', status: 'OFFLINE', weights: 'Rule-based', version: 'Dynamic Mid' },
    { id: 'Dental_003', name: '치조골 소실 계측', type: 'Masking', status: 'OFFLINE', weights: 'Core', version: 'v1.0' },
    { id: 'Dental_009', name: '매복치 난이도 분석', type: 'Winter Cls', status: 'OFFLINE', weights: 'Geometry', version: 'v1.0' },
    { id: 'Dental_013', name: '치과 수복물 분류', type: 'EfficientNet/YOLO', status: 'OFFLINE', weights: 'best_restoration_model.onnx', version: 'v1.0' },
    { id: 'Dental_014', name: '골다공증 위험 스크리닝', type: 'OsteoMAENet', status: 'OFFLINE', weights: 'best.pt', version: 'v1.0 (MCW)' },
    { id: 'Dental_011', name: '치아 연령 추정', type: 'ResNet50 Reg', status: 'OFFLINE', weights: 'best_hybrid_age_model.onnx', version: 'v1.0 (MAE 2.13y)' },
  ]);

  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileHash, setUploadedFileHash] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<FinalReportResponse>(emptyReport);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [editingToothIndex, setEditingToothIndex] = useState<number | null>(null);
  const [showSuspected, setShowSuspected] = useState<boolean>(false);

  // HiTL Canvas Interactive Editing State (Dental_015#3, Dental_013#3, Dental_002#9)
  const [hitlEditMode, setHitlEditMode] = useState<boolean>(false);
  const [hitlTool, setHitlTool] = useState<HiTLToolMode>('select');
  const [selectedTarget, setSelectedTarget] = useState<SelectedHiTLTarget | null>(null);
  const [newToothDefaultFdi, setNewToothDefaultFdi] = useState<number>(11);

  // Optional Periodontal Clinical Metadata State (Dental_Panoramic_Reader#20)
  const [showClinicalForm, setShowClinicalForm] = useState<boolean>(false);
  const [clinicalMeta, setClinicalMeta] = useState<ClinicalPatientMetadata>({
    psiScore: null,
    bopPercent: null,
    plaqueIndex: null,
    smokingStatus: '',
    diabetesStatus: '',
    hba1cPercent: null,
    ageYears: null,
  });

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await checkHealth();
        setBackendStatus(res.status);
        setIsGpuAvailable(res.gpu_available);
        setVramFree(res.vram_free_gb || 0);
        if (res.modules && Array.isArray(res.modules)) {
          setModulesList(res.modules);
        }
      } catch {
        setBackendStatus('Disconnected');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard shortcut for deleting selected HiTL box
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!hitlEditMode || !selectedTarget) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedTarget.kind === 'tooth') {
          setReportData((prev) => deleteToothFromReport(prev, selectedTarget.index));
        } else {
          setReportData((prev) => deleteCariesBoxFromReport(prev, selectedTarget.index));
        }
        setSelectedTarget(null);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [hitlEditMode, selectedTarget]);

  const computeFileSha256 = async (file: File): Promise<string> => {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setIsDemoMode(false);
      setEditingToothIndex(null);
      setSelectedTarget(null);
      const isDicomFile = /\.(dcm|dicom)$/i.test(file.name);
      if (isDicomFile) {
        setImagePreview(null);
        setStatusNotice('DICOM 파일이 선택되었습니다. [Analyze] 실행 시 서버에서 PHI 제거 후 프리뷰 이미지를 반환합니다.');
      } else {
        const objectUrl = URL.createObjectURL(file);
        setImagePreview(objectUrl);
        setStatusNotice(null);
      }
      setErrorMessage(null);
      try {
        const sha256 = await computeFileSha256(file);
        setUploadedFileHash(sha256);
      } catch (err) {
        console.error('Failed to compute SHA-256 of uploaded file:', err);
        setUploadedFileHash(null);
      }
    }
  };

  const handleImportSeedJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const jsonFile = e.target.files[0];
    try {
      const text = await jsonFile.text();
      const parsed = JSON.parse(text);
      if (parsed.schema_version && parsed.image_meta) {
        const hydrated = hydrateReportFromHiTLGolden(parsed as PanoramaHiTLGoldenJson);
        setReportData(hydrated);
        setHitlEditMode(true);
        setErrorMessage(null);
        setStatusNotice(`HiTL JSON (${parsed.document_id}) 로드 완료: 치아 ${hydrated.findings.teeth?.length || 0}개`);
      } else if (parsed.reportId && parsed.findings) {
        setReportData(parsed as FinalReportResponse);
        setHitlEditMode(true);
        setErrorMessage(null);
        setStatusNotice(`SSOT 리포트 JSON (${parsed.reportId}) 로드 완료`);
      } else {
        setErrorMessage('지원되지 않는 JSON 규격입니다. Dental_Core HiTL JSON 또는 SSOT 리포트 JSON을 선택하세요.');
      }
    } catch {
      setErrorMessage('JSON 파일 파싱에 실패했습니다.');
    }
    e.target.value = '';
  };

  const handleExportGoldenJson = () => {
    if (!reportData.imageMetadata.width || !reportData.imageMetadata.height) {
      setErrorMessage('내보낼 파노라마 메타데이터가 없습니다.');
      return;
    }
    const golden = serializeReportToHiTLGolden(reportData, 'clinician_015');
    const blob = new Blob([JSON.stringify(golden, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const baseName = (reportData.imageMetadata.filename || 'panorama').replace(/\.[^.]+$/, '');
    a.href = url;
    a.download = `${baseName}.hitl_golden.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusNotice(`골든 JSON 다운로드 완료: ${baseName}.hitl_golden.json (${golden.teeth.length}개 치아)`);
  };

  const handleSaveGoldenToServer = async () => {
    if (!reportData.imageMetadata.width || !reportData.imageMetadata.height) {
      setErrorMessage('저장할 파노라마 메타데이터가 없습니다.');
      return;
    }
    try {
      const golden = serializeReportToHiTLGolden(reportData, 'clinician_015');
      const res = await saveHiTLGoldenToServer(golden);
      setErrorMessage(null);
      setStatusNotice(`서버 Dental_000 HiTL 저장 완료: ${res.saved_path}`);
    } catch {
      setErrorMessage('서버 HiTL 저장 API 호출에 실패했습니다. [골든 JSON 다운로드] 버튼으로 로컬 저장할 수 있습니다.');
    }
  };

  const handleLoadDemo = () => {
    setSelectedFile(null);
    setUploadedFileHash(mockFinalReport.imageMetadata.sha256_hash || null);
    setImagePreview('/sample_panorama.png');
    setReportData(structuredClone(mockFinalReport));
    setIsDemoMode(true);
    setEditingToothIndex(null);
    setSelectedTarget(null);
    setErrorMessage(null);
    setStatusNotice(null);
  };

  const handleClearReport = () => {
    setSelectedFile(null);
    setUploadedFileHash(null);
    setImagePreview(null);
    setReportData(emptyReport);
    setIsDemoMode(false);
    setHitlEditMode(false);
    setEditingToothIndex(null);
    setSelectedTarget(null);
    setErrorMessage(null);
    setStatusNotice(null);
  };

  const handleRunInference = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);
    setStatusNotice(null);
    setIsDemoMode(false);
    setEditingToothIndex(null);
    setSelectedTarget(null);

    try {
      const result = await inferPanorama(selectedFile, false, clinicalMeta);
      setReportData(result);
      if (result.imageMetadata?.previewImageDataUrl) {
        setImagePreview(result.imageMetadata.previewImageDataUrl);
      }
    } catch (err) {
      console.warn('API Call failed:', err);
      setErrorMessage('백엔드 AI 추론 호출에 실패했습니다. (게이트웨이 연결, API 토큰 및 모델 가동 상태를 확인하세요)');
      setReportData(emptyReport);
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualFdiChange = (toothIndex: number, newFdi: number) => {
    setReportData((prev) => {
      if (!prev.findings.teeth || !prev.findings.teeth[toothIndex]) {
        return prev;
      }
      const nextTeeth = prev.findings.teeth.map((t, idx) => {
        if (idx !== toothIndex) return t;
        const isSuper = SUPERNUMERARY_FDI_SET.has(newFdi);
        return {
          ...t,
          originalToothNumber: t.originalToothNumber ?? t.toothNumber,
          toothNumber: newFdi,
          isSupernumerary: isSuper,
          uncertain: false,
          clinicianCorrected: true,
        };
      });
      return {
        ...prev,
        findings: {
          ...prev.findings,
          teeth: nextTeeth,
          supernumeraryTeeth: nextTeeth.filter((t) => t.isSupernumerary),
        },
      };
    });
    setEditingToothIndex(null);
  };

  const handleDrawNewBox = (kind: 'tooth' | 'caries', normBox: SimpleNormBox) => {
    if (kind === 'tooth') {
      setReportData((prev) => {
        const updated = addToothToReport(prev, normBox, newToothDefaultFdi, []);
        const newIdx = (updated.findings.teeth?.length || 1) - 1;
        setSelectedTarget({ kind: 'tooth', index: newIdx });
        return updated;
      });
    } else {
      setReportData((prev) => {
        const updated = addCariesBoxToReport(prev, normBox, null);
        const newIdx = (updated.findings.caries?.length || 1) - 1;
        setSelectedTarget({ kind: 'caries', index: newIdx });
        return updated;
      });
    }
    setHitlTool('select');
  };

  const handleDeleteSelectedTarget = () => {
    if (!selectedTarget) return;
    if (selectedTarget.kind === 'tooth') {
      setReportData((prev) => deleteToothFromReport(prev, selectedTarget.index));
    } else {
      setReportData((prev) => deleteCariesBoxFromReport(prev, selectedTarget.index));
    }
    setSelectedTarget(null);
  };

  const reportSha256 = reportData.imageMetadata.sha256_hash?.toLowerCase();
  const isShaMismatchBlocked =
    !isDemoMode &&
    Boolean(reportData.reportId) &&
    Boolean(uploadedFileHash && reportSha256 && uploadedFileHash.toLowerCase() !== reportSha256);

  const cariesCount = reportData.findings.caries?.length || 0;
  const periapicalCount = reportData.findings.periapicalLesions?.length || 0;
  const boneLossCount = reportData.findings.boneLoss?.length || 0;
  const verifiedMissing = reportData.findings.missingTeeth?.verified_missing || [];
  const detectedTeeth = reportData.findings.teeth || [];
  const cariesList = reportData.findings.caries || [];
  const uncertainTeeth = detectedTeeth
    .map((tooth, index) => ({ tooth, index }))
    .filter(({ tooth }) => Boolean(tooth.uncertain));

  const upperRightTeeth = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeftTeeth = [21, 22, 23, 24, 25, 26, 27, 28];
  const lowerRightTeeth = [48, 47, 46, 45, 44, 43, 42, 41];
  const lowerLeftTeeth = [31, 32, 33, 34, 35, 36, 37, 38];

  const getToothStatus = (fdi: number) => {
    const toothObj = detectedTeeth.find((t) => t.toothNumber === fdi);
    const hasToothRestTag = Boolean(toothObj?.restorationTags && toothObj.restorationTags.length > 0);
    const synthesisStatus = reportData.findings.clinicalSynthesis?.odontogram?.[String(fdi)];
    if (synthesisStatus && !hasToothRestTag) {
      switch (synthesisStatus.status) {
        case 'Missing':
          return { label: 'Missing', color: 'bg-slate-800 text-slate-500 border-slate-700' };
        case 'Periapical':
          return { label: 'Periapical', color: 'bg-purple-950/60 text-purple-400 border-purple-800' };
        case 'Caries':
          return { label: 'Caries', color: 'bg-rose-950/60 text-rose-400 border-rose-800' };
        case 'Suspected':
          return { label: 'Suspected', color: 'bg-amber-950/60 text-amber-400 border-amber-800' };
        case 'BoneLoss':
          return { label: 'BoneLoss', color: 'bg-sky-950/60 text-sky-400 border-sky-800' };
        case 'Restored':
          return { label: 'Restored', color: 'bg-teal-950/60 text-teal-300 border-teal-700' };
        case 'Impacted':
          return { label: 'Impacted', color: 'bg-orange-950/60 text-orange-300 border-orange-700' };
        default:
          return { label: 'Sound', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' };
      }
    }

    const isMissing = verifiedMissing.includes(fdi);
    const hasPeriapical = reportData.findings.periapicalLesions?.some((p) => p.toothNumber === fdi);
    const cariesItem = reportData.findings.caries?.find((c) => c.toothNumber === fdi);
    const hasBoneLoss = reportData.findings.boneLoss?.some((b) => b.toothNumber === fdi);
    const hasRest = hasToothRestTag || reportData.findings.restorations?.some((r) => r.toothNumber === fdi);
    const isImpacted = reportData.findings.impactedTeeth?.some((imp) => imp.toothNumber === fdi);

    if (isMissing) return { label: 'Missing', color: 'bg-slate-800 text-slate-500 border-slate-700' };
    if (hasPeriapical) return { label: 'Periapical', color: 'bg-purple-950/60 text-purple-400 border-purple-800' };
    if (cariesItem) {
      return cariesItem.confidence >= 0.45
        ? { label: 'Caries', color: 'bg-rose-950/60 text-rose-400 border-rose-800' }
        : { label: 'Suspected', color: 'bg-amber-950/60 text-amber-400 border-amber-800' };
    }
    if (isImpacted) return { label: 'Impacted', color: 'bg-orange-950/60 text-orange-300 border-orange-700' };
    if (hasRest) return { label: 'Restored', color: 'bg-teal-950/60 text-teal-300 border-teal-700' };
    if (hasBoneLoss) return { label: 'BoneLoss', color: 'bg-sky-950/60 text-sky-400 border-sky-800' };
    return { label: 'Sound', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' };
  };

  const selectedToothObj =
    selectedTarget?.kind === 'tooth' ? detectedTeeth[selectedTarget.index] || null : null;
  const selectedCariesObj =
    selectedTarget?.kind === 'caries' ? cariesList[selectedTarget.index] || null : null;
  const perioRisk = reportData.findings.periodontalRiskAssessment;

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-12">
      {/* Top Header */}
      <header className="border-b border-slate-800 bg-slate-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-sky-600 rounded-lg text-white">
            <Stethoscope className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Dental_015 UI</h1>
            <p className="text-xs text-slate-400">Clinical AI & HiTL Annotation Web Platform</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-xs">
          {isDemoMode && (
            <span className="inline-flex items-center px-3 py-1 rounded-full font-bold bg-amber-500/20 text-amber-300 border-2 border-amber-500/60">
              DEMO DATA MODE
            </span>
          )}
          <div className="flex items-center space-x-2 text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>GPU: {isGpuAvailable ? 'RTX 4060 Laptop' : 'CPU Mode'}</span>
            <span className="text-slate-600">|</span>
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>VRAM Free: {vramFree} GB</span>
          </div>
          <span
            className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${
              backendStatus === 'HEALTHY'
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            }`}
          >
            Gateway: {backendStatus}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar */}
        <aside className="w-72 bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            <div className="space-y-1">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">
                Workspace
              </div>
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'dashboard'
                    ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Activity className="w-4 h-4" />
                <span>Clinical Dashboard</span>
              </button>
              <button
                onClick={() => setActiveTab('analysis')}
                className={`w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  activeTab === 'analysis'
                    ? 'bg-sky-600/20 text-sky-400 border border-sky-500/30'
                    : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                }`}
              >
                <Layers className="w-4 h-4" />
                <span>Panoramic Analysis & HiTL</span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between px-3">
                <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  AI Modules Status
                </span>
                <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20 font-mono">
                  {modulesList.filter((m) => m.status === 'ONLINE').length}/{modulesList.length} ACTIVE
                </span>
              </div>

              <div className="space-y-1.5">
                {modulesList.map((m) => {
                  const isOnline = m.status === 'ONLINE';
                  const isStandby = m.status.startsWith('STANDBY');
                  return (
                    <div
                      key={m.id}
                      className="p-2.5 bg-slate-900/80 hover:bg-slate-900 rounded-lg border border-slate-800/80 transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <span className="text-xs font-semibold text-slate-200">{m.id}</span>
                        <span
                          className={`inline-flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                            isOnline
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : isStandby
                              ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          <span
                            className={`w-1.5 h-1.5 rounded-full ${
                              isOnline ? 'bg-emerald-400 animate-pulse' : isStandby ? 'bg-amber-400' : 'bg-rose-400'
                            }`}
                          />
                          <span>{m.status}</span>
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-300 font-medium truncate">{m.name}</div>
                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                        <span className="truncate max-w-[120px] font-mono">{m.weights}</span>
                        <span>{m.version}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1 mt-4">
            <div className="font-semibold text-slate-300 flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>Dental_Core HiTL Contract v1</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              008 초벌 추론 오버레이 교정 후 학습용 골든 JSON(`dental_core.panorama_hitl.v1`)으로 즉시 내보낼 수 있습니다.
            </p>
          </div>
        </aside>

        {/* Workspace Main Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {isDemoMode && (
              <div className="flex items-center justify-between p-4 bg-amber-500/15 border-2 border-amber-500 rounded-xl text-amber-200 text-xs shadow-lg shadow-amber-950/30">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <div>
                    <div className="font-bold text-amber-300 text-sm tracking-wide">
                      DEMO DATA — 실제 환자 판독 결과가 아닌 데모 화면입니다
                    </div>
                    <p className="text-slate-300 text-xs mt-0.5">
                      현재 화면의 영상(`sample_panorama.png`, 출처: DENTEX CC BY-NC-SA 4.0) 및 진단 리포트(`mockFinalReport`)는 기능 시연용 고정 샘플입니다.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearReport}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 font-semibold text-xs whitespace-nowrap transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>데모 리포트 초기화</span>
                </button>
              </div>
            )}

            {isShaMismatchBlocked && (
              <div className="flex items-center justify-between p-4 bg-rose-950/60 border-2 border-rose-500 rounded-xl text-rose-200 text-xs shadow-lg shadow-rose-950/40">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                  <div>
                    <div className="font-bold text-rose-300 text-sm">
                      SHA-256 해시 불일치 감지 — 추론 완료 전까지 오버레이 렌더링이 차단되었습니다
                    </div>
                    <p className="text-slate-300 text-xs mt-0.5 font-mono">
                      업로드 파일 SHA-256 ({uploadedFileHash?.slice(0, 12)}...) != 기존 리포트 SHA-256 ({reportSha256?.slice(0, 12)}...)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] whitespace-nowrap">
                  OVERLAY BLOCKED
                </span>
              </div>
            )}

            {/* Missing Clinical Data Gate Banner (Dental_Panoramic_Reader#20) */}
            {perioRisk && perioRisk.assessmentStatus === 'INCOMPLETE_CLINICAL_DATA' && (
              <div className="p-4 bg-amber-950/40 border border-amber-500/60 rounded-xl text-amber-200 text-xs space-y-1">
                <div className="font-bold text-amber-300 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                  <span>[누락 임상 데이터 경고 게이트] 파노라마 단독 입력으로 인해 확정 치주 위험도 등급 판정이 보류되었습니다</span>
                </div>
                <p className="text-slate-300">
                  {perioRisk.warningMessage ||
                    `치주 예방·치료계획 확정을 위해 누락된 임상 항목(${perioRisk.missingClinicalFields.join(', ')}) 확인이 필요합니다.`}
                </p>
              </div>
            )}

            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold text-white flex items-center space-x-2">
                      <Activity className="w-5 h-5 text-sky-400" />
                      <span>Clinical Multi-Module Synthesis Dashboard</span>
                    </h2>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-medium">
                      Multi-modal Ensemble Active
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    008(치아분할), 013(수복물), 002(우식), 012(치근단), 003(골소실), 010(결손치) 분석 결과를 통합하여 치아 단위의 진단 지형도 및 치료 우선순위를 산출합니다.
                  </p>
                </div>

                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">치아 우식증 (002)</span>
                    <div className="text-2xl font-bold text-rose-400">{cariesCount}건</div>
                    <span className="text-[10px] text-slate-500">2-Stage 정밀 패치 검출</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">치근단 병소 (012)</span>
                    <div className="text-2xl font-bold text-purple-400">{periapicalCount}건</div>
                    <span className="text-[10px] text-slate-500">치근단·RCT 연계 매칭</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">치조골 소실 부위 (003)</span>
                    <div className="text-2xl font-bold text-sky-400">{boneLossCount}부위</div>
                    <span className="text-[10px] text-slate-500">치아 주축·스케일 연동 RBL</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-slate-400">골다공증 위험도 (014)</span>
                      {(reportData.findings.osteoporosisRisk?.status === 'MOCK_SCREENING' ||
                        reportData.findings.osteoporosisRisk?.status === 'NOT_AVAILABLE') && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 border border-amber-500/30 font-semibold">
                          {reportData.findings.osteoporosisRisk?.status === 'NOT_AVAILABLE' ? 'N/A' : 'MOCK'}
                        </span>
                      )}
                    </div>
                    <div className="text-2xl font-bold text-emerald-400">
                      {reportData.findings.osteoporosisRisk?.category ?? 'NOT_AVAILABLE'}
                    </div>
                    <span className="text-[10px] text-slate-500">
                      {reportData.findings.osteoporosisRisk?.status === 'ACTIVE_INFERENCE'
                        ? `OsteoMAENet (${reportData.findings.osteoporosisRisk?.predictedClass || 'MCW'})`
                        : '추론 미연동 (가중치 미로드)'}
                    </span>
                  </div>
                </div>

                {/* 32 FDI Dental Odontogram Matrix */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                      <Layers className="w-4 h-4 text-sky-400" />
                      <span>FDI Full Odontogram Status Grid (32 Teeth)</span>
                    </h3>
                    <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-emerald-500/40 border border-emerald-500"></span><span>Sound</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-teal-500/40 border border-teal-500"></span><span>Restored</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-rose-500/40 border border-rose-500"></span><span>Caries</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-purple-500/40 border border-purple-500"></span><span>Periapical</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700"></span><span>Missing</span></span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase px-1">Maxillary Arch (상악 18~28)</div>
                    <div className="grid grid-cols-16 gap-1.5">
                      {[...upperRightTeeth, ...upperLeftTeeth].map((fdi) => {
                        const s = getToothStatus(fdi);
                        return (
                          <div key={fdi} className={`p-2 rounded border text-center ${s.color} transition-all`}>
                            <div className="text-[11px] font-bold">#{fdi}</div>
                            <div className="text-[9px] truncate font-medium">{s.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="space-y-1 pt-2">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase px-1">Mandibular Arch (하악 48~38)</div>
                    <div className="grid grid-cols-16 gap-1.5">
                      {[...lowerRightTeeth, ...lowerLeftTeeth].map((fdi) => {
                        const s = getToothStatus(fdi);
                        return (
                          <div key={fdi} className={`p-2 rounded border text-center ${s.color} transition-all`}>
                            <div className="text-[11px] font-bold">#{fdi}</div>
                            <div className="text-[9px] truncate font-medium">{s.label}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Treatment Priority Queue */}
                <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-sm font-semibold text-white flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <span>Clinical Treatment Priority Queue (치료 권고 우선순위 큐 - SSOT 연동)</span>
                  </h3>
                  <div className="space-y-2">
                    {reportData.findings.clinicalSynthesis?.treatmentQueue ? (
                      reportData.findings.clinicalSynthesis.treatmentQueue.map((item, idx) => {
                        const isEmergent = item.priority === 'EMERGENT';
                        const isHigh = item.priority === 'HIGH';
                        const isModerate = item.priority === 'MODERATE';
                        const badgeColor = isEmergent
                          ? 'bg-purple-900 text-purple-200'
                          : isHigh
                          ? 'bg-rose-900 text-rose-200'
                          : isModerate
                          ? 'bg-sky-900 text-sky-200'
                          : 'bg-slate-800 text-slate-300';
                        const containerBg = isEmergent
                          ? 'bg-purple-950/30 border-purple-800/60 text-purple-300'
                          : isHigh
                          ? 'bg-rose-950/30 border-rose-800/60 text-rose-300'
                          : isModerate
                          ? 'bg-sky-950/30 border-sky-800/60 text-sky-300'
                          : 'bg-slate-900 border-slate-800 text-slate-400';

                        return (
                          <div key={idx} className={`p-3 border rounded-lg flex items-center justify-between text-xs ${containerBg}`}>
                            <div className="flex items-center space-x-2">
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${badgeColor}`}>{item.priority}</span>
                              <span>{item.recommendation}</span>
                            </div>
                            <ChevronRight className="w-4 h-4" />
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-400">
                        표시할 분석 리포트가 없습니다. 파노라마 영상을 업로드하여 추론하거나 데모를 불러오세요.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'analysis' && (
              <div className="space-y-6">
                {/* Upload & Optional Clinical Metadata Area */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                      <Upload className="w-5 h-5 text-sky-400" />
                      <span>Panoramic Image Upload & AI Inference</span>
                    </h3>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowClinicalForm(!showClinicalForm)}
                        className="px-3 py-1 rounded-lg text-xs border border-slate-700 bg-slate-900 hover:bg-slate-800 text-slate-300"
                      >
                        {showClinicalForm ? '임상정보 입력 접기' : '선택적 치주 임상정보 입력 (PSI/BOP/흡연/당뇨)'}
                      </button>
                      {uploadedFileHash && (
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                          File SHA-256: {uploadedFileHash.slice(0, 12)}...
                        </span>
                      )}
                    </div>
                  </div>

                  {showClinicalForm && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                      <div>
                        <label className="block text-slate-400 mb-1">PSI 점수 (0~4)</label>
                        <input
                          type="number"
                          min={0}
                          max={4}
                          value={clinicalMeta.psiScore ?? ''}
                          onChange={(e) =>
                            setClinicalMeta({ ...clinicalMeta, psiScore: e.target.value === '' ? null : Number(e.target.value) })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          placeholder="미입력 시 경고 게이트 작동"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">탐침 출혈 BOP (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={clinicalMeta.bopPercent ?? ''}
                          onChange={(e) =>
                            setClinicalMeta({ ...clinicalMeta, bopPercent: e.target.value === '' ? null : Number(e.target.value) })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          placeholder="0 ~ 100"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">환자 만 나이 (세)</label>
                        <input
                          type="number"
                          min={1}
                          max={110}
                          value={clinicalMeta.ageYears ?? ''}
                          onChange={(e) =>
                            setClinicalMeta({ ...clinicalMeta, ageYears: e.target.value === '' ? null : Number(e.target.value) })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          placeholder="예: 45"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">흡연 상태</label>
                        <select
                          value={clinicalMeta.smokingStatus ?? ''}
                          onChange={(e) => setClinicalMeta({ ...clinicalMeta, smokingStatus: e.target.value as any })}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                        >
                          <option value="">미확인 (누락)</option>
                          <option value="never">비흡연 (Never)</option>
                          <option value="former">과거흡연 (Former)</option>
                          <option value="current_light">현재흡연 (&lt;10개비/일)</option>
                          <option value="current_heavy">중증흡연 (&gt;=10개비/일)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">당뇨 상태</label>
                        <select
                          value={clinicalMeta.diabetesStatus ?? ''}
                          onChange={(e) => setClinicalMeta({ ...clinicalMeta, diabetesStatus: e.target.value as any })}
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                        >
                          <option value="">미확인 (누락)</option>
                          <option value="none">당뇨 없음</option>
                          <option value="controlled">조절됨 (HbA1c &lt; 7.0%)</option>
                          <option value="uncontrolled">비조절 (HbA1c &gt;= 7.0%)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">당화혈색소 HbA1c (%)</label>
                        <input
                          type="number"
                          step="0.1"
                          min={3}
                          max={20}
                          value={clinicalMeta.hba1cPercent ?? ''}
                          onChange={(e) =>
                            setClinicalMeta({
                              ...clinicalMeta,
                              hba1cPercent: e.target.value === '' ? null : Number(e.target.value),
                            })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          placeholder="예: 6.5 (선택)"
                        />
                      </div>
                      <div>
                        <label className="block text-slate-400 mb-1">치태지수 Plaque Index (%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={clinicalMeta.plaqueIndex ?? ''}
                          onChange={(e) =>
                            setClinicalMeta({ ...clinicalMeta, plaqueIndex: e.target.value === '' ? null : Number(e.target.value) })
                          }
                          className="w-full bg-slate-950 border border-slate-700 rounded px-2 py-1 text-white"
                          placeholder="선택 입력"
                        />
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept="image/*,.dcm,.dicom"
                      onChange={handleFileChange}
                      className="block flex-1 min-w-[220px] text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
                    />
                    <button
                      onClick={handleRunInference}
                      disabled={!selectedFile || isLoading}
                      className="flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-medium px-5 py-2 rounded-lg text-sm transition-colors whitespace-nowrap"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Analyzing...</span>
                        </>
                      ) : (
                        <span>Run Inference</span>
                      )}
                    </button>
                    <label className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 cursor-pointer whitespace-nowrap">
                      <FileJson className="w-4 h-4" />
                      <span>008 Seed/HiTL JSON 열기</span>
                      <input type="file" accept=".json,application/json" onChange={handleImportSeedJson} className="hidden" />
                    </label>
                    <button
                      onClick={handleLoadDemo}
                      disabled={isLoading}
                      className="px-4 py-2 rounded-lg text-sm font-medium border border-amber-500/40 bg-amber-500/10 text-amber-300 hover:bg-amber-500/20 transition-colors whitespace-nowrap"
                    >
                      데모 불러오기 (Load Demo)
                    </button>
                    <button
                      onClick={handleClearReport}
                      disabled={isLoading || (!reportData.reportId && !imagePreview)}
                      className="flex items-center space-x-1.5 px-3.5 py-2 rounded-lg text-sm font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>초기화</span>
                    </button>
                  </div>

                  {errorMessage && (
                    <div className="flex items-center space-x-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                  {statusNotice && (
                    <div className="flex items-center space-x-2 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-300 text-xs">
                      <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-400" />
                      <span>{statusNotice}</span>
                    </div>
                  )}
                </div>

                {/* HiTL Interactive Correction & Golden Export Toolbar */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                      <button
                        onClick={() => {
                          setHitlEditMode(!hitlEditMode);
                          setSelectedTarget(null);
                        }}
                        className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                          hitlEditMode
                            ? 'bg-cyan-500/25 text-cyan-200 border-cyan-400'
                            : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                        }`}
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>{hitlEditMode ? 'HiTL 오답 교정 모드: ON' : 'HiTL 오답 교정 모드 켜기'}</span>
                      </button>

                      {hitlEditMode && (
                        <>
                          <button
                            onClick={() => setHitlTool('select')}
                            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs border ${
                              hitlTool === 'select'
                                ? 'bg-sky-600 text-white border-sky-400'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            <MousePointer className="w-3.5 h-3.5" />
                            <span>선택/이동/크기조절</span>
                          </button>
                          <button
                            onClick={() => setHitlTool('add_tooth')}
                            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs border ${
                              hitlTool === 'add_tooth'
                                ? 'bg-emerald-600 text-white border-emerald-400'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            <PlusSquare className="w-3.5 h-3.5" />
                            <span>+ 치아 박스 추가</span>
                          </button>
                          {hitlTool === 'add_tooth' && (
                            <select
                              aria-label="New tooth default FDI"
                              value={newToothDefaultFdi}
                              onChange={(e) => setNewToothDefaultFdi(Number(e.target.value))}
                              className="bg-slate-900 border border-emerald-500 rounded px-2 py-1 text-xs text-white"
                            >
                              {ALL_Selectable_FDI.map((fdi) => (
                                <option key={fdi} value={fdi}>
                                  신규 FDI #{fdi}
                                </option>
                              ))}
                            </select>
                          )}
                          <button
                            onClick={() => setHitlTool('add_caries')}
                            className={`flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs border ${
                              hitlTool === 'add_caries'
                                ? 'bg-rose-600 text-white border-rose-400'
                                : 'bg-slate-900 text-slate-300 border-slate-700'
                            }`}
                          >
                            <PlusSquare className="w-3.5 h-3.5" />
                            <span>+ 우식 병변 박스 추가</span>
                          </button>
                          <button
                            onClick={handleDeleteSelectedTarget}
                            disabled={!selectedTarget}
                            className="flex items-center space-x-1 px-2.5 py-1.5 rounded text-xs border border-rose-700/60 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 disabled:opacity-40"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>선택 삭제 (Del)</span>
                          </button>
                        </>
                      )}
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setShowSuspected(!showSuspected)}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                          showSuspected
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800'
                        }`}
                      >
                        {showSuspected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                        <span>Suspected Layer</span>
                      </button>

                      <button
                        onClick={handleExportGoldenJson}
                        disabled={!reportData.imageMetadata.width}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-sky-600 hover:bg-sky-500 disabled:opacity-40 text-white"
                      >
                        <Download className="w-3.5 h-3.5" />
                        <span>골든 JSON 내보내기</span>
                      </button>

                      <button
                        onClick={handleSaveGoldenToServer}
                        disabled={!reportData.imageMetadata.width}
                        className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-teal-600 hover:bg-teal-500 disabled:opacity-40 text-white"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Dental_000 HiTL 저장</span>
                      </button>
                    </div>
                  </div>

                  {/* Selected Box Inspector (Tooth FDI + Restoration Tags OR Caries FDI) */}
                  {hitlEditMode && selectedToothObj && selectedTarget?.kind === 'tooth' && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-cyan-500/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-cyan-300">선택된 치아 박스:</span>
                        <select
                          aria-label="Selected tooth FDI editor"
                          value={selectedToothObj.toothNumber}
                          onChange={(e) => handleManualFdiChange(selectedTarget.index, Number(e.target.value))}
                          className="bg-slate-950 border border-cyan-500 rounded px-2 py-1 text-white font-semibold"
                        >
                          {ALL_Selectable_FDI.map((fdi) => (
                            <option key={fdi} value={fdi}>
                              FDI #{fdi} {SUPERNUMERARY_FDI_SET.has(fdi) ? '(과잉치)' : fdi >= 51 ? '(유치)' : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="flex items-center flex-wrap gap-1.5">
                        <span className="text-slate-400 mr-1">수복·보철 태그 (013):</span>
                        {RESTORATION_TAG_OPTIONS.map((tag) => {
                          const active = (selectedToothObj.restorationTags || []).includes(tag);
                          return (
                            <button
                              key={tag}
                              onClick={() =>
                                setReportData((prev) => toggleToothRestorationTag(prev, selectedTarget.index, tag))
                              }
                              className={`px-2 py-1 rounded border text-[11px] font-medium transition-colors ${
                                active
                                  ? 'bg-teal-600 text-white border-teal-400'
                                  : 'bg-slate-950 text-slate-400 border-slate-700 hover:text-slate-200'
                              }`}
                            >
                              {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {hitlEditMode && selectedCariesObj && selectedTarget?.kind === 'caries' && (
                    <div className="p-3 rounded-lg bg-slate-900 border border-rose-500/50 flex flex-wrap items-center justify-between gap-3 text-xs">
                      <div className="flex items-center space-x-3">
                        <span className="font-bold text-rose-300">선택된 우식/병변 박스 (002 HiTL):</span>
                        <select
                          aria-label="Selected caries FDI editor"
                          value={selectedCariesObj.toothNumber ?? ''}
                          onChange={(e) => {
                            const val = e.target.value === '' ? null : Number(e.target.value);
                            setReportData((prev) =>
                              updateCariesBoxInReport(prev, selectedTarget.index, null, val)
                            );
                          }}
                          className="bg-slate-950 border border-rose-500 rounded px-2 py-1 text-white font-semibold"
                        >
                          <option value="">미지정 (Unassigned)</option>
                          {ALL_Selectable_FDI.map((fdi) => (
                            <option key={fdi} value={fdi}>
                              귀속 치아 FDI #{fdi}
                            </option>
                          ))}
                        </select>
                      </div>
                      <span className="text-slate-400">
                        캔버스에서 박스를 드래그하여 이동하거나 우측 하단 모서리 핸들을 끌어 크기를 조절하세요.
                      </span>
                    </div>
                  )}
                </div>

                {/* Canvas Viewer */}
                <PanoramaCanvasViewer
                  imageUrl={imagePreview || undefined}
                  reportData={reportData}
                  showSuspected={showSuspected}
                  isDemoMode={isDemoMode}
                  uploadedFileHash={uploadedFileHash}
                  hitlEditMode={hitlEditMode}
                  hitlTool={hitlTool}
                  selectedTarget={selectedTarget}
                  onSelectTarget={setSelectedTarget}
                  onUpdateToothGeometry={(idx, box) =>
                    setReportData((prev) => updateToothGeometryInReport(prev, idx, box))
                  }
                  onUpdateCariesGeometry={(idx, box) =>
                    setReportData((prev) => updateCariesBoxInReport(prev, idx, box))
                  }
                  onDrawNewBox={handleDrawNewBox}
                />

                {/* Tooth Grid & Quick Manual FDI Correction UI */}
                {detectedTeeth.length > 0 && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                        <Edit3 className="w-4 h-4 text-sky-400" />
                        <span>치아 FDI 식별 목록 ({detectedTeeth.length}개) 및 수동 보정</span>
                      </h3>
                      <span className="text-xs text-slate-400">
                        치아 카드를 클릭하면 캔버스에서 선택되며 FDI 번호(`11`~`85`, 과잉치 `19`~`49`)를 수정할 수 있습니다.
                      </span>
                    </div>

                    {uncertainTeeth.length > 0 && (
                      <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-lg flex items-center justify-between text-xs text-amber-200">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>
                            FDI 번호 재확인이 필요한 치아(`uncertain: true`)가 {uncertainTeeth.length}개 있습니다.
                          </span>
                        </div>
                        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300">
                          {uncertainTeeth.map(({ tooth }) => `?#${tooth.toothNumber}`).join(', ')}
                        </span>
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                      {detectedTeeth.map((tooth, idx) => {
                        const isEditing = editingToothIndex === idx;
                        const isSelectedCard = selectedTarget?.kind === 'tooth' && selectedTarget.index === idx;
                        return (
                          <div
                            key={`${idx}-${tooth.toothNumber}`}
                            onClick={() => {
                              if (hitlEditMode) setSelectedTarget({ kind: 'tooth', index: idx });
                            }}
                            className={`p-3 rounded-lg border text-xs transition-all cursor-pointer ${
                              isSelectedCard
                                ? 'bg-cyan-950/40 border-cyan-400 text-cyan-100'
                                : tooth.uncertain
                                ? 'bg-amber-950/25 border-amber-500/60 text-amber-200'
                                : tooth.clinicianCorrected
                                ? 'bg-sky-950/30 border-sky-500/60 text-sky-200'
                                : 'bg-slate-900 border-slate-800 text-slate-200'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="font-bold text-sm">
                                {tooth.uncertain ? `?#${tooth.toothNumber}` : `#${tooth.toothNumber}`}
                              </span>
                              {tooth.uncertain && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-semibold">
                                  Uncertain
                                </span>
                              )}
                              {tooth.clinicianCorrected && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 border border-sky-500/40 font-semibold">
                                  보정됨
                                </span>
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400 mb-1.5">
                              Conf: {(tooth.confidence * 100).toFixed(0)}%
                              {tooth.originalToothNumber && tooth.originalToothNumber !== tooth.toothNumber && (
                                <span className="ml-1 text-sky-400">(기존 #{tooth.originalToothNumber})</span>
                              )}
                            </div>

                            {tooth.restorationTags && tooth.restorationTags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mb-2">
                                {tooth.restorationTags.map((tg) => (
                                  <span
                                    key={tg}
                                    className="text-[10px] px-1.5 py-0.5 rounded bg-teal-500/20 text-teal-300 border border-teal-500/30"
                                  >
                                    {tg}
                                  </span>
                                ))}
                              </div>
                            )}

                            {isEditing ? (
                              <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                <select
                                  aria-label={`FDI selection for tooth ${tooth.toothNumber}`}
                                  value={tooth.toothNumber}
                                  onChange={(e) => handleManualFdiChange(idx, Number(e.target.value))}
                                  className="w-full bg-slate-950 border border-sky-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                >
                                  {ALL_Selectable_FDI.map((fdi) => (
                                    <option key={fdi} value={fdi}>
                                      FDI #{fdi}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => setEditingToothIndex(null)}
                                  className="w-full text-[11px] py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                                >
                                  취소
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingToothIndex(idx);
                                }}
                                className="w-full py-1 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 font-medium text-[11px] flex items-center justify-center space-x-1 transition-colors"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>FDI 번호 수정</span>
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Findings Summary */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                    <ShieldAlert className="w-5 h-5 text-amber-400" />
                    <span>Diagnostic Summary</span>
                  </h3>
                  <p className="text-sm text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-lg border border-slate-800">
                    {reportData.summary ||
                      '현재 로드된 판독 리포트가 없습니다. 파노라마 영상을 업로드하고 [Run Inference]를 실행하거나 [008 Seed/HiTL JSON 열기]를 클릭하세요.'}
                  </p>
                  {perioRisk && perioRisk.assessmentStatus === 'COMPLETE' && (
                    <div className="text-xs text-emerald-300 bg-emerald-950/30 border border-emerald-700/60 rounded-lg px-4 py-3 space-y-1">
                      <div className="font-bold">
                        치주 위험도 종합 평가: {perioRisk.stage} / {perioRisk.grade} (위험도: {perioRisk.riskLevel})
                      </div>
                      {perioRisk.visionEvidenceSummary && (
                        <div className="text-slate-300">{perioRisk.visionEvidenceSummary}</div>
                      )}
                    </div>
                  )}
                  {reportData.findings?.ageEstimation?.predictedAge != null && (
                    <div className="text-xs text-sky-300 bg-slate-900/80 border border-slate-800 rounded-lg px-4 py-2.5 flex items-center justify-between">
                      <span>추정 치아 연령 (Dental_011): 약 {reportData.findings.ageEstimation.predictedAge.toFixed(1)}세</span>
                      {reportData.findings.ageEstimation.confidenceInterval95 && (
                        <span className="text-slate-400">
                          95% CI: [{reportData.findings.ageEstimation.confidenceInterval95[0]} ~ {reportData.findings.ageEstimation.confidenceInterval95[1]}세]
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Mandatory Disclaimer Footer Banner */}
      <footer className="fixed bottom-0 left-0 right-0 bg-slate-950 border-t border-slate-800 py-2 px-6 text-center text-xs text-amber-400/90 flex items-center justify-center space-x-2 z-50">
        <Info className="w-4 h-4 flex-shrink-0" />
        <span>
          [비상업 연구용 고지 (Non-Commercial Research Only / CC BY-NC-SA 4.0)] 본 분석 결과는 학술 연구 및 진단 보조용 스크리닝 참고 자료이며, 상업적 의료기기로 사용할 수 없고 확진은 치과의사 전문의의 임상 검진을 따라야 합니다.
        </span>
      </footer>
    </div>
  );
};

export default App;
