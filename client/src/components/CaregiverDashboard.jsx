import React, { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import {
  ShieldAlert,
  UserCheck,
  XCircle,
  Clock,
  RefreshCw,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Users,
  Tag,
  FileText,
  User,
  Volume2,
  BellRing,
  Trash2,
  UserPlus,
  Calendar,
  Plus,
  Play,
  Pause,
  Pill,
  Sun,
  Moon,
  Utensils,
  Coffee,
  Heart,
  Smile,
  Edit3,
  AlertTriangle
} from 'lucide-react';

function getRelativeTime(timestamp) {
  if (!timestamp) return 'Just now';
  const now = new Date();
  const date = new Date(timestamp);
  const diffInSeconds = Math.floor((now - date) / 1000);

  if (diffInSeconds < 30) return 'Just now';
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function playAlertChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    if (ctx.state === 'suspended') {
      ctx.resume();
    }

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    const now = ctx.currentTime;
    osc1.frequency.setValueAtTime(880, now);
    osc1.frequency.setValueAtTime(1046.5, now + 0.15);

    osc2.frequency.setValueAtTime(440, now);
    osc2.frequency.setValueAtTime(523.25, now + 0.15);

    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (err) {
    console.warn('Web Audio alert chime error:', err);
  }
}

function triggerDesktopNotification() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('MemoriaCare Alert: New Visitor Detected', {
        body: 'An unknown person is at the mirror. Tap to review.',
        icon: '/favicon.svg'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification('MemoriaCare Alert: New Visitor Detected', {
            body: 'An unknown person is at the mirror. Tap to review.',
            icon: '/favicon.svg'
          });
        }
      });
    }
  }
}

export default function CaregiverDashboard({ familyCode = 'FAM123' }) {
  const [activeTab, setActiveTab] = useState('QUEUE');
  const [unknownQueue, setUnknownQueue] = useState([]);
  const [registeredVisitors, setRegisteredVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  const [formData, setFormData] = useState({});

  const prevUnknownsLengthRef = useRef(null);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleTestAlertSound = () => {
    playAlertChime();

    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          showToast('Desktop alert notifications enabled!', 'success');
        } else {
          showToast('Alert sound played. Desktop notifications blocked by browser.', 'info');
        }
      });
    } else {
      showToast('Playing test alert chime audio!', 'success');
      triggerDesktopNotification();
    }
  };

  const fetchUnknowns = useCallback(async () => {
    try {
      const res = await axios.get(`/api/visitors/${familyCode}/unknowns`);
      const queueData = res.data?.data || res.data || [];
      if (Array.isArray(queueData)) {
        if (
          prevUnknownsLengthRef.current !== null &&
          queueData.length > prevUnknownsLengthRef.current
        ) {
          playAlertChime();
          triggerDesktopNotification();
          showToast('New visitor detected at mirror camera!', 'error');
        }

        prevUnknownsLengthRef.current = queueData.length;
        setUnknownQueue(queueData);
      }
    } catch (err) {
      console.error('Error fetching unknown queue:', err);
    } finally {
      setLoading(false);
    }
  }, [familyCode]);

  const fetchRegisteredVisitors = useCallback(async () => {
    try {
      const res = await axios.get(`/api/visitors/${familyCode}`);
      const visitorsData = res.data?.data || res.data || [];
      if (Array.isArray(visitorsData)) {
        setRegisteredVisitors(visitorsData);
      }
    } catch (err) {
      console.error('Error fetching registered visitors:', err);
    }
  }, [familyCode]);

  const [routines, setRoutines] = useState([]);
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [routineForm, setRoutineForm] = useState({
    activityName: '',
    time: '09:00',
    reminderMessage: '',
    frequency: 'EVERYDAY',
    priority: 'NORMAL',
    voiceEnabled: true,
    caregiverNotify: true,
    timeoutMinutes: 5
  });

  const fetchRoutines = useCallback(async () => {
    try {
      const res = await axios.get(`/api/routines/${familyCode}`);
      const data = res.data?.data || [];
      if (Array.isArray(data)) {
        setRoutines(data);
      }
    } catch (err) {
      console.error('Error fetching routines:', err);
    }
  }, [familyCode]);

  const handleOpenAddRoutine = (preset = null) => {
    if (preset) {
      setRoutineForm({
        activityName: preset.activityName,
        time: preset.time,
        reminderMessage: preset.reminderMessage,
        frequency: preset.frequency || 'EVERYDAY',
        priority: preset.priority || 'NORMAL',
        voiceEnabled: preset.voiceEnabled ?? true,
        caregiverNotify: preset.caregiverNotify ?? true,
        timeoutMinutes: preset.timeoutMinutes || 5
      });
    } else {
      setRoutineForm({
        activityName: '',
        time: '09:00',
        reminderMessage: '',
        frequency: 'EVERYDAY',
        priority: 'NORMAL',
        voiceEnabled: true,
        caregiverNotify: true,
        timeoutMinutes: 5
      });
    }
    setEditingRoutineId(null);
    setIsRoutineModalOpen(true);
  };

  const handleOpenEditRoutine = (item) => {
    setEditingRoutineId(item._id);
    setRoutineForm({
      activityName: item.activityName,
      time: item.time,
      reminderMessage: item.reminderMessage || '',
      frequency: item.frequency || 'EVERYDAY',
      priority: item.priority || 'NORMAL',
      voiceEnabled: item.voiceEnabled ?? true,
      caregiverNotify: item.caregiverNotify ?? true,
      timeoutMinutes: item.timeoutMinutes || 5
    });
    setIsRoutineModalOpen(true);
  };

  const handleSaveRoutineSubmit = async (e) => {
    e.preventDefault();
    if (!routineForm.activityName || !routineForm.time) {
      showToast('Activity Name and Time are required.', 'error');
      return;
    }

    try {
      if (editingRoutineId) {
        const res = await axios.put(`/api/routines/${editingRoutineId}`, routineForm);
        if (res.data.success) {
          showToast('Routine updated successfully.', 'success');
        }
      } else {
        const res = await axios.post(`/api/routines/${familyCode}`, routineForm);
        if (res.data.success) {
          showToast('New routine item added.', 'success');
        }
      }
      setIsRoutineModalOpen(false);
      fetchRoutines();
    } catch (err) {
      console.error('Error saving routine:', err);
      showToast('Failed to save routine item.', 'error');
    }
  };

  const handleToggleRoutineActive = async (id) => {
    try {
      const res = await axios.patch(`/api/routines/toggle/${id}`);
      if (res.data.success) {
        showToast(res.data.isActive ? 'Routine activated.' : 'Routine paused.', 'info');
        fetchRoutines();
      }
    } catch (err) {
      console.error('Error toggling routine:', err);
    }
  };

  const handleDeleteRoutine = async (id, title) => {
    if (!window.confirm(`Are you sure you want to delete "${title}" from daily routines?`)) return;

    try {
      const res = await axios.delete(`/api/routines/${id}`);
      if (res.data.success) {
        showToast(`Deleted "${title}".`, 'success');
        fetchRoutines();
      }
    } catch (err) {
      console.error('Error deleting routine:', err);
      showToast('Failed to delete routine.', 'error');
    }
  };

  useEffect(() => {
    prevUnknownsLengthRef.current = null;
    fetchUnknowns();
    fetchRegisteredVisitors();
    fetchRoutines();

    const interval = setInterval(() => {
      if (isPolling) {
        fetchUnknowns();
        fetchRegisteredVisitors();
        fetchRoutines();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchUnknowns, fetchRegisteredVisitors, isPolling, familyCode]);

  const handleInputChange = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  const handleSaveAndRegister = async (unknownId) => {
    const itemData = formData[unknownId] || {};
    const name = itemData.name ? itemData.name.trim() : '';
    const relationship = itemData.relationship ? itemData.relationship.trim() : '';
    const contextNote = itemData.contextNote ? itemData.contextNote.trim() : '';

    if (!name || !relationship) {
      showToast('Please enter both Name and Relationship for the visitor.', 'error');
      return;
    }

    const targetSnapshot = unknownQueue.find((q) => (q._id || q.id) === unknownId);

    try {
      const res = await axios.post(`/api/queue/approve/${unknownId}`, {
        name,
        relationship,
        contextNote,
        embedding: targetSnapshot?.embedding || [],
        photoThumbnail: targetSnapshot?.photoThumbnail || targetSnapshot?.photo_thumbnail || ''
      });

      if (res.data.success) {
        showToast(`Registered "${name}" (${relationship}) successfully!`, 'success');
        
        setFormData((prev) => {
          const next = { ...prev };
          delete next[unknownId];
          return next;
        });
        
        fetchUnknowns();
        fetchRegisteredVisitors();
      } else {
        showToast(res.data.message || 'Failed to register visitor.', 'error');
      }
    } catch (err) {
      console.error('Error registering visitor:', err);
      showToast('Server error while saving visitor.', 'error');
    }
  };

  const handleDismissAlert = async (unknownId) => {
    try {
      const res = await axios.patch(`/api/queue/dismiss/${unknownId}`);
      if (res.data.success) {
        showToast('Snapshot dismissed from review queue.', 'info');
        fetchUnknowns();
      } else {
        showToast(res.data.message || 'Failed to dismiss snapshot.', 'error');
      }
    } catch (err) {
      console.error('Error dismissing snapshot:', err);
      showToast('Server error while dismissing snapshot.', 'error');
    }
  };

  const handleDeleteVisitor = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove "${name}" from registered family members?`)) {
      return;
    }

    try {
      const res = await axios.delete(`/api/visitors/${id}`);
      if (res.data.success) {
        showToast(`Removed "${name}" from registered visitors list.`, 'success');
        fetchRegisteredVisitors();
      } else {
        showToast(res.data.message || 'Failed to delete visitor.', 'error');
      }
    } catch (err) {
      console.error('Error deleting visitor:', err);
      showToast('Server error while deleting visitor.', 'error');
    }
  };

  const relationshipOptions = [
    'Son',
    'Daughter',
    'Doctor',
    'Nurse / Caregiver',
    'Friend',
    'Grandchild',
    'Neighbor',
    'Physical Therapist',
    'Delivery Person'
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 p-4 sm:p-6 lg:p-8 select-none relative">
      {toast && (
        <div
          className={`fixed top-20 right-6 z-50 max-w-md p-4 rounded-2xl shadow-2xl backdrop-blur-md border flex items-center gap-3 animate-in fade-in slide-in-from-top-5 transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-500/50 text-emerald-200'
              : toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-500/50 text-rose-200'
              : 'bg-cyan-950/90 border-cyan-500/50 text-cyan-200'
          }`}
        >
          {toast.type === 'success' && <CheckCircle2 className="w-6 h-6 text-emerald-400 shrink-0" />}
          {toast.type === 'error' && <AlertCircle className="w-6 h-6 text-rose-400 shrink-0 animate-bounce" />}
          {toast.type === 'info' && <Sparkles className="w-6 h-6 text-cyan-400 shrink-0" />}
          <p className="text-sm font-medium">{toast.message}</p>
        </div>
      )}

      <div className="max-w-7xl mx-auto space-y-8">
        <header className="bg-slate-950/80 border border-slate-800 rounded-3xl p-6 backdrop-blur-xl shadow-xl flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 shadow-inner">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-2xl font-extrabold text-white tracking-tight">Caregiver Dashboard</h1>
                <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-mono text-emerald-400 font-bold">
                  {familyCode}
                </span>
              </div>
              <p className="text-slate-400 text-sm mt-0.5">
                Review visitor alerts & manage registered family members
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto justify-between lg:justify-end">
            <button
              onClick={handleTestAlertSound}
              className="px-3.5 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 active:scale-95 transition text-xs font-semibold text-emerald-300 border border-emerald-500/30 flex items-center gap-2 cursor-pointer shadow-md"
              title="Test audio chime & request Web Notification permissions"
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Test Alert Sound</span>
            </button>

            <div className="flex items-center gap-3 bg-slate-900 px-3.5 py-2 rounded-2xl border border-slate-800 text-xs text-slate-300">
              <div className="flex items-center gap-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isPolling ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`} />
                <span>{isPolling ? 'Polling Every 4s' : 'Polling Paused'}</span>
              </div>
              <button
                onClick={() => setIsPolling(!isPolling)}
                className="text-xs text-slate-400 hover:text-white underline ml-1 cursor-pointer"
              >
                {isPolling ? 'Pause' : 'Resume'}
              </button>
            </div>

            <button
              onClick={() => {
                fetchUnknowns();
                fetchRegisteredVisitors();
              }}
              title="Manual Refresh"
              className="p-2.5 rounded-2xl bg-slate-800 hover:bg-slate-700 transition text-slate-300 hover:text-white border border-slate-700 cursor-pointer"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="flex items-center border-b border-slate-800 gap-4">
          <button
            onClick={() => setActiveTab('QUEUE')}
            className={`pb-3 px-2 font-bold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'QUEUE'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <BellRing className="w-4 h-4" />
            Unknown Visitor Alerts
            <span className="px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-xs font-extrabold border border-amber-500/30">
              {unknownQueue.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('REGISTERED')}
            className={`pb-3 px-2 font-bold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'REGISTERED'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            Registered Family Members
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold border border-emerald-500/30">
              {registeredVisitors.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('ROUTINE')}
            className={`pb-3 px-2 font-bold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ROUTINE'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Daily Timetable & Reminders
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-extrabold border border-indigo-500/30">
              {routines.length}
            </span>
          </button>
        </div>

        {activeTab === 'QUEUE' && (
          <section>
            {loading ? (
              <div className="bg-slate-950/50 border border-slate-800 rounded-3xl p-16 flex flex-col items-center justify-center text-center">
                <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mb-4" />
                <p className="text-slate-400 text-sm">Loading pending visitor snapshots...</p>
              </div>
            ) : unknownQueue.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-inner relative overflow-hidden">
                <div className="w-20 h-20 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-6">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Queue Completely Clear!</h3>
                <p className="text-slate-400 text-sm max-w-md mb-6">
                  There are currently no unidentified visitor snapshots waiting for review. All visitors detected by the Patient Mirror have been identified or resolved.
                </p>
                <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-400">
                  <Clock className="w-4 h-4 text-emerald-400" />
                  <span>Live camera queue auto-updates every 4 seconds</span>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {unknownQueue.map((item) => {
                  const itemId = item._id || item.id;
                  const currentForm = formData[itemId] || {};
                  return (
                    <div
                      key={itemId}
                      className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 rounded-3xl overflow-hidden shadow-xl backdrop-blur-md transition-all flex flex-col justify-between group"
                    >
                      <div className="relative aspect-video bg-slate-900 overflow-hidden">
                        <img
                          src={item.photoThumbnail || item.photo_thumbnail}
                          alt="Unknown Visitor Snapshot"
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-transparent to-transparent opacity-80" />

                        <div className="absolute top-3 left-3 px-3 py-1 rounded-full bg-slate-950/80 backdrop-blur-md border border-slate-800 text-xs font-semibold text-amber-300 flex items-center gap-1.5 shadow-md">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          {getRelativeTime(item.timestamp || item.created_at)}
                        </div>

                        <div className="absolute bottom-3 left-3 right-3 text-xs text-slate-300 flex items-center justify-between">
                          <span className="font-mono text-[10px] text-slate-400">
                            ID: {String(itemId).slice(-6)}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/30">
                            Snapshot Captured
                          </span>
                        </div>
                      </div>

                      <div className="p-5 space-y-4 flex-1">
                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-emerald-400" />
                            Visitor Name <span className="text-rose-400">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Tanish"
                            value={currentForm.name || ''}
                            onChange={(e) => handleInputChange(itemId, 'name', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Tag className="w-3.5 h-3.5 text-cyan-400" />
                            Relationship <span className="text-rose-400">*</span>
                          </label>
                          <div className="space-y-2">
                            <select
                              value={currentForm.relationshipPreset || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                handleInputChange(itemId, 'relationshipPreset', val);
                                if (val !== 'Custom') {
                                  handleInputChange(itemId, 'relationship', val);
                                }
                              }}
                              className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-sm text-white outline-none transition"
                            >
                              <option value="">Select Relationship...</option>
                              {relationshipOptions.map((opt) => (
                                <option key={opt} value={opt}>
                                  {opt}
                                </option>
                              ))}
                              <option value="Custom">+ Custom Relationship...</option>
                            </select>

                            {(!currentForm.relationshipPreset || currentForm.relationshipPreset === 'Custom') && (
                              <input
                                type="text"
                                placeholder="e.g. Son, Doctor, Friend"
                                value={currentForm.relationship || ''}
                                onChange={(e) => handleInputChange(itemId, 'relationship', e.target.value)}
                                className="w-full bg-slate-900 border border-slate-800 focus:border-cyan-500 rounded-xl px-3.5 py-2 text-sm text-white placeholder-slate-500 outline-none transition"
                              />
                            )}
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <FileText className="w-3.5 h-3.5 text-amber-400" />
                            Memory Context Note
                          </label>
                          <textarea
                            rows={2}
                            placeholder="e.g. Brings fresh fruits every Sunday"
                            value={currentForm.contextNote || ''}
                            onChange={(e) => handleInputChange(itemId, 'contextNote', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-amber-500 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none resize-none transition"
                          />
                        </div>
                      </div>

                      <div className="p-5 pt-0 space-y-2">
                        <button
                          onClick={() => handleSaveAndRegister(itemId)}
                          className="w-full py-2.5 px-4 rounded-xl font-bold text-sm text-white bg-emerald-600 hover:bg-emerald-500 active:scale-[0.98] transition-all shadow-lg flex items-center justify-center gap-2 cursor-pointer"
                        >
                          <UserCheck className="w-4 h-4" />
                          Save & Register Visitor
                        </button>

                        <button
                          onClick={() => handleDismissAlert(itemId)}
                          className="w-full py-2 px-4 rounded-xl font-semibold text-xs text-rose-300 bg-rose-600/20 hover:bg-rose-600/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          Dismiss Alert
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'REGISTERED' && (
          <section>
            {registeredVisitors.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-12 sm:p-16 flex flex-col items-center justify-center text-center shadow-inner">
                <div className="w-20 h-20 rounded-3xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-6">
                  <UserPlus className="w-10 h-10" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">No Registered Members Yet</h3>
                <p className="text-slate-400 text-sm max-w-md">
                  When an unknown person visits the Patient Mirror, approve their snapshot from the "Unknown Visitor Alerts" tab to register them here.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {registeredVisitors.map((visitor) => {
                  const visitorId = visitor._id || visitor.id;
                  return (
                    <div
                      key={visitorId}
                      className="bg-slate-950/90 border border-slate-800 hover:border-emerald-500/40 rounded-3xl p-6 backdrop-blur-md shadow-xl transition-all flex flex-col justify-between group"
                    >
                      <div className="flex items-start gap-4 mb-4">
                        {visitor.photoThumbnail ? (
                          <img
                            src={visitor.photoThumbnail}
                            alt={visitor.name}
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-emerald-400/80 shadow-md shrink-0"
                          />
                        ) : (
                          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border-2 border-emerald-400 flex items-center justify-center text-emerald-400 font-bold text-xl shrink-0">
                            {visitor.name.charAt(0)}
                          </div>
                        )}

                        <div className="flex-1 min-w-0">
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold text-xs border border-emerald-500/30">
                            {visitor.relationship}
                          </span>
                          <h3 className="text-xl font-bold text-white mt-1 tracking-tight truncate">
                            {visitor.name}
                          </h3>
                          <p className="text-xs text-slate-400 font-medium mt-0.5">
                            Registered Family Member
                          </p>
                        </div>
                      </div>

                      {visitor.contextNote && (
                        <div className="bg-slate-900/80 p-3 rounded-xl border border-slate-800/80 mb-5">
                          <p className="text-xs text-slate-300 italic line-clamp-3">
                            "{visitor.contextNote}"
                          </p>
                        </div>
                      )}

                      <button
                        onClick={() => handleDeleteVisitor(visitorId, visitor.name)}
                        className="w-full py-2 px-3 rounded-xl font-semibold text-xs text-rose-300 bg-rose-600/20 hover:bg-rose-600/30 border border-rose-500/30 transition-all flex items-center justify-center gap-1.5 cursor-pointer mt-auto"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete Member
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* 3. DAILY ROUTINE & REMINDERS TAB */}
        {activeTab === 'ROUTINE' && (
          <section className="space-y-6 animate-in fade-in">
            {/* TIMETABLE HEADER ACTIONS */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-slate-900/60 p-5 rounded-3xl border border-slate-800 backdrop-blur-md">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  Daily Routine Timetable
                </h2>
                <p className="text-slate-400 text-xs mt-1">
                  Create and manage scheduled activities, medication alerts, and spoken prompts for the mirror device.
                </p>
              </div>

              <button
                onClick={() => handleOpenAddRoutine()}
                className="px-4 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-600/30 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>Add New Reminder</span>
              </button>
            </div>

            {/* PRESET QUICK ADD BUTTONS */}
            <div className="bg-slate-950/80 p-4 rounded-3xl border border-slate-800/80">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block mb-3">
                ⚡ Quick Activity Presets:
              </span>
              <div className="flex flex-wrap gap-2">
                {[
                  { activityName: 'Wake Up', time: '07:00', reminderMessage: 'Good morning. Time to wake up and start your day.', priority: 'NORMAL' },
                  { activityName: 'Brush Teeth', time: '07:30', reminderMessage: 'Time to brush your teeth.', priority: 'NORMAL' },
                  { activityName: 'Breakfast', time: '08:00', reminderMessage: 'Time to enjoy your breakfast.', priority: 'NORMAL' },
                  { activityName: 'Medicine Reminder', time: '09:00', reminderMessage: 'It is 9:00 AM. It is time for your morning medicine.', priority: 'URGENT' },
                  { activityName: 'Morning Walk', time: '10:30', reminderMessage: 'Time for a gentle morning walk.', priority: 'NORMAL' },
                  { activityName: 'Lunch', time: '13:00', reminderMessage: 'Time for lunch.', priority: 'NORMAL' },
                  { activityName: 'Afternoon Snack', time: '16:00', reminderMessage: 'Time for a light snack and a glass of water.', priority: 'NORMAL' },
                  { activityName: 'Family Time', time: '18:00', reminderMessage: 'Time to connect with your family.', priority: 'NORMAL' },
                  { activityName: 'Dinner', time: '20:00', reminderMessage: 'Time for dinner.', priority: 'NORMAL' },
                  { activityName: 'Prepare for Sleep', time: '21:30', reminderMessage: 'Time to relax and prepare for a restful sleep.', priority: 'IMPORTANT' }
                ].map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => handleOpenAddRoutine(preset)}
                    className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 hover:border-slate-700 text-xs font-medium transition cursor-pointer flex items-center gap-1.5"
                  >
                    <span>+</span>
                    <span>{preset.time} — {preset.activityName}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* ROUTINES LIST */}
            {routines.length === 0 ? (
              <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-12 text-center max-w-lg mx-auto">
                <Calendar className="w-12 h-12 text-indigo-400 mx-auto mb-3 opacity-60" />
                <h3 className="text-lg font-bold text-white">No Timetable Reminders Set</h3>
                <p className="text-slate-400 text-sm mt-1 mb-4">
                  Click "Add New Reminder" or tap a Quick Activity Preset to set up scheduled care prompts.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {routines.map((item) => {
                  const isUrgent = item.priority === 'URGENT';
                  const isImportant = item.priority === 'IMPORTANT';

                  return (
                    <div
                      key={item._id}
                      className={`bg-slate-950/90 border ${
                        !item.isActive
                          ? 'border-slate-800 opacity-60'
                          : isUrgent
                          ? 'border-rose-500/50 shadow-rose-500/10'
                          : isImportant
                          ? 'border-amber-500/50 shadow-amber-500/10'
                          : 'border-slate-800 hover:border-indigo-500/40'
                      } rounded-3xl p-6 backdrop-blur-md shadow-xl transition-all flex flex-col justify-between`}
                    >
                      <div>
                        {/* CARD TOP HEADER */}
                        <div className="flex items-center justify-between gap-3 mb-3">
                          <div className="flex items-center gap-2">
                            <span className="text-2xl font-black text-indigo-400 tracking-tight font-mono">
                              {item.time}
                            </span>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                                isUrgent
                                  ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40 animate-pulse'
                                  : isImportant
                                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                                  : 'bg-slate-800 text-slate-300 border border-slate-700'
                              }`}
                            >
                              {item.priority}
                            </span>
                          </div>

                          <button
                            onClick={() => handleToggleRoutineActive(item._id)}
                            className={`px-3 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                              item.isActive
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-slate-800 text-slate-400 border border-slate-700'
                            }`}
                          >
                            {item.isActive ? <Play className="w-3 h-3 text-emerald-400 fill-emerald-400" /> : <Pause className="w-3 h-3 text-slate-400" />}
                            <span>{item.isActive ? 'Active' : 'Paused'}</span>
                          </button>
                        </div>

                        {/* ACTIVITY TITLE */}
                        <h3 className="text-xl font-bold text-white tracking-tight mb-2">
                          {item.activityName}
                        </h3>

                        {/* REMINDER MESSAGE */}
                        {item.reminderMessage && (
                          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800/80 mb-4">
                            <p className="text-xs text-slate-300 italic line-clamp-3">
                              "{item.reminderMessage}"
                            </p>
                          </div>
                        )}

                        {/* METADATA TAGS */}
                        <div className="flex flex-wrap items-center gap-2 mb-4 text-[11px] text-slate-400">
                          <span className="bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-800">
                            🔁 {item.frequency || 'EVERYDAY'}
                          </span>
                          {item.voiceEnabled && (
                            <span className="bg-indigo-500/10 text-indigo-300 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                              🗣️ Voice Spoken
                            </span>
                          )}
                          {item.caregiverNotify && (
                            <span className="bg-rose-500/10 text-rose-300 px-2.5 py-1 rounded-lg border border-rose-500/20">
                              🔔 Notify Caregiver ({item.timeoutMinutes || 5}m)
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CARD ACTIONS */}
                      <div className="flex items-center gap-2 pt-3 border-t border-slate-900 mt-auto">
                        <button
                          onClick={() => handleOpenEditRoutine(item)}
                          className="flex-1 py-2 px-3 rounded-xl font-semibold text-xs text-slate-300 bg-slate-900 hover:bg-slate-800 border border-slate-800 transition flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDeleteRoutine(item._id, item.activityName)}
                          className="py-2 px-3 rounded-xl font-semibold text-xs text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/20 transition flex items-center justify-center gap-1.5 cursor-pointer"
                          title="Delete Routine"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>

      {/* ROUTINE MODAL OVERLAY */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Calendar className="w-5 h-5 text-indigo-400" />
                <span>{editingRoutineId ? 'Edit Routine Item' : 'Add Routine Item'}</span>
              </h3>
              <button
                onClick={() => setIsRoutineModalOpen(false)}
                className="text-slate-400 hover:text-white transition cursor-pointer"
              >
                <XCircle className="w-6 h-6" />
              </button>
            </div>

            <form onSubmit={handleSaveRoutineSubmit} className="space-y-4">
              {/* ACTIVITY NAME */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Activity Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Medicine Reminder, Breakfast, Walk"
                  value={routineForm.activityName}
                  onChange={(e) => setRoutineForm({ ...routineForm, activityName: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* TIME & PRIORITY */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Scheduled Time (24h) *
                  </label>
                  <input
                    type="time"
                    required
                    value={routineForm.time}
                    onChange={(e) => setRoutineForm({ ...routineForm, time: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Priority Level
                  </label>
                  <select
                    value={routineForm.priority}
                    onChange={(e) => setRoutineForm({ ...routineForm, priority: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="IMPORTANT">Important</option>
                    <option value="URGENT">Urgent (Red Alert)</option>
                  </select>
                </div>
              </div>

              {/* REMINDER MESSAGE */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Spoken Reminder Message
                </label>
                <textarea
                  rows="2"
                  placeholder="Message spoken aloud to the patient at scheduled time"
                  value={routineForm.reminderMessage}
                  onChange={(e) => setRoutineForm({ ...routineForm, reminderMessage: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>

              {/* FREQUENCY & TIMEOUT */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Repeat Frequency
                  </label>
                  <select
                    value={routineForm.frequency}
                    onChange={(e) => setRoutineForm({ ...routineForm, frequency: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="EVERYDAY">Every day</option>
                    <option value="WEEKDAYS">Weekdays</option>
                    <option value="WEEKENDS">Weekends</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Ack Timeout (Mins)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={routineForm.timeoutMinutes}
                    onChange={(e) => setRoutineForm({ ...routineForm, timeoutMinutes: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* TOGGLES */}
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <label className="flex items-center gap-3 text-xs font-medium text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={routineForm.voiceEnabled}
                    onChange={(e) => setRoutineForm({ ...routineForm, voiceEnabled: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>🗣️ Speak reminder message out loud via mirror</span>
                </label>

                <label className="flex items-center gap-3 text-xs font-medium text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={routineForm.caregiverNotify}
                    onChange={(e) => setRoutineForm({ ...routineForm, caregiverNotify: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-700 bg-slate-950 text-indigo-600 focus:ring-0"
                  />
                  <span>🔔 Notify caregiver if unacknowledged after timeout</span>
                </label>
              </div>

              {/* SUBMIT BUTTON */}
              <div className="flex items-center gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRoutineModalOpen(false)}
                  className="flex-1 py-3 px-4 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 px-4 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition cursor-pointer"
                >
                  {editingRoutineId ? 'Save Changes' : 'Create Routine'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
