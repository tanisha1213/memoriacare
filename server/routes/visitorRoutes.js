const express = require('express');
const https = require('https');
const mongoose = require('mongoose');
const router = express.Router();
const Visitor = require('../models/Visitor');
const UnknownQueue = require('../models/UnknownQueue');
const supabase = require('../supabaseClient');

const memoryVisitors = [];
const memoryUnknownQueue = [];

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

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('unknown_queue')
        .select('*')
        .eq('family_code', familyCode)
        .eq('status', 'PENDING_REVIEW')
        .order('created_at', { ascending: false });

      if (!error && data) {
        const formatted = data.map((item) => ({
          _id: item.id,
          familyCode: item.family_code,
          photoThumbnail: item.photo_thumbnail,
          embedding: sanitizeEmbedding(item.embedding),
          status: item.status,
          timestamp: item.created_at
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    }
  } catch (sbErr) {}

  if (mongoose.connection.readyState === 1) {
    try {
      const mongooseQueue = await UnknownQueue.find({ familyCode, status: 'PENDING_REVIEW' })
        .sort({ timestamp: -1 })
        .maxTimeMS(1000)
        .exec();

      return res.status(200).json({ success: true, count: mongooseQueue.length, data: mongooseQueue });
    } catch (mgErr) {}
  }

  const filtered = memoryUnknownQueue.filter(
    (item) => item.familyCode === familyCode && item.status === 'PENDING_REVIEW'
  );
  return res.status(200).json({ success: true, count: filtered.length, data: filtered });
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

    memoryUnknownQueue.unshift(newQueueItem);

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
        .catch(() => {});
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
        .catch(() => {});
    }

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

module.exports = router;
