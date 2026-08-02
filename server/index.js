const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const visitorRoutes = require('./routes/visitorRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/memoriacare';

mongoose.set('bufferCommands', false);

let isDbConnected = false;

async function connectToDatabase() {
  if (isDbConnected || (mongoose.connections && mongoose.connections[0].readyState === 1)) {
    isDbConnected = true;
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    isDbConnected = true;
    console.log('Successfully connected to MongoDB database.');
  } catch (err) {
    console.warn('MongoDB not running locally. Using Supabase & instant in-memory store.');
  }
}

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'MemoriaCare API Server',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/auth', authRoutes);
app.use('/api', visitorRoutes);

if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
