# 🧠 MemoriaCare: AI Memory Mirror & Caregiver Support Platform

> **An Ambient Visual and Vocal Memory Prosthesis for Alzheimer's & Progressive Dementia Patients**

![License](https://img.shields.io/badge/License-MIT-emerald.svg)
![React](https://img.shields.io/badge/Frontend-React_18_%7C_Vite_5-blue.svg)
![Node](https://img.shields.io/badge/Backend-Express.js_%7C_Node.js-green.svg)
![AI Framework](https://img.shields.io/badge/Edge_AI-WebAssembly_%7C_face--api.js-orange.svg)
![Database](https://img.shields.io/badge/Database-Supabase_PostgreSQL_%7C_MongoDB-teal.svg)
![Deployment](https://img.shields.io/badge/Deployment-Vercel_Serverless-black.svg)

---

## 🌟 Overview

**MemoriaCare** is an intelligent, zero-click visual and vocal assistance system designed for individuals suffering from Alzheimer's disease, dementia, and visual agnosia (prosopagnosia). Operating as a natural "Patient Mirror" on any screen or tablet, MemoriaCare automatically scans faces using **client-side WebAssembly neural networks** right inside the browser.

When a registered family member or caregiver approaches, the mirror instantly presents a high-contrast visual cue card showing their name, relationship, and personal memory notes, while simultaneously speaking a reassuring greeting in their native language (**Hindi**, **Marathi**, or **English**).

If an unrecognized visitor approaches, MemoriaCare silently captures a snapshot, triggers a real-time chime on the remote Caregiver Dashboard, and enqueues the snapshot for instant one-click approval and memory tagging.

---

## 🚀 Key Features

- 🪞 **Zero-Click Edge AI Patient Mirror**: Passive, ambient facial detection and 128-dimensional Euclidean vector biometrics executing entirely inside client RAM via WebAssembly—**no raw video is ever uploaded to external cloud servers**.
- 🗣️ **Fluent Multilingual Memory Cues**: Real-time natural text-to-speech audio streaming in **Hindi (`hi-IN`)**, **Marathi (`mr-IN`)**, and **English (`en-US`)**, speaking the visitor's Name, Relationship, and Memory Context Notes (e.g., *"This is your daughter, Tanisha. Quick reminder: She brings fresh fruits every Sunday"*).
- 🪞 **Selfie Mirror Feed Reflection (`scaleX(-1)`)**: Renders a comfortable, natural selfie mirror reflection for the patient without affecting raw matrix feature extraction.
- 🔔 **Caregiver Review Dashboard**: Real-time snapshot queueing with Web Audio synthesizer chimes, browser desktop notifications, and 1-click visitor profile registration.
- 🛡️ **Multi-Tenant JWT Authentication**: Family account registration and sign-in generating unique isolated codes (`FAM-XXXX`) with 30-day JWT session tokens and `bcryptjs` password hashing.
- 💾 **3-Tier Resilient Storage Architecture**: Multi-database fallback pipeline spanning **Supabase PostgreSQL** (with `pgvector` & RLS), **MongoDB Atlas**, and an **Instant Local File Store** (`families_db.json` / `/tmp`).

---

## 🏗️ Architecture & Data Flow

```text
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                  CLIENT BROWSER                                   │
│                                                                                   │
│  ┌────────────────────┐        ┌─────────────────────┐        ┌────────────────┐  │
│  │ PatientMirror.jsx  │        │ CaregiverDash.jsx   │        │ AuthModal.jsx  │  │
│  └─────────┬──────────┘        └──────────┬──────────┘        └───────┬────────┘  │
│            │                              │                           │           │
│   WASM Face Detector             4s Queue Poller              JWT Auth Flow       │
│   (128-D Descriptors)                     │                           │           │
└────────────┼──────────────────────────────┼───────────────────────────┼───────────┘
             │                              │                           │
             │ Base64 Snapshot              │ GET /unknowns             │ POST /auth
             ▼                              ▼                           ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                              VERCEL SERVERLESS EDGE                               │
│                                                                                   │
│                                  vercel.json                                      │
│                                       │                                           │
│                                       ▼                                           │
│                                server/index.js                                    │
│                                       │                                           │
│                ┌──────────────────────┴──────────────────────┐                    │
│                ▼                                             ▼                    │
│       visitorRoutes.js                                authRoutes.js               │
│   (Sanitize Embedding & Proxy)                    (Bcrypt & JWT Sign)             │
└────────────────┬─────────────────────────────────────────────┬────────────────────┘
                 │                                             │
                 └──────────────────────┬──────────────────────┘
                                        │
                                        ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                             MULTI-TIERED PERSISTENCE                              │
│                                                                                   │
│   ┌────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐  │
│   │ Supabase PostgreSQL DB │  │   MongoDB Atlas DB     │  │ families_db.json   │  │
│   │  (pgvector + RLS)      │  │  (bufferCmds = false)  │  │  (Local & /tmp)    │  │
│   └────────────────────────┘  └────────────────────────┘  └────────────────────┘  │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Technology Stack

| Layer | Component | Description |
| :--- | :--- | :--- |
| **Frontend UI** | React 18, Vite 5, Tailwind CSS | High-contrast glassmorphic design system for cognitive care |
| **Edge AI Engine** | `@vladmandic/face-api` | WebAssembly TensorFlow.js (TinyFaceDetector, FaceLandmark68Net, FaceRecognitionNet) |
| **Backend API** | Node.js, Express.js | REST API server with 10MB payload limits and serverless connection pooling |
| **Auth & Security** | BcryptJS, JSON Web Tokens (JWT) | Salted password hashing and multi-tenant family code isolation |
| **Database Tier 1** | Supabase PostgreSQL | Relational cloud database with Row Level Security (RLS) and `pgvector` |
| **Database Tier 2** | MongoDB Atlas (Mongoose) | NoSQL document database with `bufferCommands = false` fallback |
| **Database Tier 3** | Local JSON File DB | File-backed storage (`families_db.json` / `/tmp`) for 100% offline availability |
| **Deployment** | Vercel Serverless | Single-repository `@vercel/node` and `@vercel/static-build` architecture |

---

## 💻 Local Installation & Setup

### Prerequisites
- Node.js (v18 or higher)
- npm or yarn

### 1. Clone Repository
```bash
git clone https://github.com/tanisha1213/memoriacare.git
cd memoriacare
```

### 2. Setup & Run Backend Server
```bash
cd server
npm install

# Start Express server on http://localhost:5000
npm start
```

### 3. Setup & Run Client Application (In a new terminal)
```bash
cd client
npm install

# Start Vite dev server on http://localhost:3000
npm run dev
```

Open `http://localhost:3000` in your web browser to start the app.

---

## 🗄️ Database Setup (Supabase SQL Schema)

If configuring **Supabase**, run the following migration script in your [Supabase SQL Editor](https://supabase.com/dashboard):

```sql
-- Enable pgvector extension
create extension if not exists vector;

-- 1. Visitors Table Schema
create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  family_code text not null,
  name text not null,
  relationship text not null,
  context_note text default '',
  embedding float8[] not null,
  photo_thumbnail text default '',
  is_registered boolean default true,
  created_at timestamp with time zone default now()
);

-- 2. Unknown Queue Table Schema
create table if not exists unknown_queue (
  id uuid primary key default gen_random_uuid(),
  family_code text not null,
  photo_thumbnail text not null,
  embedding float8[] not null,
  status text check (status in ('PENDING_REVIEW', 'APPROVED', 'DISMISSED')) default 'PENDING_REVIEW',
  timestamp timestamp with time zone default now()
);

-- 3. Families Table Schema (Multi-Tenant Auth)
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  family_code text not null unique,
  family_name text not null,
  email text not null unique,
  password text not null,
  created_at timestamp with time zone default now()
);

-- Enable Row Level Security (RLS)
alter table visitors enable row level security;
alter table unknown_queue enable row level security;
alter table families enable row level security;

create policy "Allow public read/write on visitors" on visitors for all using (true) with check (true);
create policy "Allow public read/write on unknown_queue" on unknown_queue for all using (true) with check (true);
create policy "Allow public read/write on families" on families for all using (true) with check (true);
```

---

## 🌐 Deploy to Vercel

1. Push your project to **GitHub**.
2. Import the repository into **[Vercel](https://vercel.com/new)**.
3. Vercel automatically detects `vercel.json` and builds both frontend and backend serverless endpoints.
4. Set Environment Variables on Vercel Dashboard:
   - `SUPABASE_URL`: `https://dwraiibtssjclhmlnazs.supabase.co`
   - `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6...`
   - `JWT_SECRET`: `memoriacare_production_secret_key_2026`

---

## 📄 License

This project is open-source and available under the **MIT License**.
