import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import axios from 'axios';
import { Bell, CheckCircle2, Clock, Pill, Sun, Coffee, Utensils, Heart, Moon, Smile } from 'lucide-react';

function constructGreeting(visitor, lang) {
  const code = (lang || 'hi').toLowerCase().split('-')[0];
  const name = visitor.name || (code === 'hi' ? 'परिचित' : code === 'mr' ? 'परिचित' : 'visitor');
  const relation = visitor.relationship || (code === 'hi' ? 'परिचित' : code === 'mr' ? 'नातेवाईक' : 'visitor');
  const note = visitor.contextNote ? visitor.contextNote.trim() : '';

  if (code === 'hi') {
    let text = `यह आपके ${relation}, ${name} हैं।`;
    if (note) text += ` याद दिला दें, ${note}`;
    return text;
  } else if (code === 'mr') {
    let text = `हे तुमचे ${relation}, ${name} आहेत।`;
    if (note) text += ` आठवण ठेवा, ${note}`;
    return text;
  } else {
    let text = `This is your ${relation}, ${name}.`;
    if (note) text += ` Quick reminder: ${note}`;
    return text;
  }
}

function getUnknownAlertText(lang) {
  const code = (lang || 'hi').toLowerCase().split('-')[0];
  if (code === 'mr') {
    return 'एक नवीन व्यक्ती आली आहे. काळजीवाहू व्यक्तीला सूचना पाठवली आहे.';
  } else if (code === 'hi') {
    return 'एक नए व्यक्ति आए हैं। देखभाल करने वाले को सूचना भेज दी गई है।';
  } else {
    return 'A new visitor has arrived. Notification sent to caregiver.';
  }
}

// Activity Icon Matcher
function getActivityIcon(name = '') {
  const lower = name.toLowerCase();
  if (lower.includes('med') || lower.includes('pill') || lower.includes('दवा')) return <Pill className="w-10 h-10 text-emerald-400 animate-pulse" />;
  if (lower.includes('wake') || lower.includes('morning') || lower.includes('सुबह')) return <Sun className="w-10 h-10 text-amber-400" />;
  if (lower.includes('breakfast') || lower.includes('snack') || lower.includes('tea')) return <Coffee className="w-10 h-10 text-amber-500" />;
  if (lower.includes('lunch') || lower.includes('dinner') || lower.includes('food')) return <Utensils className="w-10 h-10 text-sky-400" />;
  if (lower.includes('walk') || lower.includes('family')) return <Heart className="w-10 h-10 text-rose-400" />;
  if (lower.includes('sleep') || lower.includes('night') || lower.includes('रात')) return <Moon className="w-10 h-10 text-purple-400" />;
  return <Bell className="w-10 h-10 text-amber-400 animate-bounce" />;
}

export default function PatientMirror({ familyCode = 'FAM123', currentLang = 'hi-IN' }) {
  const videoRef = useRef(null);
  const [knownVisitors, setKnownVisitors] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Initializing...');
  const [activeVisitorCard, setActiveVisitorCard] = useState(null);
  const [activeRoutineOverlay, setActiveRoutineOverlay] = useState(null);

  const isProcessingRef = useRef(false);
  const spokenUserRef = useRef(null);
  const spokenRoutineRef = useRef(null);
  const unknownCounterRef = useRef(0);
  const isSnapshotLockedRef = useRef(false);

  const speakText = (text, lang) => {
    try {
      const targetLang = (lang || 'hi').toLowerCase().split('-')[0];
      const audioUrl = `/api/tts/stream?text=${encodeURIComponent(text)}&lang=${targetLang}`;
      const audio = new Audio(audioUrl);
      audio.play().catch((e) => console.warn('Audio play notice:', e));
    } catch (err) {
      console.warn('TTS streaming error:', err);
    }
  };

  // 1. Fetch Visitors & Routines
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [visRes, routRes] = await Promise.all([
          axios.get(`/api/visitors/${familyCode}`),
          axios.get(`/api/routines/${familyCode}`)
        ]);
        if (visRes.data) setKnownVisitors(visRes.data);
        if (routRes.data) setRoutines(routRes.data);
        setIsDataLoaded(true);
      } catch (err) {
        console.warn('Data fetch warning:', err);
        setIsDataLoaded(true);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, [familyCode]);

  // 2. Scheduled Routine 15s Clock Checker Loop
  useEffect(() => {
    const checkRoutines = () => {
      if (!routines || routines.length === 0) return;

      const now = new Date();
      const currentHHMM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      // Match routine by time that is active and not paused
      const matched = routines.find((r) => r.time === currentHHMM && !r.isPaused);

      if (matched) {
        const routineId = `${matched._id || matched.id}_${currentHHMM}`;
        if (spokenRoutineRef.current !== routineId) {
          spokenRoutineRef.current = routineId;
          setActiveRoutineOverlay(matched);

          // Speak vocal reminder automatically
          if (matched.voiceReminder !== false) {
            console.log('🗣️ Speaking Scheduled Routine Reminder:', matched.reminderMessage);
            speakText(matched.reminderMessage, currentLang);
          }

          // Schedule unacknowledged alert escalation if notification enabled
          if (matched.notifyCaregiver && matched.priority !== 'NORMAL') {
            const timeoutMs = (matched.unackTimeoutMinutes || 2) * 60 * 1000;
            setTimeout(() => {
              // Check if overlay is still open / unacknowledged
              setActiveRoutineOverlay((current) => {
                if (current && (current._id === matched._id || current.id === matched.id)) {
                  axios.post('/api/routines/unacknowledged-alert', {
                    familyCode,
                    activityName: matched.activityName,
                    reminderMessage: matched.reminderMessage,
                    priority: matched.priority
                  }).catch(() => {});
                }
                return current;
              });
            }, timeoutMs);
          }
        }
      }
    };

    checkRoutines();
    const routineTimer = setInterval(checkRoutines, 15000);
    return () => clearInterval(routineTimer);
  }, [routines, currentLang, familyCode]);

  // 3. Initialize Face API Neural Models & Camera
  useEffect(() => {
    let isMounted = true;

    const initCameraAndAI = async () => {
      try {
        setStatusMsg('Preparing camera system...');
        const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
        ]);

        if (!isMounted) return;

        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          setIsCameraStarted(true);
          setStatusMsg('Camera Active');
        }
      } catch (err) {
        console.error('Camera/AI init error:', err);
        if (isMounted) setStatusMsg('Camera access standard check');
      }
    };

    if (isDataLoaded) {
      initCameraAndAI();
    }

    return () => {
      isMounted = false;
    };
  }, [isDataLoaded]);

  // 4. Main 600ms Recognition Loop
  useEffect(() => {
    let timerId = null;

    const processFrame = async () => {
      if (!videoRef.current || isProcessingRef.current || !isCameraStarted) return;
      isProcessingRef.current = true;

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          setActiveVisitorCard(null);
          isProcessingRef.current = false;
          timerId = setTimeout(processFrame, 600);
          return;
        }

        const liveDescriptor = detection.descriptor;
        let bestMatch = null;
        let minDistance = 1.0;

        knownVisitors.forEach((visitor) => {
          const emb = visitor.embedding;
          const vec = Array.isArray(emb) ? emb : typeof emb === 'object' && emb !== null ? Object.values(emb) : [];
          if (vec.length === 128) {
            let sumSq = 0;
            for (let i = 0; i < 128; i++) {
              sumSq += (liveDescriptor[i] - Number(vec[i])) ** 2;
            }
            const dist = Math.sqrt(sumSq);
            if (dist < minDistance) {
              minDistance = dist;
              bestMatch = visitor;
            }
          }
        });

        if (bestMatch && minDistance < 0.55) {
          unknownCounterRef.current = 0;
          setActiveVisitorCard(bestMatch);

          const visitorId = bestMatch._id || bestMatch.id;
          if (spokenUserRef.current !== visitorId) {
            spokenUserRef.current = visitorId;
            const greeting = constructGreeting(bestMatch, currentLang);
            console.log('🗣️ Speaking Memory Cue:', greeting);
            speakText(greeting, currentLang);
          }
        } else {
          setActiveVisitorCard(null);
          unknownCounterRef.current += 1;

          if (unknownCounterRef.current >= 2 && !isSnapshotLockedRef.current) {
            isSnapshotLockedRef.current = true;

            const canvas = document.createElement('canvas');
            canvas.width = videoRef.current.videoWidth || 640;
            canvas.height = videoRef.current.videoHeight || 480;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
            const imageBase64 = canvas.toDataURL('image/jpeg', 0.7);

            if (spokenUserRef.current !== 'UNKNOWN') {
              spokenUserRef.current = 'UNKNOWN';
              const alertMsg = getUnknownAlertText(currentLang);
              speakText(alertMsg, currentLang);
            }

            try {
              const payload = {
                familyCode,
                photoThumbnail: imageBase64,
                embedding: liveDescriptor
              };
              await axios.post('/api/queue/unknown', payload);
            } catch (postErr) {
              console.error('Error posting unknown snapshot:', postErr);
            }

            setTimeout(() => {
              isSnapshotLockedRef.current = false;
              unknownCounterRef.current = 0;
            }, 20000);
          }
        }
      } catch (err) {
        console.error('Frame processing error:', err);
      }

      isProcessingRef.current = false;
      timerId = setTimeout(processFrame, 600);
    };

    if (isCameraStarted) {
      processFrame();
    }

    return () => clearTimeout(timerId);
  }, [isCameraStarted, knownVisitors, familyCode, currentLang]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-slate-950 p-4 text-slate-100 font-sans">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* VIDEO DISPLAY CONTAINER */}
        <div className="relative w-full rounded-2xl overflow-hidden border-4 border-slate-800 shadow-2xl bg-slate-900 min-h-[320px] flex items-center justify-center">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover block -scale-x-1"
            style={{ minHeight: '320px', transform: 'scaleX(-1)' }}
          />
        </div>

        <p className="mt-3 text-slate-400 text-xs font-medium uppercase tracking-wider">{statusMsg}</p>

        {/* SCHEDULED ROUTINE REMINDER OVERLAY (LARGE ACCESSIBLE CARD) */}
        {activeRoutineOverlay && (
          <div className="mt-4 p-6 bg-slate-900/95 backdrop-blur-xl border-2 border-emerald-500 rounded-3xl text-center w-full shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-center mb-3">
              <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-2xl">
                {getActivityIcon(activeRoutineOverlay.activityName)}
              </div>
            </div>
            
            <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 rounded-full text-xs font-bold uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5" />
              <span>{activeRoutineOverlay.time} Scheduled Activity</span>
            </div>

            <h2 className="text-3xl font-extrabold text-white tracking-tight">{activeRoutineOverlay.activityName}</h2>
            <p className="text-slate-200 font-medium text-lg mt-2 leading-relaxed bg-slate-800/60 p-4 rounded-2xl border border-slate-700/60">
              "{activeRoutineOverlay.reminderMessage}"
            </p>

            <button
              onClick={() => setActiveRoutineOverlay(null)}
              className="mt-5 w-full py-4 bg-emerald-500 hover:bg-emerald-600 active:scale-98 text-slate-950 font-extrabold text-xl rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-7 h-7" />
              <span>I'm Done / Clear</span>
            </button>
          </div>
        )}

        {/* VISITOR RECOGNITION CUE CARD FOR PATIENT */}
        {activeVisitorCard && !activeRoutineOverlay && (
          <div className="mt-4 p-5 bg-slate-900/90 backdrop-blur-md border border-slate-700 rounded-2xl text-center w-full shadow-2xl animate-in fade-in">
            <h2 className="text-2xl font-bold text-white">{activeVisitorCard.name}</h2>
            <p className="text-emerald-400 font-semibold text-lg">{activeVisitorCard.relationship}</p>
            {activeVisitorCard.contextNote && (
              <p className="text-slate-300 text-sm mt-2 border-t border-slate-800 pt-2 italic">
                "{activeVisitorCard.contextNote}"
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
