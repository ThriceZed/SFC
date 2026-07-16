-- ============================================================
-- SFC: Student Film Connection · Supabase schema
-- Run this in your Supabase project's SQL Editor.
-- Safe to re-run: every object is dropped/replaced first.
-- Then paste your Project URL + anon key into js/config.js.
-- ============================================================

-- ---------- profiles ----------
-- One row per auth user. id == auth.users.id
-- Rows are created by the handle_new_user() trigger below, NOT by the
-- browser: at signup time the client has no session yet (Supabase issues
-- one only after email confirmation), so a client-side insert would be
-- anonymous and RLS would reject it.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  username      text unique not null,
  full_name     text not null default '',
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
-- Auto-create a profile whenever an auth user is created.
-- The signup form's fields ride along in raw_user_meta_data
-- (the client passes them as auth.signUp options.data).
-- security definer lets this bypass RLS, which is the point.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, username, full_name, is_group, group_name, roles,
    experience, gear, location, area_code, bio,
    contact_email, contact_ig, contact_phone
  )
  values (
    new.id,
    -- username must be unique and non-null; fall back to a derived one.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    ),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce((new.raw_user_meta_data ->> 'is_group')::boolean, false),
    coalesce(new.raw_user_meta_data ->> 'group_name', ''),
    coalesce(
      (select array_agg(r) from jsonb_array_elements_text(
         case jsonb_typeof(new.raw_user_meta_data -> 'roles')
           when 'array' then new.raw_user_meta_data -> 'roles'
           else '[]'::jsonb
         end
       ) as t(r)),
      '{}'::text[]
    ),
    coalesce(nullif(new.raw_user_meta_data ->> 'experience', ''), 'first-timer'),
    coalesce(new.raw_user_meta_data ->> 'gear', ''),
    coalesce(new.raw_user_meta_data ->> 'location', ''),
    coalesce(new.raw_user_meta_data ->> 'area_code', ''),
    coalesce(new.raw_user_meta_data ->> 'bio', ''),
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'contact_ig', ''),
    coalesce(new.raw_user_meta_data ->> 'contact_phone', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- Row Level Security
-- ============================================================
alter table public.profiles     enable row level security;
alter table public.productions  enable row level security;
alter table public.applications enable row level security;

-- profiles: readable by anyone (needed to show creators and applicants).
-- The trigger owns inserts, so there is deliberately no insert policy.
drop policy if exists "profiles readable" on public.profiles;
create policy "profiles readable" on public.profiles
  for select using (true);

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- productions: readable by all; only the creator can write.
drop policy if exists "productions readable" on public.productions;
create policy "productions readable" on public.productions
  for select using (true);

drop policy if exists "create own production" on public.productions;
create policy "create own production" on public.productions
  for insert with check (auth.uid() = creator_id);

drop policy if exists "update own production" on public.productions;
create policy "update own production" on public.productions
  for update using (auth.uid() = creator_id) with check (auth.uid() = creator_id);

drop policy if exists "delete own production" on public.productions;
create policy "delete own production" on public.productions
  for delete using (auth.uid() = creator_id);

-- applications: an applicant sees their own; a production owner sees
-- applications to their productions. Applicants create their own.
-- Only the production owner changes status (accept/decline).
drop policy if exists "read own or owned applications" on public.applications;
create policy "read own or owned applications" on public.applications
  for select using (
    auth.uid() = applicant_id
    or auth.uid() = (select creator_id from public.productions p where p.id = production_id)
  );

drop policy if exists "create own application" on public.applications;
create policy "create own application" on public.applications
  for insert with check (auth.uid() = applicant_id);

drop policy if exists "owner updates application" on public.applications;
create policy "owner updates application" on public.applications
  for update using (
    auth.uid() = (select creator_id from public.productions p where p.id = production_id)
  );

-- ============================================================
-- Helpful indexes
-- ============================================================
create index if not exists idx_prod_creator   on public.productions(creator_id);
create index if not exists idx_prod_area      on public.productions(area_code);
create index if not exists idx_app_prod       on public.applications(production_id);
create index if not exists idx_app_applicant  on public.applications(applicant_id);
