const mongoose = require('mongoose');
require('dotenv').config();
const Visitor = require('./models/Visitor.js');
const supabase = require('./supabaseClient');

async function verifyVectors() {
  console.log('🔍 Running MemoriaCare Database Vector Verification...');
  console.log('=' .repeat(60));

  // 1. Check Supabase
  if (supabase) {
    try {
      const { data, error } = await supabase.from('visitors').select('*');
      if (!error && data) {
        console.log(`\n📊 Total Registered Visitors in Supabase: ${data.length}`);
        data.forEach((v, idx) => {
          const isValidArray = Array.isArray(v.embedding);
          const length = v.embedding ? v.embedding.length : 0;
          console.log(`👤 [${idx + 1}] Name: ${v.name} | Relationship: ${v.relationship} | FamilyCode: ${v.family_code}`);
          console.log(`   ID: ${v.id}`);
          console.log(`   Vector Length: ${length} | Valid Array: ${isValidArray}`);
          if (length === 128 && isValidArray) {
            console.log(`   Status:  VALID 128-D FLOAT ARRAY FOR FACE RECOGNITION`);
          } else {
            console.log(`   Status: ⚠️ INVALID VECTOR FORMAT`);
          }
        });
      }
    } catch (e) {
      console.warn('Supabase check skipped:', e.message);
    }
  }

  // 2. Check MongoDB
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    try {
      console.log('\n Connecting to MongoDB...');
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 2000 });
      const visitors = await Visitor.find({});
      console.log(`\n📊 Total Registered Visitors in MongoDB: ${visitors.length}`);
      visitors.forEach((v, idx) => {
        const isValidArray = Array.isArray(v.embedding);
        const length = v.embedding ? v.embedding.length : 0;
        console.log(`👤 [${idx + 1}] Name: ${v.name} | Relationship: ${v.relationship} | FamilyCode: ${v.familyCode}`);
        console.log(`   ID: ${v._id}`);
        console.log(`   Vector Length: ${length} | Valid Array: ${isValidArray}`);
        if (length === 128 && isValidArray) {
          console.log(`   Status:  VALID 128-D FLOAT ARRAY FOR FACE RECOGNITION`);
        } else {
          console.log(`   Status: ⚠️ INVALID VECTOR FORMAT`);
        }
      });
      await mongoose.connection.close();
    } catch (err) {
      console.log(`⚠️ MongoDB offline or unreachable: ${err.message}`);
    }
  }

  console.log('\n=' .repeat(60));
  console.log(' Vector Verification Complete.\n');
  process.exit(0);
}

verifyVectors();
