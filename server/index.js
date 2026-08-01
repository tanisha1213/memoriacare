const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
require('dotenv').config();

const visitorRoutes = require('./routes/visitorRoutes');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/memoriacare';

// Disable Mongoose command buffering for fast serverless responses
mongoose.set('bufferCommands', false);

// 1. Serverless Database Connection Reuse Handler
let isDbConnected = false;

async function connectToDatabase() {
  if (isDbConnected || (mongoose.connections && mongoose.connections[0].readyState === 1)) {
    isDbConnected = true;
    return;
  }

  try {
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 2000 });
    isDbConnected = true;
    console.log(' Successfully connected to MongoDB database.');
  } catch (err) {
    console.warn('⚠️ MongoDB not running locally. Using Supabase & instant in-memory store for 100% availability.');
  }
}

// 2. Middleware & 10MB Payload Guards (BEFORE all routes)
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

// Serverless DB Connection Middleware
app.use(async (req, res, next) => {
  await connectToDatabase();
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'online',
    service: 'MemoriaCare API Server',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api', visitorRoutes);

// Local listener (only starts when run directly via node index.js)
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 MemoriaCare backend server running on http://localhost:${PORT}`);
  });
}

module.exports = app;
