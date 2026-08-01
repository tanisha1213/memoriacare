const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const Family = require('../models/Family');
const supabase = require('../supabaseClient');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'memoriacare_secret_key_2026';

// Persistent File DB Backup (Uses /tmp on Vercel serverless containers, local file in dev)
const DB_FILE = process.env.VERCEL
  ? path.join('/tmp', 'families_db.json')
  : path.join(__dirname, '../families_db.json');

function loadLocalFamilies() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {
    console.warn('Error reading families DB:', e.message);
  }
  return [];
}

function saveLocalFamily(family) {
  try {
    const list = loadLocalFamilies();
    list.push(family);
    fs.writeFileSync(DB_FILE, JSON.stringify(list, null, 2), 'utf8');
  } catch (e) {
    console.warn('Error saving families DB:', e.message);
  }
}

/**
 * 1. POST /api/auth/register
 * @desc Register a new family account and return JWT token
 */
router.post('/register', async (req, res) => {
  try {
    const { familyName, email, password } = req.body;

    if (!familyName || !email || !password) {
      return res.status(400).json({ success: false, error: 'All fields are required.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanName = familyName.trim();

    // 1. Check local file database
    const localList = loadLocalFamilies();
    const existingLocal = localList.find((f) => f.email === cleanEmail);
    if (existingLocal) {
      return res.status(400).json({ success: false, error: 'Email is already registered.' });
    }

    // 2. Check Mongoose if connected
    if (mongoose.connection.readyState === 1) {
      try {
        const existingDb = await Family.findOne({ email: cleanEmail }).exec();
        if (existingDb) {
          return res.status(400).json({ success: false, error: 'Email is already registered.' });
        }
      } catch (e) {}
    }

    // 3. Check Supabase (use maybeSingle so 0 rows return null instead of throwing)
    if (supabase) {
      try {
        const { data, error } = await supabase.from('families').select('*').eq('email', cleanEmail).maybeSingle();
        if (!error && data) {
          return res.status(400).json({ success: false, error: 'Email is already registered.' });
        }
      } catch (e) {}
    }

    // Generate unique random family code (e.g., FAM-4821)
    const randomDigits = Math.floor(1000 + Math.random() * 9000);
    const familyCode = `FAM-${randomDigits}`;

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const familyData = {
      _id: `fam_${Date.now()}`,
      familyCode,
      familyName: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      createdAt: new Date().toISOString()
    };

    // Save to local file DB
    saveLocalFamily(familyData);

    // Save to Mongoose if connected
    if (mongoose.connection.readyState === 1) {
      new Family({
        familyCode,
        familyName: cleanName,
        email: cleanEmail,
        password: hashedPassword
      })
        .save()
        .catch((e) => console.warn('Mongoose save family notice:', e.message));
    }

    // Save to Supabase if connected
    if (supabase) {
      supabase
        .from('families')
        .insert([
          {
            family_code: familyCode,
            family_name: cleanName,
            email: cleanEmail,
            password: hashedPassword
          }
        ])
        .then(() => {})
        .catch((e) => console.warn('Supabase save family notice:', e.message));
    }

    // Create JWT Token
    const token = jwt.sign(
      { familyCode, familyId: familyData._id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`👤 [FAMILY REGISTERED] ${cleanName} (${familyCode}) registered with email ${cleanEmail}`);

    return res.status(201).json({
      success: true,
      token,
      familyCode,
      familyName: cleanName
    });
  } catch (err) {
    console.error('Register Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to create family account.' });
  }
});

/**
 * 2. POST /api/auth/login
 * @desc Authenticate family account and return JWT token
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Please enter email and password.' });
    }

    const cleanEmail = email.toLowerCase().trim();
    let family = null;

    // 1. Check local file DB first
    const localList = loadLocalFamilies();
    family = localList.find((f) => f.email === cleanEmail);

    // 2. Check Supabase
    if (!family && supabase) {
      try {
        const { data, error } = await supabase.from('families').select('*').eq('email', cleanEmail).maybeSingle();
        if (!error && data) {
          family = {
            _id: data.id,
            familyCode: data.family_code,
            familyName: data.family_name,
            email: data.email,
            password: data.password
          };
        }
      } catch (e) {}
    }

    // 3. Check Mongoose
    if (!family && mongoose.connection.readyState === 1) {
      try {
        family = await Family.findOne({ email: cleanEmail }).exec();
      } catch (e) {}
    }

    if (!family) {
      return res.status(400).json({ success: false, error: 'Invalid email or password.' });
    }

    const isMatch = await bcrypt.compare(password, family.password);
    if (!isMatch) {
      return res.status(400).json({ success: false, error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { familyCode: family.familyCode, familyId: family._id },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    console.log(`🔑 [FAMILY LOGIN SUCCESS] ${family.familyName} (${family.familyCode}) logged in`);

    return res.status(200).json({
      success: true,
      token,
      familyCode: family.familyCode,
      familyName: family.familyName
    });
  } catch (err) {
    console.error('Login Error:', err);
    return res.status(500).json({ success: false, error: 'Failed to log in.' });
  }
});

module.exports = router;
