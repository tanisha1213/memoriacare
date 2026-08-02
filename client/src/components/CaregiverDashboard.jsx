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
  Pill,
  Sun,
  Coffee,
  Utensils,
  Heart,
  Moon,
  PauseCircle,
  PlayCircle,
  Edit2,
  Bell
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
    osc1.frequency.setValueAtTime(880, ctx.currentTime);
    osc1.frequency.setValueAtTime(1046.5, ctx.currentTime + 0.15);

    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(440, ctx.currentTime);

    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);

    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(ctx.currentTime);
    osc2.start(ctx.currentTime);

    osc1.stop(ctx.currentTime + 0.6);
    osc2.stop(ctx.currentTime + 0.6);
  } catch (e) {
    console.warn('Web Audio Playback failed:', e);
  }
}

function format24to12(time24) {
  if (!time24) return '';
  const [hStr, mStr] = time24.split(':');
  let h = parseInt(hStr, 10);
  const m = mStr || '00';
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

const PRESET_ACTIVITIES = [
  { name: 'Wake up', time: '07:00', msg: 'Good morning! Time to wake up and start a fresh new day.', icon: 'Sun', priority: 'NORMAL' },
  { name: 'Brush teeth', time: '07:30', msg: 'Time to brush your teeth and refresh.', icon: 'Sun', priority: 'NORMAL' },
  { name: 'Breakfast', time: '08:00', msg: 'Breakfast is ready! Please have a warm meal.', icon: 'Coffee', priority: 'IMPORTANT' },
  { name: 'Medicine reminder', time: '09:00', msg: 'Good morning. It is 9:00 AM. It is time for your medicine.', icon: 'Pill', priority: 'URGENT' },
  { name: 'Morning walk', time: '10:30', msg: 'Time for a gentle morning walk and fresh air.', icon: 'Heart', priority: 'NORMAL' },
  { name: 'Lunch', time: '13:00', msg: 'It is 1:00 PM. Lunch is ready for you.', icon: 'Utensils', priority: 'IMPORTANT' },
  { name: 'Evening snack', time: '16:00', msg: 'Time for a light afternoon snack and tea.', icon: 'Coffee', priority: 'NORMAL' },
  { name: 'Family time', time: '18:00', msg: 'It is 6:00 PM. Family time and relaxing together.', icon: 'Heart', priority: 'NORMAL' },
  { name: 'Dinner', time: '20:00', msg: 'Dinner time! Enjoy a healthy evening meal.', icon: 'Utensils', priority: 'IMPORTANT' },
  { name: 'Prepare for sleep', time: '21:30', msg: 'It is 9:30 PM. Time to wind down and prepare for sleep.', icon: 'Moon', priority: 'NORMAL' }
];

export default function CaregiverDashboard({ familyCode = 'FAM123' }) {
  const [activeTab, setActiveTab] = useState('QUEUE');
  const [unknownQueue, setUnknownQueue] = useState([]);
  const [registeredVisitors, setRegisteredVisitors] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isPolling, setIsPolling] = useState(true);
  const [toast, setToast] = useState(null);

  const prevQueueLengthRef = useRef(0);

  // Form State for Approval
  const [approvingId, setApprovingId] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    relationship: 'Family Member',
    contextNote: ''
  });

  // Routine Modal & Form State
  const [isRoutineModalOpen, setIsRoutineModalOpen] = useState(false);
  const [editingRoutineId, setEditingRoutineId] = useState(null);
  const [routineForm, setRoutineForm] = useState({
    activityName: '',
    time: '09:00',
    reminderMessage: '',
    repeatFrequency: 'EVERY_DAY',
    priority: 'NORMAL',
    voiceReminder: true,
    notifyCaregiver: true,
    unackTimeoutMinutes: 5
  });

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchDashboardData = useCallback(
    async (showSilent = false) => {
      if (!showSilent) setLoading(true);
      try {
        const [queueRes, visRes, routRes] = await Promise.all([
          axios.get(`/api/visitors/${familyCode}/unknowns`),
          axios.get(`/api/visitors/${familyCode}`),
          axios.get(`/api/routines/${familyCode}`)
        ]);

        const newQueue = Array.isArray(queueRes.data) ? queueRes.data : [];
        if (newQueue.length > prevQueueLengthRef.current && prevQueueLengthRef.current !== 0) {
          playAlertChime();
          showToast(`🚨 ALERT: New visitor detected! Review required.`, 'warning');
          if (Notification.permission === 'granted') {
            new Notification('MemoriaCare Alert', {
              body: 'An unidentified visitor snapshot was captured.',
              icon: '/favicon.ico'
            });
          }
        }
        prevQueueLengthRef.current = newQueue.length;

        setUnknownQueue(newQueue);
        setRegisteredVisitors(Array.isArray(visRes.data) ? visRes.data : []);
        setRoutines(Array.isArray(routRes.data) ? routRes.data : []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
      } finally {
        if (!showSilent) setLoading(false);
      }
    },
    [familyCode]
  );

  useEffect(() => {
    fetchDashboardData();
    let intervalId = null;
    if (isPolling) {
      intervalId = setInterval(() => fetchDashboardData(true), 4000);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [fetchDashboardData, isPolling]);

  // Request Notification Permissions
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

  // 1. Visitor Approval Handler
  const handleApprove = async (id, embedding) => {
    if (!formData.name.trim()) {
      showToast('Please enter the visitor name', 'error');
      return;
    }
    try {
      await axios.post(`/api/queue/approve/${id}`, {
        name: formData.name.trim(),
        relationship: formData.relationship,
        contextNote: formData.contextNote.trim(),
        familyCode,
        embedding
      });
      showToast(`Registered ${formData.name} as ${formData.relationship}`);
      setApprovingId(null);
      setFormData({ name: '', relationship: 'Family Member', contextNote: '' });
      fetchDashboardData(true);
    } catch (err) {
      console.error('Error approving visitor:', err);
      showToast('Failed to register visitor', 'error');
    }
  };

  // 2. Dismiss Unknown Snapshot
  const handleDismiss = async (id) => {
    try {
      await axios.patch(`/api/queue/dismiss/${id}`);
      showToast('Snapshot dismissed');
      fetchDashboardData(true);
    } catch (err) {
      showToast('Failed to dismiss snapshot', 'error');
    }
  };

  // 3. Delete Registered Member
  const handleDeleteMember = async (id, name) => {
    if (!window.confirm(`Are you sure you want to remove ${name} from registered family members?`)) return;
    try {
      await axios.delete(`/api/visitors/${id}`);
      showToast(`Removed ${name} from family members`);
      fetchDashboardData(true);
    } catch (err) {
      showToast('Failed to remove visitor', 'error');
    }
  };

  // 4. Routine Modal Handlers
  const openNewRoutineModal = (preset = null) => {
    setEditingRoutineId(null);
    if (preset) {
      setRoutineForm({
        activityName: preset.name,
        time: preset.time,
        reminderMessage: preset.msg,
        repeatFrequency: 'EVERY_DAY',
        priority: preset.priority || 'NORMAL',
        voiceReminder: true,
        notifyCaregiver: preset.priority === 'URGENT' || preset.priority === 'IMPORTANT',
        unackTimeoutMinutes: 5
      });
    } else {
      setRoutineForm({
        activityName: '',
        time: '09:00',
        reminderMessage: '',
        repeatFrequency: 'EVERY_DAY',
        priority: 'NORMAL',
        voiceReminder: true,
        notifyCaregiver: true,
        unackTimeoutMinutes: 5
      });
    }
    setIsRoutineModalOpen(true);
  };

  const openEditRoutineModal = (routine) => {
    setEditingRoutineId(routine._id || routine.id);
    setRoutineForm({
      activityName: routine.activityName,
      time: routine.time,
      reminderMessage: routine.reminderMessage,
      repeatFrequency: routine.repeatFrequency || 'EVERY_DAY',
      priority: routine.priority || 'NORMAL',
      voiceReminder: routine.voiceReminder !== false,
      notifyCaregiver: routine.notifyCaregiver !== false,
      unackTimeoutMinutes: routine.unackTimeoutMinutes || 5
    });
    setIsRoutineModalOpen(true);
  };

  const handleSaveRoutine = async (e) => {
    e.preventDefault();
    if (!routineForm.activityName.trim() || !routineForm.time || !routineForm.reminderMessage.trim()) {
      showToast('Activity name, time, and reminder message are required', 'error');
      return;
    }

    try {
      if (editingRoutineId) {
        await axios.put(`/api/routines/${editingRoutineId}`, routineForm);
        showToast('Routine updated successfully!');
      } else {
        await axios.post(`/api/routines/${familyCode}`, routineForm);
        showToast(`Added routine: ${routineForm.activityName}`);
      }
      setIsRoutineModalOpen(false);
      fetchDashboardData(true);
    } catch (err) {
      showToast('Failed to save routine', 'error');
    }
  };

  const handleTogglePauseRoutine = async (id) => {
    try {
      await axios.patch(`/api/routines/${id}/toggle`);
      showToast('Updated routine state');
      fetchDashboardData(true);
    } catch (err) {
      showToast('Failed to toggle routine state', 'error');
    }
  };

  const handleDeleteRoutine = async (id, name) => {
    if (!window.confirm(`Delete routine "${name}"?`)) return;
    try {
      await axios.delete(`/api/routines/${id}`);
      showToast(`Deleted routine "${name}"`);
      fetchDashboardData(true);
    } catch (err) {
      showToast('Failed to delete routine', 'error');
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 font-sans">
      {/* TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 px-5 py-3 rounded-2xl shadow-2xl backdrop-blur-md border font-semibold flex items-center gap-3 animate-in slide-in-from-top-5 duration-300 ${
            toast.type === 'error'
              ? 'bg-rose-950/90 border-rose-800 text-rose-200'
              : toast.type === 'warning'
              ? 'bg-amber-950/90 border-amber-800 text-amber-200'
              : 'bg-emerald-950/90 border-emerald-800 text-emerald-200'
          }`}
        >
          {toast.type === 'error' ? (
            <XCircle className="w-5 h-5 text-rose-400" />
          ) : toast.type === 'warning' ? (
            <ShieldAlert className="w-5 h-5 text-amber-400" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto space-y-6">
        {/* HEADER BAR */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-800 shadow-xl">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Caregiver Portal</h1>
              <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-mono font-bold rounded-full">
                Code: {familyCode}
              </span>
            </div>
            <p className="text-slate-400 text-sm mt-1">Review visitor alerts & manage daily routine timetable</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={playAlertChime}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-slate-200 text-xs font-bold rounded-xl border border-slate-700 transition flex items-center gap-2"
              title="Test audio chime synthesizer"
            >
              <Volume2 className="w-4 h-4 text-emerald-400" />
              <span>Test Audio</span>
            </button>

            <button
              onClick={() => setIsPolling(!isPolling)}
              className={`px-4 py-2 text-xs font-bold rounded-xl border transition flex items-center gap-2 ${
                isPolling
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
              }`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isPolling ? 'animate-spin' : ''}`} />
              <span>{isPolling ? 'Live Syncing' : 'Sync Paused'}</span>
            </button>
          </div>
        </div>

        {/* TAB NAVIGATION */}
        <div className="flex items-center gap-2 p-1.5 bg-slate-900/90 rounded-2xl border border-slate-800 w-full sm:w-auto overflow-x-auto">
          <button
            onClick={() => setActiveTab('QUEUE')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2.5 ${
              activeTab === 'QUEUE'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>Visitor Alerts</span>
            {unknownQueue.length > 0 && (
              <span className="px-2 py-0.5 text-xs rounded-full font-bold bg-rose-500 text-white animate-pulse">
                {unknownQueue.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('ROUTINE')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2.5 ${
              activeTab === 'ROUTINE'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>Daily Timetable</span>
            <span className="px-2 py-0.5 text-xs rounded-full font-bold bg-slate-800 text-slate-300">
              {routines.length}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('REGISTERED')}
            className={`flex-1 sm:flex-initial px-5 py-2.5 rounded-xl font-bold text-sm transition flex items-center justify-center gap-2.5 ${
              activeTab === 'REGISTERED'
                ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Registered Members</span>
            <span className="px-2 py-0.5 text-xs rounded-full font-bold bg-slate-800 text-slate-300">
              {registeredVisitors.length}
            </span>
          </button>
        </div>

        {/* TAB 1: VISITOR ALERTS QUEUE */}
        {activeTab === 'QUEUE' && (
          <div className="space-y-4">
            {unknownQueue.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800/60 flex flex-col items-center justify-center">
                <CheckCircle2 className="w-16 h-16 text-emerald-500/40 mb-3" />
                <h3 className="text-xl font-bold text-slate-300">All Visitor Alerts Clear</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm">
                  No unidentified snapshots pending review. The patient mirror is monitoring in real-time.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {unknownQueue.map((item) => {
                  const itemId = item._id || item.id;
                  const isApproving = approvingId === itemId;

                  return (
                    <div
                      key={itemId}
                      className="bg-slate-900/90 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col justify-between"
                    >
                      <div className="p-5 space-y-4">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-bold rounded-full flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" />
                            {getRelativeTime(item.timestamp)}
                          </span>
                          <span className="text-xs font-semibold text-slate-400">Snapshot Captured</span>
                        </div>

                        {item.photoThumbnail ? (
                          <div className="relative rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 aspect-video flex items-center justify-center">
                            <img
                              src={item.photoThumbnail}
                              alt="Unidentified Visitor"
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="p-6 bg-amber-950/20 border border-amber-800/40 rounded-2xl text-amber-300 text-sm font-semibold">
                            ⚠️ Unacknowledged Routine Escalation Alert: {item.unackActivity}
                          </div>
                        )}

                        {isApproving ? (
                          <div className="space-y-3 bg-slate-950/60 p-4 rounded-2xl border border-slate-800">
                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Full Name *
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Rahul Patil"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Relationship
                              </label>
                              <select
                                value={formData.relationship}
                                onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 text-sm font-medium focus:outline-none focus:border-emerald-500"
                              >
                                <option value="Son">Son</option>
                                <option value="Daughter">Daughter</option>
                                <option value="Spouse">Spouse</option>
                                <option value="Brother">Brother</option>
                                <option value="Sister">Sister</option>
                                <option value="Grandchild">Grandchild</option>
                                <option value="Doctor">Doctor / Physician</option>
                                <option value="Nurse">Nurse / Caregiver</option>
                                <option value="Friend">Friend</option>
                                <option value="Neighbor">Neighbor</option>
                              </select>
                            </div>

                            <div>
                              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                                Memory Note (Spoken Context)
                              </label>
                              <input
                                type="text"
                                placeholder="e.g. Brings fresh fruits every Sunday"
                                value={formData.contextNote}
                                onChange={(e) => setFormData({ ...formData, contextNote: e.target.value })}
                                className="w-full px-3.5 py-2.5 bg-slate-900 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 text-sm font-medium focus:outline-none focus:border-emerald-500"
                              />
                            </div>

                            <div className="flex gap-2 pt-2">
                              <button
                                onClick={() => handleApprove(itemId, item.embedding)}
                                className="flex-1 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
                              >
                                <UserCheck className="w-4 h-4" />
                                Save & Register
                              </button>
                              <button
                                onClick={() => setApprovingId(null)}
                                className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>

                      {!isApproving && (
                        <div className="p-4 bg-slate-950/40 border-t border-slate-800 flex gap-2">
                          <button
                            onClick={() => {
                              setApprovingId(itemId);
                              setFormData({ name: '', relationship: 'Family Member', contextNote: '' });
                            }}
                            className="flex-1 py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
                          >
                            <UserPlus className="w-4 h-4" />
                            Register Visitor
                          </button>
                          <button
                            onClick={() => handleDismiss(itemId)}
                            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2"
                          >
                            <XCircle className="w-4 h-4" />
                            Dismiss
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: DAILY TIMETABLE & ROUTINE SETUP */}
        {activeTab === 'ROUTINE' && (
          <div className="space-y-6">
            {/* ACTION BAR & PRESETS */}
            <div className="bg-slate-900/80 p-5 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-emerald-400" />
                    Patient Daily Schedule
                  </h2>
                  <p className="text-slate-400 text-xs mt-0.5">
                    Automated activity reminders displayed and spoken aloud on scheduled times
                  </p>
                </div>

                <button
                  onClick={() => openNewRoutineModal()}
                  className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-bold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Add Custom Reminder
                </button>
              </div>

              {/* QUICK PRESETS */}
              <div className="pt-2 border-t border-slate-800">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Quick Add Activity Presets:
                </span>
                <div className="flex flex-wrap gap-2">
                  {PRESET_ACTIVITIES.map((preset) => (
                    <button
                      key={preset.name}
                      onClick={() => openNewRoutineModal(preset)}
                      className="px-3 py-1.5 bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/60 rounded-xl text-xs font-semibold transition flex items-center gap-1.5"
                    >
                      <Plus className="w-3 h-3 text-emerald-400" />
                      <span>{preset.name} ({format24to12(preset.time)})</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ROUTINE LIST */}
            {routines.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800/60 flex flex-col items-center justify-center">
                <Clock className="w-16 h-16 text-emerald-500/40 mb-3" />
                <h3 className="text-xl font-bold text-slate-300">No Daily Reminders Configured</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm">
                  Click "Add Custom Reminder" or select a Quick Add Preset above to create a daily timetable.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {routines.map((item) => {
                  const routineId = item._id || item.id;
                  const isPaused = item.isPaused;

                  return (
                    <div
                      key={routineId}
                      className={`p-5 rounded-3xl border transition shadow-xl flex flex-col justify-between ${
                        isPaused
                          ? 'bg-slate-900/40 border-slate-800/60 opacity-60'
                          : 'bg-slate-900/90 border-slate-800'
                      }`}
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-mono font-extrabold rounded-xl">
                              {format24to12(item.time)}
                            </span>
                            {item.priority === 'URGENT' && (
                              <span className="px-2.5 py-0.5 bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold rounded-full">
                                URGENT
                              </span>
                            )}
                            {item.priority === 'IMPORTANT' && (
                              <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-bold rounded-full">
                                IMPORTANT
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleTogglePauseRoutine(routineId)}
                              className="p-2 text-slate-400 hover:text-white rounded-lg transition"
                              title={isPaused ? 'Resume Reminder' : 'Pause Reminder'}
                            >
                              {isPaused ? <PlayCircle className="w-5 h-5 text-emerald-400" /> : <PauseCircle className="w-5 h-5 text-amber-400" />}
                            </button>
                            <button
                              onClick={() => openEditRoutineModal(item)}
                              className="p-2 text-slate-400 hover:text-white rounded-lg transition"
                              title="Edit Routine"
                            >
                              <Edit2 className="w-4 h-4 text-slate-300" />
                            </button>
                            <button
                              onClick={() => handleDeleteRoutine(routineId, item.activityName)}
                              className="p-2 text-slate-400 hover:text-rose-400 rounded-lg transition"
                              title="Delete Routine"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div>
                          <h3 className="text-xl font-bold text-white tracking-tight">{item.activityName}</h3>
                          <p className="text-slate-300 text-sm mt-1 bg-slate-950/60 p-3 rounded-xl border border-slate-800 italic">
                            "{item.reminderMessage}"
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-medium">
                        <span>Repeat: {item.repeatFrequency || 'Every day'}</span>
                        {item.notifyCaregiver && (
                          <span className="flex items-center gap-1 text-emerald-400">
                            <Bell className="w-3.5 h-3.5" /> Caregiver Escalation On
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: REGISTERED FAMILY MEMBERS */}
        {activeTab === 'REGISTERED' && (
          <div className="space-y-4">
            {registeredVisitors.length === 0 ? (
              <div className="p-12 text-center bg-slate-900/40 rounded-3xl border border-slate-800/60 flex flex-col items-center justify-center">
                <Users className="w-16 h-16 text-slate-600/40 mb-3" />
                <h3 className="text-xl font-bold text-slate-300">No Family Members Registered</h3>
                <p className="text-slate-500 text-sm mt-1 max-w-sm">
                  Unidentified visitor snapshots will appear under "Visitor Alerts" when detected by the camera mirror.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                {registeredVisitors.map((member) => {
                  const memberId = member._id || member.id;
                  return (
                    <div
                      key={memberId}
                      className="bg-slate-900/90 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col justify-between space-y-4"
                    >
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-xs font-bold rounded-full">
                            {member.relationship}
                          </span>
                          <button
                            onClick={() => handleDeleteMember(memberId, member.name)}
                            className="p-1.5 text-slate-500 hover:text-rose-400 rounded-lg transition"
                            title="Delete Family Member"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>

                        {member.photoThumbnail && (
                          <div className="w-full aspect-video rounded-2xl overflow-hidden border border-slate-800 bg-slate-950">
                            <img src={member.photoThumbnail} alt={member.name} className="w-full h-full object-cover" />
                          </div>
                        )}

                        <div>
                          <h3 className="text-lg font-bold text-white">{member.name}</h3>
                          {member.contextNote && (
                            <p className="text-slate-400 text-xs mt-1 italic">"{member.contextNote}"</p>
                          )}
                        </div>
                      </div>

                      <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-500 font-mono">
                        Registered Member
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ROUTINE MODAL OVERLAY */}
      {isRoutineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <h3 className="text-xl font-extrabold text-white">
                {editingRoutineId ? 'Edit Routine Reminder' : 'Add Daily Routine Reminder'}
              </h3>
              <button
                onClick={() => setIsRoutineModalOpen(false)}
                className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-800"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveRoutine} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Activity Name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Medicine reminder"
                  value={routineForm.activityName}
                  onChange={(e) => setRoutineForm({ ...routineForm, activityName: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Scheduled Time *
                  </label>
                  <input
                    type="time"
                    value={routineForm.time}
                    onChange={(e) => setRoutineForm({ ...routineForm, time: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Priority
                  </label>
                  <select
                    value={routineForm.priority}
                    onChange={(e) => setRoutineForm({ ...routineForm, priority: e.target.value })}
                    className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-emerald-500"
                  >
                    <option value="NORMAL">Normal</option>
                    <option value="IMPORTANT">Important</option>
                    <option value="URGENT">Urgent (Medicine)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block mb-1">
                  Spoken Reminder Message *
                </label>
                <textarea
                  rows="2"
                  placeholder="e.g. Good morning. It is 9:00 AM. It is time for your medicine."
                  value={routineForm.reminderMessage}
                  onChange={(e) => setRoutineForm({ ...routineForm, reminderMessage: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-white text-sm font-medium focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={routineForm.voiceReminder}
                    onChange={(e) => setRoutineForm({ ...routineForm, voiceReminder: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <span>Voice TTS Announcement</span>
                </label>

                <label className="flex items-center gap-2 text-xs font-bold text-slate-300 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={routineForm.notifyCaregiver}
                    onChange={(e) => setRoutineForm({ ...routineForm, notifyCaregiver: e.target.checked })}
                    className="w-4 h-4 rounded text-emerald-500 focus:ring-emerald-500 bg-slate-950 border-slate-700"
                  />
                  <span>Escalate if Unacknowledged</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4 border-t border-slate-800">
                <button
                  type="submit"
                  className="flex-1 py-3 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 font-extrabold text-sm rounded-xl transition flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Save Routine
                </button>
                <button
                  type="button"
                  onClick={() => setIsRoutineModalOpen(false)}
                  className="px-5 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-sm rounded-xl transition"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
