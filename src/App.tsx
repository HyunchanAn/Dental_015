import React, { useState } from 'react';
import { Activity, Stethoscope, FileText, Layers, RefreshCw } from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analysis' | 'settings'>('dashboard');

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
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
            MSA Gateway Connected
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
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Dental MSA Frontend Core</h2>
              <p className="text-sm text-slate-400 leading-relaxed mb-4">
                Dental_015 모듈은 Dental_001부터 Dental_014까지의 개별 AI 마이크로서비스 및 Dental_Panoramic_Reader 백엔드 서비스를 통합 연동하기 위한 React + TypeScript 기반 임상 프론트엔드 플랫폼입니다.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Target Services</div>
                  <div className="text-2xl font-bold text-sky-400">14 MSA</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Tech Stack</div>
                  <div className="text-lg font-semibold text-emerald-400">Vite + React + TS</div>
                </div>
                <div className="bg-slate-900 p-4 rounded-lg border border-slate-800">
                  <div className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Status</div>
                  <div className="text-lg font-semibold text-amber-400">v0.1.0 Initialized</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
