import React, { useState } from 'react';
import { Activity, Stethoscope, Layers, CheckCircle2, ShieldAlert } from 'lucide-react';
import { PanoramaCanvasViewer } from './components/PanoramaCanvasViewer';
import { mockFinalReport } from './mocks/mockFinalReport';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'settings'>('dashboard');

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
        <div className="flex items-center space-x-4">
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            MSA Gateway Protocol v1 (Normalized BBox)
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
            {/* Header info */}
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">Clinical Panoramic Viewer</h2>
                <p className="text-sm text-slate-400">
                  Report ID: {mockFinalReport.reportId} | Patient: {mockFinalReport.patientId}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                <span className="text-sm text-emerald-400 font-medium">SSOT Mock Validated</span>
              </div>
            </div>

            {/* Canvas Viewer */}
            <PanoramaCanvasViewer reportData={mockFinalReport} />

            {/* Findings Summary */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6 space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center space-x-2">
                <ShieldAlert className="w-5 h-5 text-amber-400" />
                <span>Diagnostic Summary</span>
              </h3>
              <p className="text-sm text-slate-300 leading-relaxed bg-slate-900 p-4 rounded-lg border border-slate-800">
                {mockFinalReport.summary}
              </p>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
