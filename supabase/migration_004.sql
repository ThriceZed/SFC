-- ============================================================
-- SFC migration 004
-- Run after migration_003.sql. Safe to re-run.
--
--   1. Staff can grant or revoke SFC+ from the Moderate panel
--
-- Codes themselves need no new policy: "staff manage codes"
-- (migration_003) is FOR ALL, which already covers delete.
-- ============================================================

-- Badges are not client-writable (protect_profile_badges resets them on any
-- update coming from the authenticated/anon roles). That protection is what
-- stops anyone handing themselves SFC+ or Staff, so the Moderate panel can't
-- just UPDATE the column either.
--
-- security definer runs this as the function owner, so current_user inside
-- the badge trigger is no longer 'authenticated' and the write is allowed.
-- The is_staff() check is what keeps that power staff-only, and it's
-- evaluated against the *caller* (auth.uid()), not the owner.
create or replace function public.set_sfc_plus(p_user uuid, p_on boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_staff() then
    raise exception 'Staff only.';
  end if;

  if p_on then
    update public.profiles
      set badges = array(select distinct unnest(coalesce(badges, '{}') || array['SFC+']))
      where id = p_user;
  else
    update public.profiles
      set badges = array_remove(coalesce(badges, '{}'), 'SFC+')
      where id = p_user;
  end if;

  if not found then
    raise exception 'That profile no longer exists.';
  end if;
end;
$$;

revoke all on function public.set_sfc_plus(uuid, boolean) from public, anon;
grant execute on function public.set_sfc_plus(uuid, boolean) to authenticated;
