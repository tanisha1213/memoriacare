const express = require('express');
const mongoose = require('mongoose');
const SafetyEvent = require('../models/SafetyEvent');
const supabase = require('../supabaseClient');

const router = express.Router();
const memorySafetyEvents = [];

/**
 * 1. POST /api/telemetry/event
 * @desc Non-blocking Edge ML telemetry event handler with multi-level escalation
 */
router.post('/telemetry/event', async (req, res) => {
  try {
    const { familyCode, locationZone, motionType, speed, yDelta } = req.body;

    if (!familyCode) {
      return res.status(400).json({ error: 'familyCode is required' });
    }

    const now = new Date();
    const currentHour = now.getHours();

    let alertLevel = 'Attention';
    let eventType = 'WANDERING';
    let description = '';

    // Rule 1: Fall Detection Trigger (Rapid Y-axis movement + low bounding box height)
    if (motionType === 'SUDDEN_DROP' || (yDelta && yDelta > 150)) {
      alertLevel = 'Emergency';
      eventType = 'POSSIBLE_FALL';
      description = 'Possible fall detected at mirror camera. Check on patient immediately.';
    }
    // Rule 2: Night-Time Activity Trigger (10 PM to 6 AM)
    else if (currentHour >= 22 || currentHour < 6) {
      alertLevel = 'Warning';
      eventType = 'NIGHT_ACTIVITY';
      description = `Night-time activity detected in ${locationZone || 'Living Room'} at ${now.toLocaleTimeString()}.`;
    }
    // Rule 3: Safe Zone / Exit Boundary Crossing
    else if (motionType === 'BOUNDARY_CROSS' || locationZone === 'Main Entrance' || locationZone === 'Unsafe Exit') {
      alertLevel = 'Emergency';
      eventType = 'SAFE_ZONE_EXIT';
      description = `Possible unauthorized exit detected in ${locationZone || 'Main Entrance'}.`;
    } else {
      description = `Passive safety alert detected in ${locationZone || 'Living Room'}.`;
    }

    const eventData = {
      _id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      familyCode,
      eventType,
      alertLevel,
      locationZone: locationZone || 'Living Room',
      description,
      status: 'Alerted',
      timestamp: now.toISOString()
    };

    memorySafetyEvents.unshift(eventData);

    // Save to Supabase if connected
    if (supabase) {
      try {
        await supabase.from('safety_events').insert([
          {
            family_code: familyCode,
            event_type: eventType,
            alert_level: alertLevel,
            location_zone: eventData.locationZone,
            description,
            status: 'Alerted',
            timestamp: eventData.timestamp
          }
        ]);
      } catch (e) {}
    }

    // Save to MongoDB if connected
    if (mongoose.connection.readyState === 1) {
      try {
        await SafetyEvent.create({
          familyCode,
          eventType,
          alertLevel,
          locationZone: eventData.locationZone,
          description,
          status: 'Alerted',
          timestamp: now
        });
      } catch (e) {}
    }

    console.log(`🛡️ [SAFETY TELEMETRY EVENT] ${alertLevel} - ${eventType} for ${familyCode}`);
    return res.status(200).json({ success: true, event: eventData });
  } catch (err) {
    console.error('Safety telemetry error:', err);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * 2. GET /api/safety/history/:familyCode
 * @desc Fetch safety event history logs for caregiver dashboard
 */
router.get('/safety/history/:familyCode', async (req, res) => {
  const { familyCode } = req.params;

  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('safety_events')
        .select('*')
        .eq('family_code', familyCode)
        .order('timestamp', { ascending: false })
        .limit(50);

      if (!error && data && data.length > 0) {
        const formatted = data.map((e) => ({
          _id: e.id,
          familyCode: e.family_code,
          eventType: e.event_type || e.eventType,
          alertLevel: e.alert_level || e.alertLevel,
          locationZone: e.location_zone || e.locationZone || 'Living Room',
          description: e.description,
          status: e.status || 'Alerted',
          timestamp: e.timestamp
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    }
  } catch (e) {}

  if (mongoose.connection.readyState === 1) {
    try {
      const events = await SafetyEvent.find({ familyCode })
        .sort({ timestamp: -1 })
        .limit(50)
        .exec();

      if (events && events.length > 0) {
        const formatted = events.map((e) => ({
          _id: e._id.toString(),
          familyCode: e.familyCode,
          eventType: e.eventType,
          alertLevel: e.alertLevel,
          locationZone: e.locationZone,
          description: e.description,
          status: e.status,
          timestamp: e.timestamp
        }));
        return res.status(200).json({ success: true, count: formatted.length, data: formatted });
      }
    } catch (e) {}
  }

  const filtered = memorySafetyEvents.filter((e) => e.familyCode === familyCode);
  return res.status(200).json({ success: true, count: filtered.length, data: filtered });
});

module.exports = router;
