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
} from 'lucide-react';
import { PanoramaCanvasViewer } from './components/PanoramaCanvasViewer';
import { mockFinalReport } from './mocks/mockFinalReport';
import { checkHealth, inferPanorama } from './api/client';
import { FinalReportResponse } from './types/finalReport';

interface ModuleStatusItem {
  id: string;
  name: string;
  type: string;
  status: 'ONLINE' | 'OFFLINE' | 'STANDBY';
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

const VALID_PERMANENT_FDI: number[] = [
  18, 17, 16, 15, 14, 13, 12, 11,
  21, 22, 23, 24, 25, 26, 27, 28,
  48, 47, 46, 45, 44, 43, 42, 41,
  31, 32, 33, 34, 35, 36, 37, 38,
];

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis'>('analysis');
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [isGpuAvailable, setIsGpuAvailable] = useState<boolean>(false);
  const [vramFree, setVramFree] = useState<number>(0);
  const [modulesList, setModulesList] = useState<ModuleStatusItem[]>([
    { id: 'Dental_008', name: '치아 식별 및 FDI 분할', type: 'YOLOv8 Seg', status: 'ONLINE', weights: 'yolov8m_best.pt', version: 'Tooth Cls' },
    { id: 'Dental_002', name: '치아 우식증 (2-Stage)', type: 'YOLO Patch', status: 'ONLINE', weights: 'best_patch.onnx', version: 'Precision 83%' },
    { id: 'Dental_012', name: '치근단 병소 (음성증강)', type: 'YOLO11s', status: 'ONLINE', weights: 'best.onnx', version: 'mAP 73.7%' },
    { id: 'Dental_010', name: '결손치 식별 및 갭', type: 'Heuristic', status: 'ONLINE', weights: 'Rule-based', version: 'Dynamic Mid' },
    { id: 'Dental_003', name: '치조골 소실 계측', type: 'Masking', status: 'ONLINE', weights: 'Core', version: 'v1.0' },
    { id: 'Dental_009', name: '매복치 난이도 분석', type: 'Winter Cls', status: 'ONLINE', weights: 'Geometry', version: 'v1.0' },
    { id: 'Dental_013', name: '치과 수복물 분류', type: 'YOLOv8 Seg', status: 'ONLINE', weights: 'best_restoration_model.onnx', version: 'v1.0' },
    { id: 'Dental_014', name: '골다공증 위험 스크리닝', type: 'OsteoMAENet', status: 'ONLINE', weights: 'best.pt', version: 'v1.0 (MCW)' },
  ]);

  // Initial state starts empty (no silent mock data masquerading as live result)
  const [isDemoMode, setIsDemoMode] = useState<boolean>(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileHash, setUploadedFileHash] = useState<string | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<FinalReportResponse>(emptyReport);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [editingToothIndex, setEditingToothIndex] = useState<number | null>(null);

  const [showSuspected, setShowSuspected] = useState<boolean>(false);

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
      } catch (err) {
        setBackendStatus('Disconnected');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

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
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
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

  const handleLoadDemo = () => {
    setSelectedFile(null);
    setUploadedFileHash(mockFinalReport.imageMetadata.sha256_hash || null);
    setImagePreview('/sample_panorama.png');
    setReportData(structuredClone(mockFinalReport));
    setIsDemoMode(true);
    setEditingToothIndex(null);
    setErrorMessage(null);
  };

  const handleClearReport = () => {
    setSelectedFile(null);
    setUploadedFileHash(null);
    setImagePreview(null);
    setReportData(emptyReport);
    setIsDemoMode(false);
    setEditingToothIndex(null);
    setErrorMessage(null);
  };

  const handleRunInference = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);
    setIsDemoMode(false);
    setEditingToothIndex(null);

    try {
      const result = await inferPanorama(selectedFile, false);
      setReportData(result);
    } catch (err: any) {
      console.warn('API Call failed:', err);
      // Strictly prevent fallback to mock data on real user uploads
      setErrorMessage('백엔드 AI 추론 호출에 실패했습니다. (게이트웨이 연결 및 모델 가동 상태를 확인하세요)');
      setReportData(emptyReport);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual FDI correction handler for uncertain or misnumbered teeth
  const handleManualFdiChange = (toothIndex: number, newFdi: number) => {
    setReportData((prev) => {
      if (!prev.findings.teeth || !prev.findings.teeth[toothIndex]) {
        return prev;
      }
      const nextTeeth = prev.findings.teeth.map((t, idx) => {
        if (idx !== toothIndex) return t;
        return {
          ...t,
          originalToothNumber: t.originalToothNumber ?? t.toothNumber,
          toothNumber: newFdi,
          uncertain: false,
          clinicianCorrected: true,
        };
      });
      return {
        ...prev,
        findings: {
          ...prev.findings,
          teeth: nextTeeth,
        },
      };
    });
    setEditingToothIndex(null);
  };

  // SHA-256 mismatch detection between uploaded file and active report (when not in demo mode)
  const reportSha256 = reportData.imageMetadata.sha256_hash?.toLowerCase();
  const isShaMismatchBlocked =
    !isDemoMode &&
    Boolean(reportData.reportId) &&
    Boolean(uploadedFileHash && reportSha256 && uploadedFileHash.toLowerCase() !== reportSha256);

  // Clinical Multi-Module Synthesis Calculations
  const cariesCount = reportData.findings.caries?.length || 0;
  const periapicalCount = reportData.findings.periapicalLesions?.length || 0;
  const boneLossCount = reportData.findings.boneLoss?.length || 0;
  const verifiedMissing = reportData.findings.missingTeeth?.verified_missing || [];
  const detectedTeeth = reportData.findings.teeth || [];
  const uncertainTeeth = detectedTeeth
    .map((tooth, index) => ({ tooth, index }))
    .filter(({ tooth }) => Boolean(tooth.uncertain));

  // FDI Tooth Numbers mapping
  const upperRightTeeth = [18, 17, 16, 15, 14, 13, 12, 11];
  const upperLeftTeeth = [21, 22, 23, 24, 25, 26, 27, 28];
  const lowerRightTeeth = [48, 47, 46, 45, 44, 43, 42, 41];
  const lowerLeftTeeth = [31, 32, 33, 34, 35, 36, 37, 38];

  const getToothStatus = (fdi: number) => {
    // 1. Backend Clinical Synthesis SSOT Direct Binding
    const synthesisStatus = reportData.findings.clinicalSynthesis?.odontogram?.[String(fdi)];
    if (synthesisStatus) {
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
        default:
          return { label: 'Sound', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' };
      }
    }

    // Fallback: Local synthesis
    const isMissing = verifiedMissing.includes(fdi);
    const hasPeriapical = reportData.findings.periapicalLesions?.some((p) => p.toothNumber === fdi);
    const cariesItem = reportData.findings.caries?.find((c) => c.toothNumber === fdi);
    const hasBoneLoss = reportData.findings.boneLoss?.some((b) => b.toothNumber === fdi);

    if (isMissing) return { label: 'Missing', color: 'bg-slate-800 text-slate-500 border-slate-700' };
    if (hasPeriapical) return { label: 'Periapical', color: 'bg-purple-950/60 text-purple-400 border-purple-800' };
    if (cariesItem) {
      return cariesItem.confidence >= 0.45
        ? { label: 'Caries', color: 'bg-rose-950/60 text-rose-400 border-rose-800' }
        : { label: 'Suspected', color: 'bg-amber-950/60 text-amber-400 border-amber-800' };
    }
    if (hasBoneLoss) return { label: 'BoneLoss', color: 'bg-sky-950/60 text-sky-400 border-sky-800' };
    return { label: 'Sound', color: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/60' };
  };

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
            <p className="text-xs text-slate-400">Clinical AI Frontend Web Platform</p>
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
        {/* Left Sidebar with Navigation & AI Module Status Panel */}
        <aside className="w-72 bg-slate-950 border-r border-slate-800 p-4 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-6">
            {/* Nav Tabs */}
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
                <span>Panoramic Analysis</span>
              </button>
            </div>

            {/* Realtime AI Modules Health & Weights Status */}
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
                      <div className="flex items-center justify-between">
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

          {/* Architecture info note */}
          <div className="p-3 bg-slate-900/60 rounded-lg border border-slate-800 text-[11px] text-slate-400 space-y-1 mt-4">
            <div className="font-semibold text-slate-300 flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5 text-sky-400" />
              <span>Native Host Serving</span>
            </div>
            <p className="text-[10px] text-slate-400 leading-tight">
              Docker 불필요: 8GB VRAM Dynamic ModelManager를 통해 네이티브 GPU 가속으로 실시간 서비스 중입니다.
            </p>
          </div>
        </aside>

        {/* Workspace Main Area */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Persistent Top DEMO DATA Warning Banner across tabs whenever isDemoMode is active */}
            {isDemoMode && (
              <div className="flex items-center justify-between p-4 bg-amber-500/15 border-2 border-amber-500 rounded-xl text-amber-200 text-xs shadow-lg shadow-amber-950/30">
                <div className="flex items-center space-x-3">
                  <AlertTriangle className="w-5 h-5 flex-shrink-0 text-amber-400" />
                  <div>
                    <div className="font-bold text-amber-300 text-sm tracking-wide">
                      DEMO DATA — 실제 환자 판독 결과가 아닌 데모 화면입니다
                    </div>
                    <p className="text-slate-300 text-xs mt-0.5">
                      현재 화면의 영상(`sample_panorama.png`) 및 진단 리포트(`mockFinalReport`)는 기능 시연용 고정 샘플입니다. 실제 환자 판독 시 우측의 초기화 버튼을 누르거나 실제 영상을 업로드하여 추론을 실행하세요.
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClearReport}
                  className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 border border-amber-400/50 font-semibold text-xs whitespace-nowrap transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>데모 리포트 초기화 / 비우기</span>
                </button>
              </div>
            )}

            {/* SHA-256 Hash Mismatch Guard Banner */}
            {isShaMismatchBlocked && (
              <div className="flex items-center justify-between p-4 bg-rose-950/60 border-2 border-rose-500 rounded-xl text-rose-200 text-xs shadow-lg shadow-rose-950/40">
                <div className="flex items-center space-x-3">
                  <AlertCircle className="w-5 h-5 flex-shrink-0 text-rose-400" />
                  <div>
                    <div className="font-bold text-rose-300 text-sm">
                      SHA-256 해시 불일치 감지 — 추론 완료 전까지 오버레이 렌더링이 차단되었습니다
                    </div>
                    <p className="text-slate-300 text-xs mt-0.5 font-mono">
                      업로드 파일 SHA-256 ({uploadedFileHash?.slice(0, 12)}...) ≠ 기존 리포트 SHA-256 ({reportSha256?.slice(0, 12)}...)
                    </p>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/40 text-rose-300 font-bold text-[10px] whitespace-nowrap">
                  OVERLAY BLOCKED
                </span>
              </div>
            )}

            {/* TAB 1: Clinical Multi-Module Synthesis Dashboard */}
            {activeTab === 'dashboard' && (
              <div className="space-y-6">
                {/* Header Banner */}
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
                    008(치아분할), 002(우식), 012(치근단), 003(골소실), 010(결손치) 분석 결과를 통합하여 치아 단위의 진단 지형도 및 치료 우선순위를 산출합니다.
                  </p>
                </div>

                {/* 4 Key Statistics Cards */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">치아 우식증 (002)</span>
                    <div className="text-2xl font-bold text-rose-400">{cariesCount}건</div>
                    <span className="text-[10px] text-slate-500">2-Stage 정밀 패치 검출</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">치근단 병소 (012)</span>
                    <div className="text-2xl font-bold text-purple-400">{periapicalCount}건</div>
                    <span className="text-[10px] text-slate-500">치근단 앵커링 매칭</span>
                  </div>
                  <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                    <span className="text-xs text-slate-400">치조골 소실 부위 (003)</span>
                    <div className="text-2xl font-bold text-sky-400">{boneLossCount}부위</div>
                    <span className="text-[10px] text-slate-500">치조정 마스킹 계측</span>
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
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-rose-500/40 border border-rose-500"></span><span>Caries</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-purple-500/40 border border-purple-500"></span><span>Periapical</span></span>
                      <span className="flex items-center space-x-1"><span className="w-2.5 h-2.5 rounded bg-slate-800 border border-slate-700"></span><span>Missing</span></span>
                    </div>
                  </div>

                  {/* Upper Jaw (Maxilla) */}
                  <div className="space-y-1">
                    <div className="text-[10px] text-slate-500 font-semibold uppercase px-1">Maxillary Arch (상악 11~28)</div>
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

                  {/* Lower Jaw (Mandible) */}
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

                {/* Treatment Priority Queue (Clinical Synthesis) */}
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
                        const iconColor = isEmergent
                          ? 'text-purple-400'
                          : isHigh
                          ? 'text-rose-400'
                          : isModerate
                          ? 'text-sky-400'
                          : 'text-slate-500';

                        return (
                          <div key={idx} className={`p-3 border rounded-lg flex items-center justify-between text-xs ${containerBg}`}>
                            <div className="flex items-center space-x-2">
                              <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${badgeColor}`}>{item.priority}</span>
                              <span>{item.recommendation}</span>
                            </div>
                            <ChevronRight className={`w-4 h-4 ${iconColor}`} />
                          </div>
                        );
                      })
                    ) : (
                      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg flex items-center justify-between text-xs text-slate-400">
                        <span>표시할 분석 리포트가 없습니다. 파노라마 영상을 업로드하여 추론하거나 데모를 불러오세요.</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: Panoramic Analysis (Canvas Viewer) */}
            {activeTab === 'analysis' && (
              <div className="space-y-6">
                {/* Image Upload Area */}
                <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                      <Upload className="w-5 h-5 text-sky-400" />
                      <span>Panoramic Image Upload & AI Inference</span>
                    </h3>
                    {uploadedFileHash && (
                      <span className="text-[11px] font-mono text-slate-400 bg-slate-900 px-2.5 py-1 rounded border border-slate-800">
                        File SHA-256: {uploadedFileHash.slice(0, 12)}...
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileChange}
                      className="block flex-1 min-w-[240px] text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
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
                      className="flex items-center space-x-1.5 px-4 py-2 rounded-lg text-sm font-medium border border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>데모 리포트 초기화 / 비우기</span>
                    </button>
                  </div>

                  {errorMessage && (
                    <div className="flex items-center space-x-2 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-xs">
                      <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-400" />
                      <span>{errorMessage}</span>
                    </div>
                  )}
                </div>

                {/* Header info & Dual Threshold Controls */}
                <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
                  <div>
                    <h2 className="text-xl font-bold text-white">Clinical Panoramic Viewer</h2>
                    <p className="text-xs text-slate-400">
                      Report ID: {reportData.reportId || 'N/A (No Active Report)'} | Patient: {reportData.patientId || 'N/A'}
                    </p>
                  </div>

                  {/* Dual Threshold Toggle Button */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={() => setShowSuspected(!showSuspected)}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                        showSuspected
                          ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                          : 'bg-slate-900 text-slate-400 border-slate-800 hover:bg-slate-800 hover:text-slate-200'
                      }`}
                    >
                      {showSuspected ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                      <span>Suspected Lesions Layer (20%~45%)</span>
                    </button>

                    <div className="flex items-center space-x-1.5 text-xs text-emerald-400">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Clinical Defense Active</span>
                    </div>
                  </div>
                </div>

                {/* Canvas Viewer */}
                <PanoramaCanvasViewer
                  imageUrl={imagePreview || undefined}
                  reportData={reportData}
                  showSuspected={showSuspected}
                  isDemoMode={isDemoMode}
                  uploadedFileHash={uploadedFileHash}
                />

                {/* Uncertain Tooth Manual FDI Correction UI */}
                {detectedTeeth.length > 0 && (
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-semibold text-white flex items-center space-x-2">
                        <Edit3 className="w-4 h-4 text-sky-400" />
                        <span>치아 FDI 식별 목록 및 불확실(`uncertain`) 치아 수동 보정</span>
                      </h3>
                      <span className="text-xs text-slate-400">
                        치아 카드를 클릭하여 FDI 번호(`11`~`48`)를 직접 수정할 수 있습니다.
                      </span>
                    </div>

                    {uncertainTeeth.length > 0 && (
                      <div className="p-3.5 bg-amber-950/30 border border-amber-500/40 rounded-lg flex items-center justify-between text-xs text-amber-200">
                        <div className="flex items-center space-x-2">
                          <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                          <span>
                            FDI 번호 재확인이 필요한 치아(`uncertain: true`)가 {uncertainTeeth.length}개 있습니다: 아래 목록에서 클릭하여 수동 보정하세요.
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
                        return (
                          <div
                            key={`${idx}-${tooth.toothNumber}`}
                            className={`p-3 rounded-lg border text-xs transition-all ${
                              tooth.uncertain
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

                            <div className="text-[11px] text-slate-400 mb-2">
                              Conf: {(tooth.confidence * 100).toFixed(0)}%
                              {tooth.originalToothNumber && tooth.originalToothNumber !== tooth.toothNumber && (
                                <span className="ml-1 text-sky-400">(기존 #{tooth.originalToothNumber})</span>
                              )}
                            </div>

                            {isEditing ? (
                              <div className="space-y-1.5">
                                <select
                                  aria-label={`FDI selection for tooth ${tooth.toothNumber}`}
                                  value={tooth.toothNumber}
                                  onChange={(e) => handleManualFdiChange(idx, Number(e.target.value))}
                                  className="w-full bg-slate-950 border border-sky-500 rounded px-2 py-1 text-xs text-white focus:outline-none"
                                >
                                  {VALID_PERMANENT_FDI.map((fdi) => (
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
                                onClick={() => setEditingToothIndex(idx)}
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
                    {reportData.summary || '현재 로드된 판독 리포트가 없습니다. 파노라마 영상을 업로드하고 [Run Inference]를 실행하거나 [데모 불러오기 (Load Demo)]를 클릭하세요.'}
                  </p>
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
          본 분석 결과는 진단 보조용 스크리닝 참고 자료이며, 확진 및 개별 치아 처치는 치과의사 전문의의 실체 임상 검진을 따라야 합니다.
        </span>
      </footer>
    </div>
  );
};

export default App;
