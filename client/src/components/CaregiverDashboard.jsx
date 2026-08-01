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
  UserPlus
} from 'lucide-react';

// Format relative arrival timestamp
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

// Web Audio API Synthesizer Chime
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

// Trigger native browser Web Desktop Notification
function triggerDesktopNotification() {
  if ('Notification' in window) {
    if (Notification.permission === 'granted') {
      new Notification('⚠️ MemoriaCare Alert: New Visitor Detected', {
        body: 'An unknown person is at the mirror. Tap to review.',
        icon: '/favicon.svg'
      });
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          new Notification('⚠️ MemoriaCare Alert: New Visitor Detected', {
            body: 'An unknown person is at the mirror. Tap to review.',
            icon: '/favicon.svg'
          });
        }
      });
    }
  }
}

export default function CaregiverDashboard({ familyCode = 'FAM123' }) {
  const [activeTab, setActiveTab] = useState('QUEUE'); // 'QUEUE' | 'REGISTERED'
  const [unknownQueue, setUnknownQueue] = useState([]);
  const [registeredVisitors, setRegisteredVisitors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isPolling, setIsPolling] = useState(true);

  // Form states per card ID
  const [formData, setFormData] = useState({});

  // Ref to track previous unknown queue length
  const prevUnknownsLengthRef = useRef(null);

  // Show Toast notification
  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  // Test Alert Sound button & request Web Notification permissions
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

  // Fetch pending unknown snapshots
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
          showToast('⚠️ New visitor detected at mirror camera!', 'error');
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

  // Fetch registered visitors list for management
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

  // Poll API every 4 seconds
  useEffect(() => {
    prevUnknownsLengthRef.current = null;
    fetchUnknowns();
    fetchRegisteredVisitors();

    const interval = setInterval(() => {
      if (isPolling) {
        fetchUnknowns();
        fetchRegisteredVisitors();
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [fetchUnknowns, fetchRegisteredVisitors, isPolling, familyCode]);

  // Form field change handler
  const handleInputChange = (id, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [id]: {
        ...prev[id],
        [field]: value
      }
    }));
  };

  // Save & Register Visitor
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

  // Dismiss Alert
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

  // Delete Registered Visitor
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
      {/* Toast Notification */}
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
        {/* Header Bar */}
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

        {/* Dashboard Two-Tab Navigation */}
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
            ⚠️ Unknown Visitor Alerts
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
            👥 Registered Family Members
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-extrabold border border-emerald-500/30">
              {registeredVisitors.length}
            </span>
          </button>
        </div>

        {/* TAB 1: PENDING UNKNOWN SNAPSHOTS */}
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

        {/* TAB 2: REGISTERED FAMILY MEMBERS */}
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
      </div>
    </div>
  );
}
