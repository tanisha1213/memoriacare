const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://dwraiibtssjclhmlnazs.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3cmFpaWJ0c3NqY2xobWxuYXpzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU1NDQ1NzIsImV4cCI6MjEwMTEyMDU3Mn0.lpUUU6fTLCGqerEmufT-0Nrd4yVhbWeGrppmg8i_LEA';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

module.exports = supabase;
