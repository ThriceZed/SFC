-- ============================================================
-- SFC migration 002
-- Run this in the Supabase SQL Editor after the original
-- supabase/schema.sql. Safe to re-run.
--
--   1. Split names into first_name / last_name
--   2. Track when an application was last decided (for notifications)
--   3. Let a production owner add crew they already know
-- ============================================================

-- ---------- 1. first / last name ----------
alter table public.profiles add column if not exists first_name text default '';
alter table public.profiles add column if not exists last_name  text default '';

-- Backfill anyone who signed up before the split.
update public.profiles
set first_name = split_part(full_name, ' ', 1),
    last_name  = case when position(' ' in full_name) > 0
                      then substr(full_name, position(' ' in full_name) + 1)
                      else '' end
where coalesce(first_name, '') = '' and coalesce(full_name, '') <> '';

-- ---------- 2. applications.updated_at ----------
-- The notifications feed needs to know when a verdict landed, not just
-- when the application was created.
alter table public.applications
  add column if not exists updated_at timestamptz default now();

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists applications_touch_updated on public.applications;
create trigger applications_touch_updated
  before update on public.applications
  for each row execute function public.touch_updated_at();

-- ---------- 3. rebuild handle_new_user for the name split ----------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  f text := coalesce(new.raw_user_meta_data ->> 'first_name', '');
  l text := coalesce(new.raw_user_meta_data ->> 'last_name', '');
begin
  insert into public.profiles (
    id, username, first_name, last_name, full_name,
    is_group, group_name, roles, experience, gear, location, area_code, bio,
    contact_email, contact_ig, contact_phone
  )
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'username', ''),
      'user_' || substr(replace(new.id::text, '-', ''), 1, 8)
    ),
    f,
    l,
    -- Prefer an explicit full_name, else compose it from the parts.
    coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(btrim(f || ' ' || l), '')
    ),
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

-- ---------- 4. owner can add crew they already know ----------
-- The existing "create own application" policy only lets you insert a row
-- for yourself. This adds a second permissive insert policy so a creator
-- can put a known collaborator straight onto their own production.
-- Postgres ORs permissive policies together, so both paths stay open.
drop policy if exists "owner adds crew" on public.applications;
create policy "owner adds crew" on public.applications
  for insert with check (
    auth.uid() = (select creator_id from public.productions p where p.id = production_id)
  );
