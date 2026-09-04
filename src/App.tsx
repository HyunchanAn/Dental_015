import React, { useState, useEffect } from 'react';
import { Activity, Stethoscope, Layers, CheckCircle2, ShieldAlert, Upload, Loader2, AlertCircle, Eye, EyeOff, Info, Cpu, HardDrive, CheckCircle, AlertTriangle } from 'lucide-react';
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
    { id: 'Dental_013', name: '치과 수복물 분류', type: 'Classifier', status: 'STANDBY', weights: 'Not Loaded', version: 'v1.0' },
  ]);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>('/sample_panorama.png');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<FinalReportResponse>(mockFinalReport);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
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
        setBackendStatus('Disconnected (Mock Mode)');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      const objectUrl = URL.createObjectURL(file);
      setImagePreview(objectUrl);
      setErrorMessage(null);
    }
  };

  const handleRunInference = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const result = await inferPanorama(selectedFile, false);
      setReportData(result);
    } catch (err: any) {
      console.warn('API Call failed, falling back to mock data:', err);
      setErrorMessage('백엔드 연동에 실패하여 Mock 응답 데이터로 대체 표시합니다.');
      setReportData(mockFinalReport);
    } finally {
      setIsLoading(false);
    }
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
          <div className="flex items-center space-x-2 text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
            <Cpu className="w-3.5 h-3.5 text-sky-400" />
            <span>GPU: {isGpuAvailable ? 'RTX 4060 Laptop' : 'CPU Mode'}</span>
            <span className="text-slate-600">|</span>
            <HardDrive className="w-3.5 h-3.5 text-amber-400" />
            <span>VRAM Free: {vramFree} GB</span>
          </div>
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${
            backendStatus === 'HEALTHY' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
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
                <span>Dashboard</span>
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
                  {modulesList.filter(m => m.status === 'ONLINE').length}/{modulesList.length} ACTIVE
                </span>
              </div>

              <div className="space-y-1.5">
                {modulesList.map((m) => {
                  const isOnline = m.status === 'ONLINE';
                  const isStandby = m.status === 'STANDBY';
                  return (
                    <div
                      key={m.id}
                      className="p-2.5 bg-slate-900/80 hover:bg-slate-900 rounded-lg border border-slate-800/80 transition-all space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-200">{m.id}</span>
                        <span className={`inline-flex items-center space-x-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          isOnline 
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : isStandby
                            ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            isOnline ? 'bg-emerald-400 animate-pulse' : isStandby ? 'bg-amber-400' : 'bg-rose-400'
                          }`} />
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

        {/* Workspace */}
        <main className="flex-1 overflow-y-auto p-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {/* Image Upload Area */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <Upload className="w-5 h-5 text-sky-400" />
                <span>Panoramic Image Upload & AI Inference</span>
              </h3>
              
              <div className="flex items-center space-x-4">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="block w-full text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-sky-600 file:text-white hover:file:bg-sky-500 cursor-pointer"
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
              </div>

              {errorMessage && (
                <div className="flex items-center space-x-2 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-400 text-xs">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Header info & Dual Threshold Controls */}
            <div className="flex items-center justify-between bg-slate-950 p-4 rounded-xl border border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-white">Clinical Panoramic Viewer</h2>
                <p className="text-xs text-slate-400">
                  Report ID: {reportData.reportId} | Patient: {reportData.patientId}
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
            />

            {/* Findings Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Diagnostic Summary</span>
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-lg border border-slate-800">
                {reportData.summary}
              </p>
            </div>
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
