import React, { useState } from 'react';
import PatientMirror from './components/PatientMirror';
import CaregiverDashboard from './components/CaregiverDashboard';
import AuthModal from './components/AuthModal';
import { Heart, Globe, LogOut, UserCheck } from 'lucide-react';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [familyCode, setFamilyCode] = useState(() => localStorage.getItem('familyCode') || null);
  const [familyName, setFamilyName] = useState(() => localStorage.getItem('familyName') || null);

  const [activeTab, setActiveTab] = useState('MIRROR');
  const [currentLang, setCurrentLang] = useState('en');

  const languages = [
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'hi', label: 'हिंदी (Hindi)', flag: '🇮🇳' },
    { code: 'mr', label: 'मराठी (Marathi)', flag: '🇮🇳' }
  ];

  const handleAuthSuccess = (code, name) => {
    setFamilyCode(code);
    setFamilyName(name);
    setToken(localStorage.getItem('token'));
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('familyCode');
    localStorage.removeItem('familyName');
    setToken(null);
    setFamilyCode(null);
    setFamilyName(null);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-['Plus_Jakarta_Sans',sans-serif] selection:bg-emerald-500 selection:text-white relative">
      {!token || !familyCode ? (
        <AuthModal onAuthSuccess={handleAuthSuccess} />
      ) : null}

      <header className="w-full bg-slate-900/80 backdrop-blur-md border-b border-slate-800 px-4 sm:px-6 py-3.5 sticky top-0 z-40 flex flex-col md:flex-row items-center justify-between gap-4 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
            <Heart className="w-5 h-5 fill-emerald-500/20" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-extrabold text-white tracking-tight">MemoriaCare</h1>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold border border-emerald-500/20 uppercase tracking-wider">
                Family Care
              </span>
            </div>
            <p className="text-[11px] text-slate-400 hidden sm:block">
              Memory Mirror for Patients & Caregivers
            </p>
          </div>
        </div>

        <div className="flex items-center bg-slate-950 p-1 rounded-2xl border border-slate-800/80 shadow-inner">
          <button
            onClick={() => setActiveTab('MIRROR')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'MIRROR'
                ? 'bg-emerald-600 text-white shadow-lg glow-emerald'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🪞</span>
            Patient Mirror
          </button>

          <button
            onClick={() => setActiveTab('CAREGIVER')}
            className={`px-4 py-2 rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all cursor-pointer ${
              activeTab === 'CAREGIVER'
                ? 'bg-emerald-600 text-white shadow-lg glow-emerald'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>🛡️</span>
            Caregiver Dashboard
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-1.5 text-xs">
            <Globe className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <select
              value={currentLang}
              onChange={(e) => setCurrentLang(e.target.value)}
              className="bg-transparent text-slate-200 font-medium outline-none cursor-pointer pr-1"
            >
              {languages.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-slate-900 text-white">
                  {lang.flag} {lang.label}
                </option>
              ))}
            </select>
          </div>

          {familyCode && (
            <div className="flex items-center gap-2 bg-slate-950 border border-slate-800 rounded-2xl px-3 py-1.5 text-xs">
              <UserCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              <span className="text-slate-300 font-bold truncate max-w-[120px]">
                {familyName || 'Family'}
              </span>
              <span className="px-2 py-0.5 rounded-md bg-slate-900 border border-slate-700 font-mono text-emerald-400 font-bold text-[10px]">
                {familyCode}
              </span>
            </div>
          )}

          {token && (
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 rounded-2xl bg-rose-950/60 hover:bg-rose-900/80 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Log out"
            >
              <LogOut className="w-3.5 h-3.5 text-rose-400" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </header>

      <main className="flex-1">
        {familyCode ? (
          activeTab === 'MIRROR' ? (
            <PatientMirror familyCode={familyCode} currentLang={currentLang} />
          ) : (
            <CaregiverDashboard familyCode={familyCode} />
          )
        ) : null}
      </main>
    </div>
  );
}
