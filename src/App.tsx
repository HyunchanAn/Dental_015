import React, { useState, useEffect } from 'react';
import { Activity, Stethoscope, Layers, CheckCircle2, ShieldAlert, Upload, Loader2, AlertCircle } from 'lucide-react';
import { PanoramaCanvasViewer } from './components/PanoramaCanvasViewer';
import { mockFinalReport } from './mocks/mockFinalReport';
import { checkHealth, inferPanorama } from './api/client';
import { FinalReportResponse } from './types/finalReport';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis'>('dashboard');
  const [backendStatus, setBackendStatus] = useState<string>('Checking...');
  const [isGpuAvailable, setIsGpuAvailable] = useState<boolean>(false);
  const [vramFree, setVramFree] = useState<number>(0);
  
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [reportData, setReportData] = useState<FinalReportResponse>(mockFinalReport);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Poll Health status
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const res = await checkHealth();
        setBackendStatus(res.status);
        setIsGpuAvailable(res.gpu_available);
        setVramFree(res.vram_free_gb || 0);
      } catch (err) {
        setBackendStatus('Disconnected (Mock Mode)');
      }
    };
    checkStatus();
    const interval = setInterval(checkStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setImagePreview(URL.createObjectURL(file));
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
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
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
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full font-medium border ${
            backendStatus === 'HEALTHY' 
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' 
              : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            Gateway: {backendStatus} {isGpuAvailable && `(VRAM: ${vramFree}GB)`}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside className="w-64 bg-slate-950 border-r border-slate-800 p-4 space-y-2">
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

            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Clinical Panoramic Viewer</h2>
                <p className="text-sm text-slate-400">
                  Report ID: {reportData.reportId} | Patient: {reportData.patientId}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">SSOT Schema Validated</span>
              </div>
            </div>

            {/* Canvas Viewer */}
            <PanoramaCanvasViewer imageUrl={imagePreview || undefined} reportData={reportData} />

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
    </div>
  );
};

export default App;
