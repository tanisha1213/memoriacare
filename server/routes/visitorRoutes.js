const express = require('express');
const https = require('https');
const mongoose = require('mongoose');
const router = express.Router();
const Visitor = require('../models/Visitor');
const UnknownQueue = require('../models/UnknownQueue');
const supabase = require('../supabaseClient');

const memoryVisitors = [];
const memoryUnknownQueue = [];
const memoryRoutines = [];

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

// 1. GET /api/visitors/:familyCode
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
          _id: v._id.toString(),
          name: v.name,
          relationship: v.relationship,
          contextNote: v.contextNote || '',
          embedding: sanitizeEmbedding(v.embedding),
          photoThumbnail: v.photoThumbnail || ''
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    } catch (dbErr) {}
  }

  const memFiltered = memoryVisitors.filter((v) => v.familyCode === familyCode && v.isRegistered);
  return res.status(200).json({ success: true, count: memFiltered.length, data: memFiltered });
});

// 2. GET /api/routines/:familyCode
router.get('/routines/:familyCode', async (req, res) => {
  const { familyCode } = req.params;

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('routines')
        .select('*')
        .eq('family_code', familyCode);

      if (!error && data && data.length > 0) {
        const formatted = data.map((r) => ({
          _id: r.id,
          familyCode: r.family_code,
          time: r.time || r.scheduled_time || '08:00 AM',
          scheduledTime: r.time || r.scheduled_time || '08:00 AM',
          title: r.title,
          note: r.note || r.context_note || '',
          contextNote: r.note || r.context_note || '',
          category: r.category || 'Routine'
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    }
  } catch (e) {}

  const filtered = memoryRoutines.filter((r) => r.familyCode === familyCode);
  return res.status(200).json({ success: true, count: filtered.length, data: filtered });
});

// 3. POST /api/routines/:familyCode
router.post('/routines/:familyCode', async (req, res) => {
  const { familyCode } = req.params;
  const { time, title, note, category } = req.body;

  const routine = {
    _id: `rem_${Date.now()}`,
    familyCode,
    time: time || '08:00 AM',
    scheduledTime: time || '08:00 AM',
    title: title || 'Scheduled Routine',
    note: note || '',
    contextNote: note || '',
    category: category || 'Routine',
    createdAt: new Date().toISOString()
  };

  memoryRoutines.push(routine);

  if (supabase) {
    try {
      await supabase.from('routines').insert([
        {
          family_code: familyCode,
          time: routine.time,
          scheduled_time: routine.time,
          title: routine.title,
          note: routine.note,
          context_note: routine.note,
          category: routine.category
        }
      ]);
    } catch (e) {}
  }

  return res.status(201).json({ success: true, data: routine });
});

// 4. DELETE /api/routines/:id
router.delete('/routines/:id', async (req, res) => {
  const { id } = req.params;

  const idx = memoryRoutines.findIndex((r) => r._id === id);
  if (idx !== -1) {
    memoryRoutines.splice(idx, 1);
  }

  if (supabase) {
    try {
      await supabase.from('routines').delete().eq('id', id);
    } catch (e) {}
  }

  return res.status(200).json({ success: true });
});

// 5. GET /api/visitors/:familyCode/unknowns
router.get('/visitors/:familyCode/unknowns', async (req, res) => {
  const { familyCode } = req.params;

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('unknown_queue')
        .select('*')
        .eq('family_code', familyCode)
        .eq('status', 'PENDING_REVIEW')
        .order('timestamp', { ascending: false });

      if (!error && data) {
        const formatted = data.map((u) => ({
          _id: u.id,
          familyCode: u.family_code,
          photoThumbnail: u.photo_thumbnail,
          embedding: sanitizeEmbedding(u.embedding),
          status: u.status,
          timestamp: u.timestamp
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    }
  } catch (sbErr) {}

  if (mongoose.connection.readyState === 1) {
    try {
      const dbUnknowns = await UnknownQueue.find({ familyCode, status: 'PENDING_REVIEW' })
        .sort({ timestamp: -1 })
        .maxTimeMS(1000)
        .exec();

      if (dbUnknowns) {
        const formatted = dbUnknowns.map((u) => ({
          _id: u._id.toString(),
          familyCode: u.familyCode,
          photoThumbnail: u.photoThumbnail,
          embedding: sanitizeEmbedding(u.embedding),
          status: u.status,
          timestamp: u.timestamp
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    } catch (dbErr) {}
  }

  const memFiltered = memoryUnknownQueue.filter(
    (u) => u.familyCode === familyCode && u.status === 'PENDING_REVIEW'
  );
  return res.status(200).json({ success: true, count: memFiltered.length, data: memFiltered });
});

// Route Aliases
router.get('/queue/:familyCode', async (req, res) => {
  req.url = `/visitors/${req.params.familyCode}/unknowns`;
  return router.handle(req, res);
});

// 6. POST /api/queue/unknown
router.post('/queue/unknown', async (req, res) => {
  try {
    const { familyCode, photoThumbnail, embedding } = req.body;
    if (!photoThumbnail) {
      return res.status(400).json({ success: false, error: 'photoThumbnail is required' });
    }

    const cleanEmbedding = sanitizeEmbedding(embedding);
    const newUnknown = {
      _id: `unk_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      familyCode: familyCode || 'FAM123',
      photoThumbnail,
      embedding: cleanEmbedding,
      status: 'PENDING_REVIEW',
      timestamp: new Date().toISOString()
    };

    memoryUnknownQueue.unshift(newUnknown);

    if (supabase) {
      supabase
        .from('unknown_queue')
        .insert([
          {
            family_code: newUnknown.familyCode,
            photo_thumbnail: newUnknown.photoThumbnail,
            embedding: cleanEmbedding,
            status: 'PENDING_REVIEW',
            timestamp: newUnknown.timestamp
          }
        ])
        .then(() => {})
        .catch(() => {});
    }

    if (mongoose.connection.readyState === 1) {
      new UnknownQueue({
        familyCode: newUnknown.familyCode,
        photoThumbnail: newUnknown.photoThumbnail,
        embedding: cleanEmbedding,
        status: 'PENDING_REVIEW',
        timestamp: new Date(newUnknown.timestamp)
      })
        .save()
        .catch(() => {});
    }

    return res.status(201).json({ success: true, data: newUnknown });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Internal Server Error' });
  }
});

router.post('/visitors/:familyCode/unknown', async (req, res) => {
  return router.handle(req, res);
});

// 7. POST /api/queue/approve/:id
router.post('/queue/approve/:id', async (req, res) => {
  const { id } = req.params;
  const { name, relationship, contextNote, embedding: bodyEmbedding } = req.body;

  if (!name || !relationship) {
    return res.status(400).json({ success: false, error: 'Name and relationship are required' });
  }

  let finalEmbedding = sanitizeEmbedding(bodyEmbedding);

  let targetUnknown = memoryUnknownQueue.find((item) => item._id === id);

  if (targetUnknown) {
    targetUnknown.status = 'APPROVED';
    if (finalEmbedding.length === 0) {
      finalEmbedding = sanitizeEmbedding(targetUnknown.embedding);
    }
  }

  const newVisitor = {
    _id: `vis_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    familyCode: targetUnknown?.familyCode || 'FAM123',
    name,
    relationship,
    contextNote: contextNote || '',
    embedding: finalEmbedding,
    photoThumbnail: targetUnknown?.photoThumbnail || '',
    isRegistered: true,
    createdAt: new Date().toISOString()
  };

  memoryVisitors.push(newVisitor);

  if (supabase) {
    try {
      await supabase.from('unknown_queue').update({ status: 'APPROVED' }).eq('id', id);
      await supabase.from('visitors').insert([
        {
          family_code: newVisitor.familyCode,
          name: newVisitor.name,
          relationship: newVisitor.relationship,
          context_note: newVisitor.contextNote,
          embedding: finalEmbedding,
          photo_thumbnail: newVisitor.photoThumbnail,
          is_registered: true
        }
      ]);
    } catch (sbErr) {}
  }

  if (mongoose.connection.readyState === 1) {
    try {
      await UnknownQueue.findByIdAndUpdate(id, { status: 'APPROVED' }).exec();
      await new Visitor({
        familyCode: newVisitor.familyCode,
        name: newVisitor.name,
        relationship: newVisitor.relationship,
        contextNote: newVisitor.contextNote,
        embedding: finalEmbedding,
        photoThumbnail: newVisitor.photoThumbnail,
        isRegistered: true
      }).save();
    } catch (dbErr) {}
  }

  return res.status(200).json({ success: true, data: newVisitor });
});

router.post('/visitors/:familyCode/label-unknown', async (req, res) => {
  const { unknownId, name, relationship, contextNote, embedding } = req.body;
  req.params.id = unknownId || req.params.id;
  req.body.name = name;
  req.body.relationship = relationship;
  req.body.contextNote = contextNote;
  req.body.embedding = embedding;
  return router.handle(req, res);
});

// 8. PATCH /api/queue/dismiss/:id
router.patch('/queue/dismiss/:id', async (req, res) => {
  const { id } = req.params;

  const item = memoryUnknownQueue.find((u) => u._id === id);
  if (item) item.status = 'DISMISSED';

  if (supabase) {
    try {
      await supabase.from('unknown_queue').update({ status: 'DISMISSED' }).eq('id', id);
    } catch (e) {}
  }

  if (mongoose.connection.readyState === 1) {
    try {
      await UnknownQueue.findByIdAndUpdate(id, { status: 'DISMISSED' }).exec();
    } catch (e) {}
  }

  return res.status(200).json({ success: true });
});

// 9. DELETE /api/visitors/:id
router.delete('/visitors/:id', async (req, res) => {
  const { id } = req.params;

  const idx = memoryVisitors.findIndex((v) => v._id === id);
  if (idx !== -1) {
    memoryVisitors.splice(idx, 1);
  }

  if (supabase) {
    try {
      await supabase.from('visitors').delete().eq('id', id);
    } catch (e) {}
  }

  if (mongoose.connection.readyState === 1) {
    try {
      await Visitor.findByIdAndDelete(id).exec();
    } catch (e) {}
  }

  return res.status(200).json({ success: true });
});

// 10. GET /api/tts/stream
router.get('/tts/stream', (req, res) => {
  const { text, lang } = req.query;

  if (!text) {
    return res.status(400).json({ error: 'Text query parameter is required' });
  }

  const targetLang = (lang || 'hi').toLowerCase().split('-')[0];

  const googleTtsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(
    text
  )}&tl=${targetLang}&client=tw-ob`;

  const options = {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    }
  };

  https
    .get(googleTtsUrl, options, (ttsStream) => {
      if (ttsStream.statusCode !== 200) {
        return res.status(ttsStream.statusCode).json({ error: 'Failed to fetch TTS audio' });
      }

      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      ttsStream.pipe(res);
    })
    .on('error', (err) => {
      res.status(500).json({ error: 'Audio stream proxy error' });
    });
});

module.exports = router;
