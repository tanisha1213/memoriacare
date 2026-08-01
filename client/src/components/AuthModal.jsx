import React, { useState } from 'react';
import axios from 'axios';
import { KeyRound, Mail, User, ShieldCheck, ArrowRight, Sparkles, AlertCircle } from 'lucide-react';

export default function AuthModal({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({ familyName: '', email: '', password: '' });
  const [errorMsg, setErrorMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);

    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const res = await axios.post(endpoint, formData);

      if (res.data.success) {
        localStorage.setItem('token', res.data.token);
        localStorage.setItem('familyCode', res.data.familyCode);
        localStorage.setItem('familyName', res.data.familyName || 'Family');

        onAuthSuccess(res.data.familyCode, res.data.familyName || 'Family');
      } else {
        setErrorMsg(res.data.error || 'Authentication failed.');
      }
    } catch (err) {
      console.error('Auth Error:', err);
      setErrorMsg(err.response?.data?.error || 'Authentication failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-xl flex items-center justify-center p-4 z-50 animate-in fade-in select-none">
      <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 max-w-md w-full shadow-2xl text-slate-100 relative overflow-hidden backdrop-blur-md">
        <div className="absolute -top-20 -left-20 w-40 h-40 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="text-center mb-6 relative">
          <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mx-auto mb-3 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h2 className="text-2xl font-extrabold text-white tracking-tight">
            {isLogin ? 'Welcome to MemoriaCare' : 'Create Family Account'}
          </h2>
          <p className="text-slate-400 text-xs mt-1 max-w-xs mx-auto">
            {isLogin
              ? 'Enter email and password to access your family account'
              : 'Register to create your private family memory mirror'}
          </p>
        </div>

        {errorMsg && (
          <div className="mb-4 bg-rose-950/80 border border-rose-500/40 text-rose-200 text-xs p-3 rounded-2xl text-center flex items-center justify-center gap-2 animate-shake">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 relative">
          {!isLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-emerald-400" />
                Family Name <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g. The Patil Family"
                value={formData.familyName}
                onChange={(e) => setFormData({ ...formData, familyName: e.target.value })}
                className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-cyan-400" />
              Email Address <span className="text-rose-400">*</span>
            </label>
            <input
              type="email"
              placeholder="caregiver@family.com"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
              <KeyRound className="w-3.5 h-3.5 text-amber-400" />
              Password <span className="text-rose-400">*</span>
            </label>
            <input
              type="password"
              placeholder="••••••••"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg mt-2 cursor-pointer flex items-center justify-center gap-2"
          >
            {loading ? (
              <Sparkles className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <span>{isLogin ? 'Sign In' : 'Register Account'}</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
          <button
            onClick={() => {
              setErrorMsg('');
              setIsLogin(!isLogin);
            }}
            className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer font-medium"
          >
            {isLogin ? 'Need a new family account? Register' : 'Already have an account? Sign In'}
          </button>
        </div>
      </div>
    </div>
  );
}
