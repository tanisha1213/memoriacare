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
  User,
  Volume2,
  BellRing,
  Trash2,
  UserPlus,
  Calendar,
  Plus,
  Pill,
  Coffee,
  Heart,
  Activity
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

const DEFAULT_REMINDERS = [
  {
    id: 'rem_1',
    time: '08:00 AM',
    title: 'Morning Medicine & Breakfast',
    note: 'Take 1 BP tablet with warm water after light breakfast.',
    category: 'Medicine'
  },
  {
    id: 'rem_2',
    time: '01:00 PM',
    title: 'Lunch & Hydration',
    note: 'Fresh soup and roti. Ensure 2 glasses of water.',
    category: 'Meal'
  },
  {
    id: 'rem_3',
    time: '05:30 PM',
    title: 'Evening Garden Walk',
    note: '15-minute gentle walk in the garden with daughter.',
    category: 'Activity'
  }
];

export default function CaregiverDashboard({ familyCode = 'FAM123' }) {
  const [activeTab, setActiveTab] = useState('QUEUE');
  const [unknownQueue, setUnknownQueue] = useState([]);
  const [registeredVisitors, setRegisteredVisitors] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);
  const [isPolling, setIsPolling] = useState(true);
  const [formData, setFormData] = useState({});
  const [showAddReminder, setShowAddReminder] = useState(false);
  const [newReminder, setNewReminder] = useState({
    time: '09:00 AM',
    title: '',
    note: '',
    category: 'Medicine'
  });

  const prevUnknownsLengthRef = useRef(null);

  // Load reminders from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`memoriacare_reminders_${familyCode}`);
      if (saved) {
        setReminders(JSON.parse(saved));
      } else {
        setReminders(DEFAULT_REMINDERS);
      }
    } catch (e) {
      setReminders(DEFAULT_REMINDERS);
    }
  }, [familyCode]);

  const saveReminders = (newRemindersList) => {
    setReminders(newRemindersList);
    try {
      localStorage.setItem(`memoriacare_reminders_${familyCode}`, JSON.stringify(newRemindersList));
    } catch (e) {}
  };

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

    const unknownItem = unknownQueue.find((item) => (item._id || item.id) === unknownId);
    const embedding = unknownItem ? unknownItem.embedding : [];

    try {
      const res = await axios.post(`/api/queue/approve/${unknownId}`, {
        name,
        relationship,
        contextNote,
        embedding
      });

      if (res.data.success) {
        showToast(`Successfully registered ${name} (${relationship})!`, 'success');
        setUnknownQueue((prev) => prev.filter((item) => (item._id || item.id) !== unknownId));

        setFormData((prev) => {
          const updated = { ...prev };
          delete updated[unknownId];
          return updated;
        });

        fetchRegisteredVisitors();
      } else {
        showToast(res.data.message || 'Failed to approve visitor.', 'error');
      }
    } catch (err) {
      console.error('Error approving visitor:', err);
      showToast('Server error while approving visitor.', 'error');
    }
  };

  const handleDismissAlert = async (unknownId) => {
    try {
      const res = await axios.patch(`/api/queue/dismiss/${unknownId}`);
      if (res.data.success) {
        showToast('Alert snapshot dismissed.', 'info');
        setUnknownQueue((prev) => prev.filter((item) => (item._id || item.id) !== unknownId));
      }
    } catch (err) {
      setUnknownQueue((prev) => prev.filter((item) => (item._id || item.id) !== unknownId));
      showToast('Alert snapshot dismissed.', 'info');
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

  const handleAddReminderSubmit = (e) => {
    e.preventDefault();
    if (!newReminder.title) {
      showToast('Please enter a reminder title.', 'error');
      return;
    }

    const item = {
      id: `rem_${Date.now()}`,
      time: newReminder.time,
      title: newReminder.title.trim(),
      note: newReminder.note.trim(),
      category: newReminder.category
    };

    const updated = [...reminders, item];
    saveReminders(updated);
    setShowAddReminder(false);
    setNewReminder({ time: '09:00 AM', title: '', note: '', category: 'Medicine' });
    showToast('Daily reminder added successfully!', 'success');
  };

  const handleDeleteReminder = (id) => {
    const updated = reminders.filter((r) => r.id !== id);
    saveReminders(updated);
    showToast('Reminder removed.', 'info');
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
                Review visitor alerts, manage registered family members & daily timetables
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

        {/* THREE DASHBOARD TABS */}
        <div className="flex items-center border-b border-slate-800 gap-4 overflow-x-auto pb-1">
          <button
            onClick={() => setActiveTab('QUEUE')}
            className={`pb-3 px-2 font-bold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
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
            className={`pb-3 px-2 font-bold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
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
            onClick={() => setActiveTab('TIMETABLE')}
            className={`pb-3 px-2 font-bold text-sm sm:text-base flex items-center gap-2 border-b-2 transition-all cursor-pointer shrink-0 ${
              activeTab === 'TIMETABLE'
                ? 'border-emerald-500 text-emerald-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Calendar className="w-4 h-4" />
            Daily Timetable & Reminders
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 text-xs font-extrabold border border-indigo-500/30">
              {reminders.length}
            </span>
          </button>
        </div>

        {/* TAB 1: UNKNOWN VISITOR ALERTS */}
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
                            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-sm text-white placeholder-slate-500 outline-none transition"
                          />
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-emerald-400" />
                            Relationship <span className="text-rose-400">*</span>
                          </label>
                          <select
                            value={currentForm.relationship || ''}
                            onChange={(e) => handleInputChange(itemId, 'relationship', e.target.value)}
                            className="w-full bg-slate-900 border border-slate-800 focus:border-emerald-500 rounded-xl p-3 text-sm text-white outline-none transition cursor-pointer"
                          >
                            <option value="">-- Select Relationship --</option>
                            {relationshipOptions.map((rel) => (
                              <option key={rel} value={rel}>
                                {rel}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-slate-300 mb-1.5 flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                            Memory Context Note (Spoken Greeting)
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

        {/* TAB 3: DAILY TIMETABLE & REMINDERS */}
        {activeTab === 'TIMETABLE' && (
          <section className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-indigo-400" />
                  Patient Schedule & Timetable
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Daily routine schedule, medication timers, and activities for caregiver oversight
                </p>
              </div>

              <button
                onClick={() => setShowAddReminder(!showAddReminder)}
                className="px-4 py-2 rounded-2xl bg-indigo-600 hover:bg-indigo-500 active:scale-95 transition text-xs font-bold text-white flex items-center gap-2 cursor-pointer shadow-lg"
              >
                <Plus className="w-4 h-4" />
                Add Daily Reminder
              </button>
            </div>

            {showAddReminder && (
              <form
                onSubmit={handleAddReminderSubmit}
                className="bg-slate-950/90 border border-indigo-500/40 rounded-3xl p-6 backdrop-blur-xl shadow-2xl space-y-4 animate-in fade-in slide-in-from-top-4"
              >
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  New Daily Schedule Item
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Time</label>
                    <input
                      type="text"
                      placeholder="e.g. 08:00 AM"
                      value={newReminder.time}
                      onChange={(e) => setNewReminder({ ...newReminder, time: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Category</label>
                    <select
                      value={newReminder.category}
                      onChange={(e) => setNewReminder({ ...newReminder, category: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-white outline-none cursor-pointer"
                    >
                      <option value="Medicine">Medicine 💊</option>
                      <option value="Meal">Meal 🍲</option>
                      <option value="Activity">Activity 🚶‍♂️</option>
                      <option value="Routine">Routine ⏰</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-300 mb-1">Title</label>
                    <input
                      type="text"
                      placeholder="e.g. Morning BP Pill"
                      value={newReminder.title}
                      onChange={(e) => setNewReminder({ ...newReminder, title: e.target.value })}
                      className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">Description / Care Note</label>
                  <input
                    type="text"
                    placeholder="e.g. Take 1 tablet after breakfast with warm water"
                    value={newReminder.note}
                    onChange={(e) => setNewReminder({ ...newReminder, note: e.target.value })}
                    className="w-full bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl p-3 text-sm text-white outline-none"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-xs font-bold text-white transition cursor-pointer"
                  >
                    Save Schedule Item
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowAddReminder(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 transition cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {reminders.length === 0 ? (
              <div className="bg-slate-950/60 border border-slate-800/80 rounded-3xl p-12 flex flex-col items-center justify-center text-center">
                <Calendar className="w-10 h-10 text-indigo-400 mb-4" />
                <h3 className="text-xl font-bold text-white mb-1">No Daily Reminders Set</h3>
                <p className="text-slate-400 text-xs max-w-sm">
                  Click "Add Daily Reminder" above to configure medication times, meal schedules, and patient activities.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {reminders.map((rem) => (
                  <div
                    key={rem.id}
                    className="bg-slate-950/90 border border-slate-800 hover:border-indigo-500/40 rounded-2xl p-5 backdrop-blur-md shadow-lg transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 group"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold shrink-0">
                        {rem.category === 'Medicine' && <Pill className="w-6 h-6 text-rose-400" />}
                        {rem.category === 'Meal' && <Coffee className="w-6 h-6 text-amber-400" />}
                        {rem.category === 'Activity' && <Activity className="w-6 h-6 text-emerald-400" />}
                        {rem.category === 'Routine' && <Heart className="w-6 h-6 text-indigo-400" />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 rounded-md bg-slate-800 text-indigo-300 text-xs font-mono font-bold border border-slate-700">
                            {rem.time}
                          </span>
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-bold border border-indigo-500/30">
                            {rem.category}
                          </span>
                        </div>
                        <h4 className="text-base font-bold text-white mt-1">{rem.title}</h4>
                        {rem.note && <p className="text-xs text-slate-400 mt-0.5">{rem.note}</p>}
                      </div>
                    </div>

                    <button
                      onClick={() => handleDeleteReminder(rem.id)}
                      className="p-2 rounded-xl bg-slate-900 hover:bg-rose-950 text-slate-400 hover:text-rose-300 border border-slate-800 transition cursor-pointer self-end sm:self-center"
                      title="Delete Reminder"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
