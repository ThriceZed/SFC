-- ============================================================
-- SFC: Student Film Connection · Supabase schema
-- Run this in your Supabase project's SQL Editor (one time).
-- Then paste your Project URL + anon key into js/config.js.
-- ============================================================

-- ---------- profiles ----------
-- One row per auth user. id == auth.users.id
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  full_name     text not null,
  is_group      boolean default false,
  group_name    text default '',
  roles         text[] default '{}',
  experience    text default 'first-timer',   -- first-timer | intermediate | advanced
  gear          text default '',
  location      text default '',
  area_code     text default '',
  bio           text default '',
  contact_email text default '',
  contact_ig    text default '',
  contact_phone text default '',
  created_at    timestamptz default now()
);

-- ---------- productions ----------
create table if not exists public.productions (
  id            uuid primary key default gen_random_uuid(),
  creator_id    uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  type          text default 'project',        -- project | shoot
  logline       text default '',
  description   text default '',
  open_to_any   boolean default false,
  roles_needed  jsonb default '[]',            -- [{ "role": "Gaffer", "count": 1 }, ...]
  start_date    date,
  end_date      date,
  location      text default '',
  area_code     text default '',
  paid          boolean default false,
  gear_provided text default '',
  status        text default 'recruiting',     -- recruiting | full | wrapped
  awards        text default '',
  notable       boolean default false,
  created_at    timestamptz default now()
);

-- ---------- applications ----------
create table if not exists public.applications (
  id            uuid primary key default gen_random_uuid(),
  production_id uuid not null references public.productions(id) on delete cascade,
  applicant_id  uuid not null references public.profiles(id) on delete cascade,
  role          text default '',
  message       text default '',
  status        text default 'pending',        -- pending | accepted | declined
  created_at    timestamptz default now(),
  unique (production_id, applicant_id)          -- one application per person per production
);

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles     enable row level security;
alter table public.productions  enable row level security;
alter table public.applications enable row level security;

-- profiles: anyone signed in can read (needed to show creators/applicants);
-- you may only insert/update your own row.
create policy "profiles readable" on public.profiles
  for select using (true);
create policy "insert own profile" on public.profiles
  for insert with check (auth.uid() = id);
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

-- productions: readable by all; only the creator can write.
create policy "productions readable" on public.productions
  for select using (true);
create policy "create own production" on public.productions
  for insert with check (auth.uid() = creator_id);
create policy "update own production" on public.productions
  for update using (auth.uid() = creator_id);
create policy "delete own production" on public.productions
  for delete using (auth.uid() = creator_id);

-- applications: an applicant sees their own; a production owner sees
-- applications to their productions. Applicants create their own.
-- Only the production owner changes status (accept/decline).
create policy "read own or owned applications" on public.applications
  for select using (
    auth.uid() = applicant_id
    or auth.uid() = (select creator_id from public.productions p where p.id = production_id)
  );
create policy "create own application" on public.applications
  for insert with check (auth.uid() = applicant_id);
create policy "owner updates application" on public.applications
  for update using (
    auth.uid() = (select creator_id from public.productions p where p.id = production_id)
  );

-- ============================================================
-- Helpful indexes
-- ============================================================
create index if not exists idx_prod_creator on public.productions(creator_id);
create index if not exists idx_prod_area    on public.productions(area_code);
create index if not exists idx_app_prod      on public.applications(production_id);
create index if not exists idx_app_applicant on public.applications(applicant_id);
