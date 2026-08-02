import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import axios from 'axios';
import { Clock } from 'lucide-react';

const normalizeTime = (timeStr) => {
  if (!timeStr) return '';
  let clean = String(timeStr).trim().toLowerCase();

  if (clean.includes('am') || clean.includes('pm')) {
    const isPM = clean.includes('pm');
    let [time] = clean.replace(/(am|pm)/g, '').trim().split(':');
    let hours = parseInt(time, 10);
    const minutes = clean.split(':')[1]?.replace(/(am|pm)/g, '').trim() || '00';
    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;
    return `${hours}:${minutes.padStart(2, '0')}`;
  }

  const [h, m] = clean.split(':');
  return `${parseInt(h, 10)}:${(m || '00').padStart(2, '0')}`;
};

function isSameTime(t1, t2) {
  if (!t1 || !t2) return false;
  return normalizeTime(t1) === normalizeTime(t2);
}

function constructGreeting(visitor, lang) {
  const code = (lang || 'hi').toLowerCase().split('-')[0];
  const name = visitor.name || (code === 'hi' ? 'परिचित' : code === 'mr' ? 'परिचित' : 'visitor');
  const relation = visitor.relationship || (code === 'hi' ? 'परिचित' : code === 'mr' ? 'नातेवाईक' : 'visitor');
  const note = visitor.contextNote ? visitor.contextNote.trim() : '';

  if (code === 'hi') {
    let text = `यह आपके ${relation}, ${name} हैं।`;
    if (note) {
      text += ` याद दिला दें, ${note}`;
    }
    return text;
  } else if (code === 'mr') {
    let text = `हे तुमचे ${relation}, ${name} आहेत।`;
    if (note) {
      text += ` आठवण ठेवा, ${note}`;
    }
    return text;
  } else {
    let text = `This is your ${relation}, ${name}.`;
    if (note) {
      text += ` Quick reminder: ${note}`;
    }
    return text;
  }
}

const constructRoutineGreeting = (routine, lang) => {
  const title = routine.title || 'Scheduled Activity';
  const note = routine.note || routine.contextNote ? (routine.note || routine.contextNote).trim() : '';
  const code = (lang || 'hi').toLowerCase().split('-')[0];

  if (code === 'hi') {
    return `याद दिला दें, अब ${title} का समय हो गया है। ${note}`;
  } else if (code === 'mr') {
    return `आठवण ठेवा, आता ${title} ची वेळ झाली आहे। ${note}`;
  } else {
    return `Quick reminder, it is time for ${title}. ${note}`;
  }
};

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

export default function PatientMirror({ familyCode = 'FAM123', currentLang = 'hi-IN' }) {
  const videoRef = useRef(null);
  const [knownVisitors, setKnownVisitors] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [activeReminder, setActiveReminder] = useState(null);

  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Initializing...');
  const [activeVisitorCard, setActiveVisitorCard] = useState(null);

  const isProcessingRef = useRef(false);
  const spokenUserRef = useRef(null);
  const unknownCounterRef = useRef(0);
  const isSnapshotLockedRef = useRef(false);

  // Minute deduplication lock set
  const triggeredRemindersRef = useRef(new Set());

  // Fetch visitors
  useEffect(() => {
    const fetchVisitors = async () => {
      try {
        if (!familyCode) return;
        const res = await axios.get(`/api/visitors/${familyCode}`);
        const visitorsList = res.data?.data || res.data || [];
        setKnownVisitors(visitorsList);
        setIsDataLoaded(true);
      } catch (err) {
        console.warn('Database fetch warning:', err.message);
        setIsDataLoaded(true);
      }
    };

    fetchVisitors();

    const pollInterval = setInterval(fetchVisitors, 4000);
    return () => clearInterval(pollInterval);
  }, [familyCode]);

  // 2. Fetch routines on mirror mount and poll every 30 seconds
  useEffect(() => {
    const fetchRoutines = async () => {
      try {
        if (!familyCode) return;
        const response = await axios.get(`/api/routines/${familyCode}`);
        const list = response.data?.data || response.data || [];

        // Also check localStorage backup
        const savedLocal = localStorage.getItem(`memoriacare_reminders_${familyCode}`);
        const localList = savedLocal ? JSON.parse(savedLocal) : [];

        const combined = [...list, ...localList];
        const unique = Array.from(new Map(combined.map((item) => [item._id || item.id, item])).values());

        setRoutines(unique);
        console.log('📋 Patient Mirror Loaded Routines:', unique);
      } catch (err) {
        console.error('Failed to load routines on mirror:', err);
      }
    };

    fetchRoutines();
    const routineInterval = setInterval(fetchRoutines, 30000);
    return () => clearInterval(routineInterval);
  }, [familyCode]);

  // 3. Monitor routines schedule with minute deduplication lock
  useEffect(() => {
    const checkSchedule = () => {
      if (!routines || routines.length === 0) return;

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeFormatted = `${currentHours}:${currentMinutes}`;

      const minuteKey = `${currentHours}:${currentMinutes}`;
      if (triggeredRemindersRef.current.minuteKey !== minuteKey) {
        triggeredRemindersRef.current = new Set();
        triggeredRemindersRef.current.minuteKey = minuteKey;
      }

      routines.forEach((routine) => {
        if (routine.isPaused || routine.isAcknowledged) return;

        const schedTime = routine.time || routine.scheduledTime;
        const isTimeMatch = isSameTime(schedTime, currentTimeFormatted);
        const routineId = routine._id || routine.id;

        if (isTimeMatch && !triggeredRemindersRef.current.has(routineId)) {
          console.log('⏰ ROUTINE MATCH FOUND! Triggering Alert:', routine.title);

          triggeredRemindersRef.current.add(routineId);
          setActiveReminder(routine);

          const spokenMsg = constructRoutineGreeting(routine, currentLang);
          speakText(spokenMsg, currentLang);

          setTimeout(() => {
            setActiveReminder(null);
          }, 15000);
        }
      });
    };

    checkSchedule();
    const monitorTimer = setInterval(checkSchedule, 5000);
    return () => clearInterval(monitorTimer);
  }, [routines, currentLang]);

  const startMirrorSystem = async () => {
    if (isCameraStarted) return;
    setIsCameraStarted(true);

    try {
      setStatusMsg('Preparing camera system...');
      const MODEL_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model';

      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);

      setStatusMsg('Starting camera feed...');

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = async () => {
          try {
            await videoRef.current.play();
            setStatusMsg('System Active: Looking into mirror...');
          } catch (e) {
            setStatusMsg('Camera playing...');
          }
        };
      }
    } catch (err) {
      console.error('Camera startup error:', err);
      setStatusMsg('Camera permission needed or device not supported');
    }
  };

  useEffect(() => {
    if (isDataLoaded && !isCameraStarted) {
      startMirrorSystem();
    }
  }, [isDataLoaded]);

  const speakText = (text, lang) => {
    try {
      const targetLang = (lang || 'hi-IN').split('-')[0];
      const audioUrl = `/api/tts/stream?text=${encodeURIComponent(text)}&lang=${targetLang}`;
      const audio = new Audio(audioUrl);

      audio.play().catch(() => {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = lang || 'hi-IN';
          window.speechSynthesis.speak(utterance);
        }
      });
    } catch (err) {
      console.error('Speech synthesis error:', err);
    }
  };

  useEffect(() => {
    let timerId = null;

    const processFrame = async () => {
      if (!videoRef.current || videoRef.current.paused || videoRef.current.ended || isProcessingRef.current) {
        timerId = setTimeout(processFrame, 600);
        return;
      }

      isProcessingRef.current = true;

      try {
        const detection = await faceapi
          .detectSingleFace(videoRef.current, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (detection) {
          const liveDescriptor = Array.from(detection.descriptor);

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
        {/* CAMERA VIDEO DISPLAY CONTAINER */}
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

        {/* TIMETABLE ROUTINE SCHEDULED ALERT OVERLAY */}
        {activeReminder && (
          <div className="mt-4 p-5 bg-indigo-950/90 backdrop-blur-md border border-indigo-500/50 rounded-2xl text-center w-full shadow-2xl animate-in fade-in slide-in-from-bottom-3">
            <div className="flex items-center justify-center gap-2 text-indigo-300 text-xs font-mono font-bold mb-1">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>ROUTINE ALERT ({activeReminder.time || activeReminder.scheduledTime})</span>
            </div>
            <h2 className="text-2xl font-bold text-white">{activeReminder.title}</h2>
            {(activeReminder.note || activeReminder.contextNote) && (
              <p className="text-indigo-200 text-sm mt-2 border-t border-indigo-800/80 pt-2 italic">
                "{activeReminder.note || activeReminder.contextNote}"
              </p>
            )}
          </div>
        )}

        {/* VISITOR MEMORY CUE CARD */}
        {activeVisitorCard && (
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
