-- Enable pgvector extension (if available on your Supabase plan)
create extension if not exists vector;

-- 1. Visitors Table Schema
create table if not exists visitors (
  id uuid primary key default gen_random_uuid(),
  family_code text not null,
  name text not null,
  relationship text not null,
  context_note text default '',
  embedding float8[] not null, -- 128-D float array extracted by @vladmandic/face-api
  photo_thumbnail text default '',
  is_registered boolean default true,
  created_at timestamp with time zone default now(),
  updated_at timestamp with time zone default now()
);

-- Index for fast lookup by family code
create index if not exists idx_visitors_family_code on visitors(family_code);

-- 2. Unknown Queue Table Schema
create table if not exists unknown_queue (
  id uuid primary key default gen_random_uuid(),
  family_code text not null,
  photo_thumbnail text not null,
  embedding float8[] not null, -- 128-D float array live snapshot
  status text check (status in ('PENDING_REVIEW', 'APPROVED', 'DISMISSED')) default 'PENDING_REVIEW',
  timestamp timestamp with time zone default now(),
  created_at timestamp with time zone default now()
);

-- Index for fast lookup by family code
create index if not exists idx_unknown_queue_family_code on unknown_queue(family_code);

-- 3. Families Table Schema (Multi-Tenant Auth)
create table if not exists families (
  id uuid primary key default gen_random_uuid(),
  family_code text not null unique,
  family_name text not null,
  email text not null unique,
  password text not null,
  created_at timestamp with time zone default now()
);

-- Indexes for fast lookup by email and family code
create index if not exists idx_families_email on families(email);
create index if not exists idx_families_family_code on families(family_code);

-- Enable Row Level Security (RLS)
alter table visitors enable row level security;
alter table unknown_queue enable row level security;
alter table families enable row level security;

-- Public read/write policies
create policy "Allow public read/write on visitors" on visitors for all using (true) with check (true);
create policy "Allow public read/write on unknown_queue" on unknown_queue for all using (true) with check (true);
create policy "Allow public read/write on families" on families for all using (true) with check (true);
