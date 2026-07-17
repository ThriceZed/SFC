-- ============================================================
-- SFC migration 003
-- Run this AFTER migration_002.sql (it uses public.is_staff(),
-- defined there). Safe to re-run.
--
--   1. Staff can edit any profile's non-badge fields (moderation)
--   2. Crew a creator adds directly, and optional edit permission
--   3. Follows (one-directional) and friendships (request/accept)
--   4. SFC+ codes: one redemption per code, staff-issued only
--
-- ISSUING A CODE (also doable from the Moderate > SFC+ Codes panel):
--   insert into public.codes (code, created_by)
--   values ('SFC-LAUNCH-01', (select id from public.profiles where username = 'your_username'));
-- ============================================================

-- ---------- 1. staff can moderate any profile ----------
-- Non-badge fields only in practice: protect_profile_badges (migration_002)
-- resets `badges` on every update coming from the authenticated/anon roles,
-- staff included, so this policy can't be used to self-grant or grant badges.
drop policy if exists "staff update profiles" on public.profiles;
create policy "staff update profiles" on public.profiles
  for update using (public.is_staff()) with check (public.is_staff());

-- ---------- 2. crew added directly by the creator ----------
alter table public.applications add column if not exists added_by_creator boolean default false;
alter table public.applications add column if not exists can_edit         boolean default false;

-- A crew member the creator marked as an editor can update the production's
-- details (not delete it, and not touch the roster: that's still owner/staff
-- only via the existing "update own production" / "staff update productions"
-- policies plus applications' own policies).
drop policy if exists "crew editor updates production" on public.productions;
create policy "crew editor updates production" on public.productions
  for update using (
    exists (
      select 1 from public.applications a
      where a.production_id = productions.id
        and a.applicant_id = auth.uid()
        and a.status = 'accepted'
        and a.can_edit = true
    )
  )
  with check (
    exists (
      select 1 from public.applications a
      where a.production_id = productions.id
        and a.applicant_id = auth.uid()
        and a.status = 'accepted'
        and a.can_edit = true
    )
  );

-- ---------- 3. follows + friendships ----------
create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  followee_id uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);
alter table public.follows enable row level security;

drop policy if exists "follows readable" on public.follows;
create policy "follows readable" on public.follows for select using (true);
drop policy if exists "follow as self" on public.follows;
create policy "follow as self" on public.follows for insert with check (auth.uid() = follower_id);
drop policy if exists "unfollow as self" on public.follows;
create policy "unfollow as self" on public.follows for delete using (auth.uid() = follower_id);

create table if not exists public.friendships (
  id           uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles(id) on delete cascade,
  addressee_id uuid not null references public.profiles(id) on delete cascade,
  status       text not null default 'pending', -- pending | accepted
  created_at   timestamptz default now(),
  unique (requester_id, addressee_id),
  check (requester_id <> addressee_id)
);
alter table public.friendships enable row level security;

-- One request in flight per pair, either direction: A -> B blocks B -> A too.
create or replace function public.prevent_duplicate_friend_request()
returns trigger language plpgsql as $$
begin
  if exists (
    select 1 from public.friendships
    where requester_id = new.addressee_id and addressee_id = new.requester_id
  ) then
    raise exception 'A friend request already exists between these two people.';
  end if;
  return new;
end;
$$;
drop trigger if exists friendships_prevent_dup on public.friendships;
create trigger friendships_prevent_dup before insert on public.friendships
  for each row execute function public.prevent_duplicate_friend_request();

drop policy if exists "friendships readable by participants" on public.friendships;
create policy "friendships readable by participants" on public.friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id or public.is_staff());
drop policy if exists "send friend request" on public.friendships;
create policy "send friend request" on public.friendships
  for insert with check (auth.uid() = requester_id);
-- Only the addressee accepts (pending -> accepted). Cancelling, declining, and
-- unfriending are all just deletes, by either side, at any status.
drop policy if exists "accept friend request" on public.friendships;
create policy "accept friend request" on public.friendships
  for update using (auth.uid() = addressee_id) with check (auth.uid() = addressee_id);
drop policy if exists "remove friendship" on public.friendships;
create policy "remove friendship" on public.friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- ---------- 4. SFC+ codes ----------
create table if not exists public.codes (
  code        text primary key,
  assigned_to uuid references public.profiles(id) on delete set null,
  assigned_at timestamptz,
  created_at  timestamptz default now(),
  created_by  uuid references public.profiles(id)
);
alter table public.codes enable row level security;

-- Staff create, list, and manage codes directly. Everyone else only ever
-- touches this table through redeem_sfc_plus_code() below, which is why
-- there's no "redeem as self" policy here at all.
drop policy if exists "staff manage codes" on public.codes;
create policy "staff manage codes" on public.codes
  for all using (public.is_staff()) with check (public.is_staff());

-- security definer so it can grant the SFC+ badge (protect_profile_badges
-- only allows badge writes from a current_user outside authenticated/anon,
-- which this function is once it runs as its owner).
create or replace function public.redeem_sfc_plus_code(p_code text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Sign in to redeem a code.';
  end if;

  update public.codes
    set assigned_to = v_uid, assigned_at = now()
    where code = p_code and assigned_to is null;

  if not found then
    raise exception 'That code is invalid or already used.';
  end if;

  update public.profiles
    set badges = array(select distinct unnest(coalesce(badges, '{}') || array['SFC+']))
    where id = v_uid;
end;
$$;
grant execute on function public.redeem_sfc_plus_code(text) to authenticated;
