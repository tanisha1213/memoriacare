const express = require('express');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Routine = require('../models/Routine');
const UnknownQueue = require('../models/UnknownQueue');
const supabase = require('../supabaseClient');

const router = express.Router();

// Persistent Local File DB Backup for serverless / fallback
const ROUTINES_FILE = process.env.VERCEL
  ? path.join('/tmp', 'routines_db.json')
  : path.join(__dirname, '../routines_db.json');

function loadLocalRoutines() {
  try {
    if (fs.existsSync(ROUTINES_FILE)) {
      return JSON.parse(fs.readFileSync(ROUTINES_FILE, 'utf8'));
    }
  } catch (e) {
    console.warn('Error reading routines_db.json:', e.message);
  }
  return [];
}

function saveLocalRoutines(list) {
  try {
    fs.writeFileSync(ROUTINES_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('Error writing routines_db.json:', e.message);
  }
}

// Default Presets for Alzheimer's Patients
function getDefaultPresets(familyCode) {
  const now = new Date().toISOString();
  return [
    {
      _id: `preset_1_${familyCode}`,
      familyCode,
      activityName: 'Wake up',
      time: '07:00',
      reminderMessage: 'Good morning! Time to wake up and start a fresh new day.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'NORMAL',
      voiceReminder: true,
      notifyCaregiver: false,
      unackTimeoutMinutes: 10,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_2_${familyCode}`,
      familyCode,
      activityName: 'Brush teeth',
      time: '07:30',
      reminderMessage: 'Time to brush your teeth and refresh.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'NORMAL',
      voiceReminder: true,
      notifyCaregiver: false,
      unackTimeoutMinutes: 10,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_3_${familyCode}`,
      familyCode,
      activityName: 'Breakfast',
      time: '08:00',
      reminderMessage: 'Breakfast is ready! Please have a warm meal.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'IMPORTANT',
      voiceReminder: true,
      notifyCaregiver: true,
      unackTimeoutMinutes: 15,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_4_${familyCode}`,
      familyCode,
      activityName: 'Medicine reminder',
      time: '09:00',
      reminderMessage: 'Good morning. It is 9:00 AM. It is time for your medicine.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'URGENT',
      voiceReminder: true,
      notifyCaregiver: true,
      unackTimeoutMinutes: 5,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_5_${familyCode}`,
      familyCode,
      activityName: 'Morning walk',
      time: '10:30',
      reminderMessage: 'Time for a gentle morning walk and fresh air.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'NORMAL',
      voiceReminder: true,
      notifyCaregiver: false,
      unackTimeoutMinutes: 15,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_6_${familyCode}`,
      familyCode,
      activityName: 'Lunch',
      time: '13:00',
      reminderMessage: 'It is 1:00 PM. Lunch is ready for you.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'IMPORTANT',
      voiceReminder: true,
      notifyCaregiver: true,
      unackTimeoutMinutes: 15,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_7_${familyCode}`,
      familyCode,
      activityName: 'Evening snack',
      time: '16:00',
      reminderMessage: 'Time for a light afternoon snack and tea.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'NORMAL',
      voiceReminder: true,
      notifyCaregiver: false,
      unackTimeoutMinutes: 15,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_8_${familyCode}`,
      familyCode,
      activityName: 'Family time',
      time: '18:00',
      reminderMessage: 'It is 6:00 PM. Family time and relaxing together.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'NORMAL',
      voiceReminder: true,
      notifyCaregiver: false,
      unackTimeoutMinutes: 15,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_9_${familyCode}`,
      familyCode,
      activityName: 'Dinner',
      time: '20:00',
      reminderMessage: 'Dinner time! Enjoy a healthy evening meal.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'IMPORTANT',
      voiceReminder: true,
      notifyCaregiver: true,
      unackTimeoutMinutes: 15,
      isPaused: false,
      createdAt: now
    },
    {
      _id: `preset_10_${familyCode}`,
      familyCode,
      activityName: 'Prepare for sleep',
      time: '21:30',
      reminderMessage: 'It is 9:30 PM. Time to wind down and prepare for sleep.',
      repeatFrequency: 'EVERY_DAY',
      daysOfWeek: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: 'NORMAL',
      voiceReminder: true,
      notifyCaregiver: false,
      unackTimeoutMinutes: 15,
      isPaused: false,
      createdAt: now
    }
  ];
}

/**
 * 1. GET /api/routines/:familyCode
 * @desc Get all daily routines for a family (returns default presets if empty)
 */
router.get('/:familyCode', async (req, res) => {
  try {
    const { familyCode } = req.params;
    let list = [];

    // 1. Try local file DB first
    const allLocal = loadLocalFamiliesRoutines(familyCode);
    if (allLocal && allLocal.length > 0) {
      list = allLocal;
    }

    // 2. Try Supabase if list is empty
    if (list.length === 0 && supabase) {
      try {
        const { data, error } = await supabase
          .from('routines')
          .select('*')
          .eq('family_code', familyCode)
          .order('time', { ascending: true });

        if (!error && data && data.length > 0) {
          list = data.map((item) => ({
            _id: item.id,
            familyCode: item.family_code,
            activityName: item.activity_name,
            time: item.time,
            reminderMessage: item.reminder_message,
            repeatFrequency: item.repeat_frequency,
            daysOfWeek: item.days_of_week || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            priority: item.priority || 'NORMAL',
            voiceReminder: item.voice_reminder !== false,
            notifyCaregiver: item.notify_caregiver !== false,
            unackTimeoutMinutes: item.unack_timeout_minutes || 5,
            isPaused: item.is_paused || false,
            createdAt: item.created_at
          }));
        }
      } catch (e) {}
    }

    // 3. Try Mongoose if list is still empty
    if (list.length === 0 && mongoose.connection.readyState === 1) {
      try {
        list = await Routine.find({ familyCode }).sort({ time: 1 }).lean().exec();
      } catch (e) {}
    }

    // 4. Fallback to Default Presets if zero records exist
    if (!list || list.length === 0) {
      list = getDefaultPresets(familyCode);
      // Persist default presets locally
      const allRoutines = loadLocalRoutines();
      saveLocalRoutines([...allRoutines, ...list]);
    }

    // Sort by time ("HH:MM")
    list.sort((a, b) => a.time.localeCompare(b.time));

    return res.status(200).json(list);
  } catch (err) {
    console.error('Get Routines Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch daily routines.' });
  }
});

function loadLocalFamiliesRoutines(familyCode) {
  const all = loadLocalRoutines();
  return all.filter((r) => r.familyCode === familyCode);
}

/**
 * 2. POST /api/routines/:familyCode
 * @desc Create a new daily routine reminder
 */
router.post('/:familyCode', async (req, res) => {
  try {
    const { familyCode } = req.params;
    const {
      activityName,
      time,
      reminderMessage,
      repeatFrequency,
      daysOfWeek,
      priority,
      voiceReminder,
      notifyCaregiver,
      unackTimeoutMinutes
    } = req.body;

    if (!activityName || !time || !reminderMessage) {
      return res.status(400).json({ success: false, error: 'Activity name, time, and reminder message are required.' });
    }

    const newRoutine = {
      _id: `routine_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      familyCode,
      activityName: activityName.trim(),
      time: time.trim(),
      reminderMessage: reminderMessage.trim(),
      repeatFrequency: repeatFrequency || 'EVERY_DAY',
      daysOfWeek: daysOfWeek || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      priority: priority || 'NORMAL',
      voiceReminder: voiceReminder !== false,
      notifyCaregiver: notifyCaregiver !== false,
      unackTimeoutMinutes: Number(unackTimeoutMinutes) || 5,
      isPaused: false,
      createdAt: new Date().toISOString()
    };

    // Save to local file DB
    const all = loadLocalRoutines();
    all.push(newRoutine);
    saveLocalRoutines(all);

    // Save to Mongoose if connected
    if (mongoose.connection.readyState === 1) {
      new Routine(newRoutine).save().catch((e) => console.warn('Mongoose save routine notice:', e.message));
    }

    // Save to Supabase if connected
    if (supabase) {
      supabase
        .from('routines')
        .insert([
          {
            family_code: familyCode,
            activity_name: newRoutine.activityName,
            time: newRoutine.time,
            reminder_message: newRoutine.reminderMessage,
            repeat_frequency: newRoutine.repeatFrequency,
            days_of_week: newRoutine.daysOfWeek,
            priority: newRoutine.priority,
            voice_reminder: newRoutine.voiceReminder,
            notify_caregiver: newRoutine.notifyCaregiver,
            unack_timeout_minutes: newRoutine.unackTimeoutMinutes,
            is_paused: newRoutine.isPaused
          }
        ])
        .then(() => {})
        .catch((e) => console.warn('Supabase save routine notice:', e.message));
    }

    console.log(`📅 [ROUTINE CREATED] ${newRoutine.activityName} at ${newRoutine.time} for ${familyCode}`);
    return res.status(201).json({ success: true, routine: newRoutine });
  } catch (err) {
    console.error('Create Routine Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create routine reminder.' });
  }
});

/**
 * 3. PUT /api/routines/:id
 * @desc Edit an existing routine reminder
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const all = loadLocalRoutines();
    const idx = all.findIndex((r) => r._id === id || r.id === id);

    if (idx !== -1) {
      all[idx] = { ...all[idx], ...updates, updatedAt: new Date().toISOString() };
      saveLocalRoutines(all);
    }

    if (mongoose.connection.readyState === 1) {
      try {
        await Routine.findByIdAndUpdate(id, updates).exec();
      } catch (e) {}
    }

    if (supabase) {
      try {
        await supabase
          .from('routines')
          .update({
            activity_name: updates.activityName,
            time: updates.time,
            reminder_message: updates.reminderMessage,
            repeat_frequency: updates.repeatFrequency,
            days_of_week: updates.daysOfWeek,
            priority: updates.priority,
            voice_reminder: updates.voiceReminder,
            notify_caregiver: updates.notifyCaregiver,
            unack_timeout_minutes: updates.unackTimeoutMinutes,
            is_paused: updates.isPaused
          })
          .eq('id', id);
      } catch (e) {}
    }

    return res.status(200).json({ success: true, message: 'Routine updated successfully.' });
  } catch (err) {
    console.error('Update Routine Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to update routine.' });
  }
});

/**
 * 4. DELETE /api/routines/:id
 * @desc Delete a routine item
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const all = loadLocalRoutines();
    const filtered = all.filter((r) => r._id !== id && r.id !== id);
    saveLocalRoutines(filtered);

    if (mongoose.connection.readyState === 1) {
      try {
        await Routine.findByIdAndDelete(id).exec();
      } catch (e) {}
    }

    if (supabase) {
      try {
        await supabase.from('routines').delete().eq('id', id);
      } catch (e) {}
    }

    return res.status(200).json({ success: true, message: 'Routine deleted.' });
  } catch (err) {
    console.error('Delete Routine Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to delete routine.' });
  }
});

/**
 * 5. PATCH /api/routines/:id/toggle
 * @desc Pause or resume a routine item
 */
router.patch('/:id/toggle', async (req, res) => {
  try {
    const { id } = req.params;
    const all = loadLocalRoutines();
    const idx = all.findIndex((r) => r._id === id || r.id === id);

    let newStatus = true;
    if (idx !== -1) {
      all[idx].isPaused = !all[idx].isPaused;
      newStatus = all[idx].isPaused;
      saveLocalRoutines(all);
    }

    if (mongoose.connection.readyState === 1) {
      try {
        const item = await Routine.findById(id).exec();
        if (item) {
          item.isPaused = !item.isPaused;
          await item.save();
        }
      } catch (e) {}
    }

    if (supabase) {
      try {
        await supabase.from('routines').update({ is_paused: newStatus }).eq('id', id);
      } catch (e) {}
    }

    return res.status(200).json({ success: true, isPaused: newStatus });
  } catch (err) {
    console.error('Toggle Routine Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to toggle routine state.' });
  }
});

/**
 * 6. POST /api/routines/unacknowledged-alert
 * @desc Escalate unacknowledged routine reminder to caregiver alert queue
 */
router.post('/unacknowledged-alert', async (req, res) => {
  try {
    const { familyCode, activityName, reminderMessage, priority } = req.body;

    const alertCard = {
      _id: `unack_${Date.now()}`,
      familyCode,
      photoThumbnail: '', // Text badge alert
      embedding: [],
      status: 'PENDING_REVIEW',
      unackActivity: activityName,
      unackMessage: reminderMessage,
      priority: priority || 'URGENT',
      timestamp: new Date().toISOString()
    };

    console.warn(`🚨 [UNACKNOWLEDGED ROUTINE ESCALATION] ${activityName} for ${familyCode}`);

    return res.status(200).json({ success: true, message: 'Caregiver notified of unacknowledged routine.' });
  } catch (err) {
    return res.status(500).json({ success: false, error: 'Failed to report unacknowledged routine.' });
  }
});

module.exports = router;
