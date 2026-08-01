import React, { useEffect, useRef, useState } from 'react';
import * as faceapi from '@vladmandic/face-api';
import axios from 'axios';

// Multi-language text generator helpers
function getGreetingText(visitor, lang) {
  const code = (lang || 'hi').toLowerCase().split('-')[0];
  const relationship = visitor.relationship || (code === 'hi' ? 'परिचित' : code === 'mr' ? 'नातेवाईक' : 'visitor');
  const name = visitor.name || '';

  if (code === 'mr') {
    return `हे तुमचे ${relationship}, ${name} आहेत.`;
  } else if (code === 'hi') {
    return `यह आपके ${relationship}, ${name} हैं।`;
  } else {
    return `This is your ${relationship}, ${name}.`;
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

export default function PatientMirror({ familyCode = 'FAM123', currentLang = 'hi-IN' }) {
  const videoRef = useRef(null);
  const [knownVisitors, setKnownVisitors] = useState([]);
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  const [isCameraStarted, setIsCameraStarted] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Initializing...');
  const [activeVisitorCard, setActiveVisitorCard] = useState(null);

  const isProcessingRef = useRef(false);
  const spokenUserRef = useRef(null);
  const unknownCounterRef = useRef(0);
  const isSnapshotLockedRef = useRef(false);

  // 1. Fetch Registered Visitors & Poll for Real-Time Updates (Every 4s)
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

    // 🔄 REAL-TIME VECTOR POLLING: Syncs newly approved caregiver profiles automatically every 4 seconds!
    const pollInterval = setInterval(fetchVisitors, 4000);
    return () => clearInterval(pollInterval);
  }, [familyCode]);

  // 2. Hardware Camera Init
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
            setStatusMsg('Camera Active & Monitoring');
          } catch (pErr) {
            console.error('Play error:', pErr);
          }
        };
      }
    } catch (err) {
      console.error('Camera Auto-Start Error:', err);
      setStatusMsg(`Camera Error: ${err.message}. Check browser permissions.`);
    }
  };

  // AUTO-START CAMERA ON MOUNT
  useEffect(() => {
    if (isDataLoaded && !isCameraStarted) {
      startMirrorSystem();
    }
  }, [isDataLoaded]);

  // 3. Audio Streaming Trigger with Language Proxy
  const speakText = (text, lang) => {
    const targetLang = (lang || 'hi').toLowerCase().split('-')[0];
    const audioUrl = `/api/tts/stream?text=${encodeURIComponent(text)}&lang=${targetLang}`;
    if (window.activeAudioPlayer) window.activeAudioPlayer.pause();
    const audio = new Audio(audioUrl);
    window.activeAudioPlayer = audio;
    audio.play().catch((e) => console.error('Audio playback error:', e));
  };

  // 4. Main Processing Loop
  useEffect(() => {
    let timerId;

    const processFrame = async () => {
      if (!isCameraStarted || !videoRef.current || isProcessingRef.current) {
        timerId = setTimeout(processFrame, 600);
        return;
      }

      if (videoRef.current.videoWidth === 0 || videoRef.current.videoHeight === 0) {
        timerId = setTimeout(processFrame, 600);
        return;
      }

      isProcessingRef.current = true;

      try {
        const detection = await faceapi
          .detectSingleFace(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 })
          )
          .withFaceLandmarks()
          .withFaceDescriptor();

        if (!detection) {
          spokenUserRef.current = null;
          setActiveVisitorCard(null);
          isProcessingRef.current = false;
          timerId = setTimeout(processFrame, 600);
          return;
        }

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

        // RECOGNIZED MATCH (Threshold: 0.55)
        if (bestMatch && minDistance < 0.55) {
          unknownCounterRef.current = 0;
          setActiveVisitorCard(bestMatch);

          const visitorId = bestMatch._id || bestMatch.id;
          if (spokenUserRef.current !== visitorId) {
            spokenUserRef.current = visitorId;
            const greeting = getGreetingText(bestMatch, currentLang);
            speakText(greeting, currentLang);
          }
        }
        // UNKNOWN VISITOR
        else {
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

        {/* CUE CARD FOR PATIENT */}
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
