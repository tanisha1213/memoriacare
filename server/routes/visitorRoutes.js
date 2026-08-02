const express = require('express');
const https = require('https');
const mongoose = require('mongoose');
const router = express.Router();
const Routine = require('../models/Routine');
const fs = require('fs');
const path = require('path');

const memoryVisitors = [];
const memoryUnknownQueue = [];

// Persistent Local Routines File DB Backup
const ROUTINES_FILE = process.env.VERCEL
  ? path.join('/tmp', 'routines_db.json')
  : path.join(__dirname, '../routines_db.json');

function loadLocalRoutines() {
  try {
    if (fs.existsSync(ROUTINES_FILE)) {
      return JSON.parse(fs.readFileSync(ROUTINES_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Error loading routines_db.json:', e.message);
  }
  return [];
}

function saveLocalRoutines(list) {
  try {
    fs.writeFileSync(ROUTINES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('Error saving routines_db.json:', e.message);
  }
}

// Persistent Local Unknown Queue File DB Backup
const UNKNOWNS_FILE = process.env.VERCEL
  ? path.join('/tmp', 'unknowns_db.json')
  : path.join(__dirname, '../unknowns_db.json');

function loadLocalUnknowns() {
  try {
    if (fs.existsSync(UNKNOWNS_FILE)) {
      return JSON.parse(fs.readFileSync(UNKNOWNS_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Error loading unknowns_db.json:', e.message);
  }
  return [];
}

function saveLocalUnknowns(list) {
  try {
    fs.writeFileSync(UNKNOWNS_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('Error saving unknowns_db.json:', e.message);
  }
}

const DEFAULT_PRESET_ROUTINES = [
  { activityName: 'Wake Up', time: '07:00', reminderMessage: 'Good morning. Time to wake up and start your day.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Brush Teeth', time: '07:30', reminderMessage: 'Time to brush your teeth.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Breakfast', time: '08:00', reminderMessage: 'Time to enjoy your breakfast.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Medicine Reminder', time: '09:00', reminderMessage: 'It is 9:00 AM. It is time for your morning medicine.', frequency: 'EVERYDAY', priority: 'URGENT', voiceEnabled: true, caregiverNotify: true, timeoutMinutes: 5, isActive: true },
  { activityName: 'Morning Walk', time: '10:30', reminderMessage: 'Time for a gentle morning walk.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Lunch', time: '13:00', reminderMessage: 'Time for lunch.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Afternoon Snack', time: '16:00', reminderMessage: 'Time for a light snack and a glass of water.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Family Time', time: '18:00', reminderMessage: 'Time to connect with your family.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Dinner', time: '20:00', reminderMessage: 'Time for dinner.', frequency: 'EVERYDAY', priority: 'NORMAL', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true },
  { activityName: 'Prepare for Sleep', time: '21:30', reminderMessage: 'Time to relax and prepare for a restful sleep.', frequency: 'EVERYDAY', priority: 'IMPORTANT', voiceEnabled: true, caregiverNotify: false, timeoutMinutes: 5, isActive: true }
];

function calculateEuclideanDistance(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length) return Infinity;
  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Math.sqrt(sum);
}

function sanitizeEmbedding(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map((n) => Number(n));
  if (typeof raw === 'object') return Object.values(raw).map((n) => Number(n));
  return [];
}

router.get('/visitors/:familyCode', async (req, res) => {
  const { familyCode } = req.params;

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('visitors')
        .select('*')
        .eq('family_code', familyCode)
        .eq('is_registered', true);

      if (!error && data && data.length > 0) {
        const formatted = data.map((v) => ({
          _id: v.id,
          name: v.name,
          relationship: v.relationship,
          contextNote: v.context_note || v.contextNote || '',
          embedding: sanitizeEmbedding(v.embedding),
          photoThumbnail: v.photo_thumbnail || v.photoThumbnail || ''
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    }
  } catch (sbErr) {}

  if (mongoose.connection.readyState === 1) {
    try {
      const mongooseVisitors = await Visitor.find({ familyCode, isRegistered: true })
        .select('_id name relationship contextNote embedding photoThumbnail')
        .maxTimeMS(1000)
        .exec();

      if (mongooseVisitors && mongooseVisitors.length > 0) {
        const formatted = mongooseVisitors.map((v) => ({
          _id: v._id,
          name: v.name,
          relationship: v.relationship,
          contextNote: v.contextNote,
          embedding: sanitizeEmbedding(v.embedding),
          photoThumbnail: v.photoThumbnail
        }));

        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    } catch (mgErr) {}
  }

  const filtered = memoryVisitors.filter(
    (v) => v.familyCode === familyCode && v.isRegistered !== false
  );
  return res.status(200).json({ success: true, count: filtered.length, data: filtered });
});

const getUnknownsHandler = async (req, res) => {
  const { familyCode } = req.params;
  let queue = [];

  // 1. Load local file DB
  const localList = loadLocalUnknowns();
  queue = localList.filter((item) => item.familyCode === familyCode && item.status === 'PENDING_REVIEW');

  // 2. Check Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from('unknown_queue')
        .select('*')
        .eq('family_code', familyCode)
        .eq('status', 'PENDING_REVIEW')
        .order('created_at', { ascending: false });

      if (!error && data && data.length > 0) {
        const formatted = data.map((item) => ({
          _id: item.id,
          familyCode: item.family_code,
          photoThumbnail: item.photo_thumbnail,
          embedding: sanitizeEmbedding(item.embedding),
          status: item.status,
          timestamp: item.created_at
        }));

        const existingIds = new Set(queue.map((q) => q._id));
        formatted.forEach((f) => {
          if (!existingIds.has(f._id)) queue.push(f);
        });
      }
    } catch (sbErr) {}
  }

  // 3. Check Mongoose
  if (mongoose.connection.readyState === 1) {
    try {
      const mongooseQueue = await UnknownQueue.find({ familyCode, status: 'PENDING_REVIEW' })
        .sort({ timestamp: -1 })
        .maxTimeMS(1000)
        .exec();

      const existingIds = new Set(queue.map((q) => q._id));
      mongooseQueue.forEach((m) => {
        const mId = m._id.toString();
        if (!existingIds.has(mId)) {
          queue.push({
            _id: mId,
            familyCode: m.familyCode,
            photoThumbnail: m.photoThumbnail,
            embedding: sanitizeEmbedding(m.embedding),
            status: m.status,
            timestamp: m.timestamp
          });
        }
      });
    } catch (mgErr) {}
  }

  // 4. Fallback memory queue
  const existingIds = new Set(queue.map((q) => q._id));
  memoryUnknownQueue.forEach((mem) => {
    if (mem.familyCode === familyCode && mem.status === 'PENDING_REVIEW' && !existingIds.has(mem._id)) {
      queue.push(mem);
    }
  });

  return res.status(200).json({ success: true, count: queue.length, data: queue });
};

router.get('/queue/:familyCode', getUnknownsHandler);
router.get('/visitors/:familyCode/unknowns', getUnknownsHandler);

const postUnknownHandler = async (req, res) => {
  try {
    const familyCode = req.params.familyCode || req.body.familyCode || 'FAM123';
    const { photoThumbnail, embedding: rawEmbedding } = req.body;

    const cleanVector = sanitizeEmbedding(rawEmbedding);

    if (!photoThumbnail || cleanVector.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing thumbnail or valid embedding vector' });
    }

    const newQueueItem = {
      _id: `unk_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      familyCode,
      photoThumbnail,
      embedding: cleanVector,
      status: 'PENDING_REVIEW',
      timestamp: new Date().toISOString()
    };

    // Save to memory and local file DB
    memoryUnknownQueue.unshift(newQueueItem);
    const localList = loadLocalUnknowns();
    localList.unshift(newQueueItem);
    saveLocalUnknowns(localList);

    if (supabase) {
      supabase
        .from('unknown_queue')
        .insert([
          {
            family_code: familyCode,
            photo_thumbnail: photoThumbnail,
            embedding: cleanVector,
            status: 'PENDING_REVIEW'
          }
        ])
        .then(() => {})
        .catch((e) => console.warn('Supabase queue insert notice:', e.message));
    }

    if (mongoose.connection.readyState === 1) {
      new UnknownQueue({
        familyCode,
        photoThumbnail,
        embedding: cleanVector,
        status: 'PENDING_REVIEW',
        timestamp: new Date()
      })
        .save()
        .catch((e) => console.warn('Mongoose queue insert notice:', e.message));
    }

    console.log(`📸 [SNAPSHOT CAPTURED] Enqueued unknown snapshot for family code ${familyCode}`);
    return res.status(200).json({ success: true, id: newQueueItem._id, data: newQueueItem });
  } catch (err) {
    console.error('Queue Post Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to save snapshot' });
  }
};

router.post('/queue/unknown', postUnknownHandler);
router.post('/visitors/:familyCode/unknown', postUnknownHandler);

const approveHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, relationship, contextNote, embedding: bodyRawEmbedding, photoThumbnail: bodyPhoto } = req.body;

    if (!name || !relationship) {
      return res.status(400).json({ success: false, error: 'Name and Relationship are required.' });
    }

    let unknownItem = null;

    if (supabase && id) {
      try {
        const { data } = await supabase.from('unknown_queue').select('*').eq('id', id).single();
        if (data) {
          unknownItem = {
            familyCode: data.family_code,
            photoThumbnail: data.photo_thumbnail,
            embedding: data.embedding
          };
        }
      } catch (e) {}
    }

    if (!unknownItem && mongoose.connection.readyState === 1) {
      try {
        unknownItem = await UnknownQueue.findById(id).maxTimeMS(1000).exec();
      } catch (e) {}
    }

    if (!unknownItem) {
      unknownItem = memoryUnknownQueue.find((q) => q._id === id || q.id === id);
    }

    const familyCode = (unknownItem && unknownItem.familyCode) || req.params.familyCode || 'FAM123';
    const rawEmbedding = bodyRawEmbedding || (unknownItem && unknownItem.embedding) || [];
    const cleanVector = sanitizeEmbedding(rawEmbedding);
    const photoThumbnail = bodyPhoto || (unknownItem && unknownItem.photoThumbnail) || '';

    const newVisitorData = {
      _id: `vis_${Date.now()}`,
      familyCode,
      name: name.trim(),
      relationship: relationship.trim(),
      contextNote: contextNote ? contextNote.trim() : '',
      embedding: cleanVector,
      photoThumbnail,
      isRegistered: true,
      createdAt: new Date()
    };

    memoryVisitors.push(newVisitorData);

    if (unknownItem) {
      unknownItem.status = 'APPROVED';
    }

    if (mongoose.connection.readyState === 1) {
      new Visitor({
        familyCode,
        name: name.trim(),
        relationship: relationship.trim(),
        contextNote: contextNote ? contextNote.trim() : '',
        embedding: cleanVector,
        photoThumbnail,
        isRegistered: true
      })
        .save()
        .catch(() => {});

      if (id) {
        UnknownQueue.findByIdAndUpdate(id, { status: 'APPROVED' }).catch(() => {});
      }
    }

    if (supabase) {
      supabase
        .from('visitors')
        .insert([
          {
            family_code: familyCode,
            name: name.trim(),
            relationship: relationship.trim(),
            context_note: contextNote ? contextNote.trim() : '',
            embedding: cleanVector,
            photo_thumbnail: photoThumbnail,
            is_registered: true
          }
        ])
        .then(() => {})
        .catch((e) => console.warn('Supabase save error:', e.message));

      if (id) {
        supabase.from('unknown_queue').update({ status: 'APPROVED' }).eq('id', id).then(() => {}).catch(() => {});
      }
    }

    return res.status(200).json({
      success: true,
      message: 'Visitor successfully registered!',
      visitor: newVisitorData
    });
  } catch (err) {
    console.error('Approval Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to register visitor' });
  }
};

router.post('/queue/approve/:id', approveHandler);
router.post('/visitors/:familyCode/label-unknown', approveHandler);

router.delete('/visitors/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const memIndex = memoryVisitors.findIndex((v) => v._id === id);
    if (memIndex !== -1) {
      memoryVisitors.splice(memIndex, 1);
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await Visitor.findByIdAndDelete(id).maxTimeMS(1000).exec();
      } catch (e) {}
    }

    if (supabase) {
      supabase.from('visitors').delete().eq('id', id).then(() => {}).catch(() => {});
    }

    return res.status(200).json({ success: true, message: 'Visitor deleted successfully', id });
  } catch (err) {
    console.error('Delete Visitor Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete visitor' });
  }
});

router.get('/tts/stream', (req, res) => {
  try {
    const { text, lang = 'en' } = req.query;

    if (!text) {
      return res.status(400).json({ success: false, message: 'Missing query parameter: text' });
    }

    let targetLang = 'en';
    if (lang) {
      const cleaned = lang.toLowerCase().split('-')[0].trim();
      if (cleaned === 'hi' || cleaned === 'mr' || cleaned === 'en') {
        targetLang = cleaned;
      }
    }

    const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
      text
    )}&tl=${targetLang}&client=tw-ob`;

    https
      .get(
        googleTtsUrl,
        {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        },
        (googleRes) => {
          if (googleRes.statusCode !== 200) {
            return res.status(googleRes.statusCode).json({
              success: false,
              message: 'Failed to fetch audio stream from TTS provider'
            });
          }

          res.setHeader('Content-Type', 'audio/mpeg');
          res.setHeader('Cache-Control', 'public, max-age=86400');
          googleRes.pipe(res);
        }
      )
      .on('error', (err) => {
        console.error('Error streaming Google Translate TTS:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, message: 'TTS streaming failed', error: err.message });
        }
      });
  } catch (error) {
    console.error('Unexpected error in TTS route:', error);
    return res.status(500).json({ success: false, message: 'TTS stream route error', error: error.message });
  }
});

router.patch('/queue/dismiss/:id', async (req, res) => {
  const { id } = req.params;
  const item = memoryUnknownQueue.find((q) => q._id === id);
  if (item) item.status = 'DISMISSED';

  if (supabase) {
    supabase.from('unknown_queue').update({ status: 'DISMISSED' }).eq('id', id).then(() => {}).catch(() => {});
  }

  return res.status(200).json({ success: true, message: 'Dismissed successfully' });
});

/**
 * ROUTINE & REMINDER ENDPOINTS
 */

// GET /api/routines/:familyCode
router.get('/routines/:familyCode', async (req, res) => {
  const { familyCode } = req.params;
  let routines = [];

  // 1. Check local file DB
  const localList = loadLocalRoutines();
  routines = localList.filter((r) => r.familyCode === familyCode);

  // Auto-seed preset routines if empty for family
  if (routines.length === 0) {
    const seeded = DEFAULT_PRESET_ROUTINES.map((preset, idx) => ({
      _id: `rt_${Date.now()}_${idx}`,
      familyCode,
      ...preset,
      days: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
      lastAcknowledgedAt: null,
      createdAt: new Date().toISOString()
    }));

    routines = seeded;
    saveLocalRoutines([...localList, ...seeded]);
  }

  // 2. Try Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase.from('routines').select('*').eq('family_code', familyCode);
      if (!error && data && data.length > 0) {
        routines = data.map((r) => ({
          _id: r.id,
          familyCode: r.family_code,
          activityName: r.activity_name,
          time: r.time,
          reminderMessage: r.reminder_message || '',
          frequency: r.frequency || 'EVERYDAY',
          days: r.days || ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
          priority: r.priority || 'NORMAL',
          voiceEnabled: r.voice_enabled ?? true,
          caregiverNotify: r.caregiver_notify ?? true,
          timeoutMinutes: r.timeout_minutes ?? 5,
          isActive: r.is_active ?? true,
          lastAcknowledgedAt: r.last_acknowledged_at || null,
          createdAt: r.created_at
        }));
      }
    } catch (e) {}
  }

  // Sort by time "HH:MM"
  routines.sort((a, b) => a.time.localeCompare(b.time));
  return res.status(200).json({ success: true, count: routines.length, data: routines });
});

// POST /api/routines/:familyCode
router.post('/routines/:familyCode', async (req, res) => {
  const { familyCode } = req.params;
  const {
    activityName,
    time,
    reminderMessage,
    frequency,
    days,
    priority,
    voiceEnabled,
    caregiverNotify,
    timeoutMinutes
  } = req.body;

  if (!activityName || !time) {
    return res.status(400).json({ success: false, error: 'Activity name and time are required.' });
  }

  const newRoutine = {
    _id: `rt_${Date.now()}`,
    familyCode,
    activityName: activityName.trim(),
    time: time.trim(),
    reminderMessage: (reminderMessage || '').trim(),
    frequency: frequency || 'EVERYDAY',
    days: days && days.length > 0 ? days : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'],
    priority: priority || 'NORMAL',
    voiceEnabled: voiceEnabled !== undefined ? Boolean(voiceEnabled) : true,
    caregiverNotify: caregiverNotify !== undefined ? Boolean(caregiverNotify) : true,
    timeoutMinutes: Number(timeoutMinutes) || 5,
    isActive: true,
    lastAcknowledgedAt: null,
    createdAt: new Date().toISOString()
  };

  const localList = loadLocalRoutines();
  localList.push(newRoutine);
  saveLocalRoutines(localList);

  if (mongoose.connection.readyState === 1) {
    new Routine({
      familyCode,
      activityName: newRoutine.activityName,
      time: newRoutine.time,
      reminderMessage: newRoutine.reminderMessage,
      frequency: newRoutine.frequency,
      days: newRoutine.days,
      priority: newRoutine.priority,
      voiceEnabled: newRoutine.voiceEnabled,
      caregiverNotify: newRoutine.caregiverNotify,
      timeoutMinutes: newRoutine.timeoutMinutes,
      isActive: true
    }).save().catch(() => {});
  }

  if (supabase) {
    supabase.from('routines').insert([{
      family_code: familyCode,
      activity_name: newRoutine.activityName,
      time: newRoutine.time,
      reminder_message: newRoutine.reminderMessage,
      frequency: newRoutine.frequency,
      days: newRoutine.days,
      priority: newRoutine.priority,
      voice_enabled: newRoutine.voiceEnabled,
      caregiver_notify: newRoutine.caregiverNotify,
      timeout_minutes: newRoutine.timeoutMinutes,
      is_active: true
    }]).then(() => {}).catch(() => {});
  }

  return res.status(201).json({ success: true, data: newRoutine });
});

// PUT /api/routines/:id
router.put('/routines/:id', async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  const localList = loadLocalRoutines();
  const idx = localList.findIndex((r) => r._id === id);
  if (idx !== -1) {
    localList[idx] = { ...localList[idx], ...updates };
    saveLocalRoutines(localList);
  }

  if (supabase) {
    const sbPayload = {};
    if (updates.activityName) sbPayload.activity_name = updates.activityName;
    if (updates.time) sbPayload.time = updates.time;
    if (updates.reminderMessage !== undefined) sbPayload.reminder_message = updates.reminderMessage;
    if (updates.frequency) sbPayload.frequency = updates.frequency;
    if (updates.priority) sbPayload.priority = updates.priority;
    if (updates.voiceEnabled !== undefined) sbPayload.voice_enabled = updates.voiceEnabled;
    if (updates.caregiverNotify !== undefined) sbPayload.caregiver_notify = updates.caregiverNotify;
    if (updates.timeoutMinutes) sbPayload.timeout_minutes = updates.timeoutMinutes;
    if (updates.isActive !== undefined) sbPayload.is_active = updates.isActive;

    supabase.from('routines').update(sbPayload).eq('id', id).then(() => {}).catch(() => {});
  }

  return res.status(200).json({ success: true, message: 'Routine updated.' });
});

// DELETE /api/routines/:id
router.delete('/routines/:id', async (req, res) => {
  const { id } = req.params;
  const localList = loadLocalRoutines();
  const filtered = localList.filter((r) => r._id !== id);
  saveLocalRoutines(filtered);

  if (supabase) {
    supabase.from('routines').delete().eq('id', id).then(() => {}).catch(() => {});
  }

  return res.status(200).json({ success: true, message: 'Routine deleted.' });
});

// PATCH /api/routines/toggle/:id
router.patch('/routines/toggle/:id', async (req, res) => {
  const { id } = req.params;
  const localList = loadLocalRoutines();
  const item = localList.find((r) => r._id === id);
  if (item) {
    item.isActive = !item.isActive;
    saveLocalRoutines(localList);
    if (supabase) {
      supabase.from('routines').update({ is_active: item.isActive }).eq('id', id).then(() => {}).catch(() => {});
    }
  }
  return res.status(200).json({ success: true, isActive: item ? item.isActive : false });
});

// PATCH /api/routines/ack/:id
router.patch('/routines/ack/:id', async (req, res) => {
  const { id } = req.params;
  const nowISO = new Date().toISOString();

  const localList = loadLocalRoutines();
  const item = localList.find((r) => r._id === id);
  if (item) {
    item.lastAcknowledgedAt = nowISO;
    saveLocalRoutines(localList);
  }

  if (supabase) {
    supabase.from('routines').update({ last_acknowledged_at: nowISO }).eq('id', id).then(() => {}).catch(() => {});
  }

  return res.status(200).json({ success: true, acknowledgedAt: nowISO });
});

module.exports = router;
