alter table public.profiles
  add column email text;

alter table public.profiles
  alter column privacy_notice_version set default '2026-11-25';

update public.profiles p
set email = lower(trim(u.email))
from auth.users u
where u.id = p.id
  and u.email is not null;

alter table public.profiles
  alter column phone drop not null,
  drop constraint if exists profiles_phone_check,
  drop constraint if exists profiles_phone_key;

alter table public.profiles
  add constraint profiles_phone_e164_check
    check (phone is null or phone ~ '^\+[1-9][0-9]{7,14}$');

create unique index profiles_email_lower_idx
  on public.profiles (lower(email))
  where email is not null;

create or replace function public.protect_user_profile_fields()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    if new.role is distinct from old.role
      or new.phone_verified is distinct from old.phone_verified
      or new.verification_status is distinct from old.verification_status
      or new.account_status is distinct from old.account_status
      or new.privacy_consent_at is distinct from old.privacy_consent_at
      or new.privacy_notice_version is distinct from old.privacy_notice_version
      or new.id is distinct from old.id
      or new.email is distinct from old.email then
      raise exception 'Protected profile fields cannot be changed by this account';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  selected_role public.account_role;
begin
  if new.raw_user_meta_data ->> 'privacy_consent' is distinct from 'true'
    or new.raw_user_meta_data ->> 'privacy_notice_version' is distinct from '2026-11-25' then
    raise exception 'Privacy notice acknowledgement is required';
  end if;
  if new.raw_user_meta_data ->> 'account_type' is null
    or new.raw_user_meta_data ->> 'account_type' not in ('PRIEST', 'TEMPLE_MANAGEMENT') then
    raise exception 'A supported account type is required';
  end if;
  if length(trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''))) not between 2 and 120 then
    raise exception 'A valid full name is required';
  end if;
  if new.email is null or length(trim(new.email)) = 0 then
    raise exception 'An email address is required';
  end if;
  selected_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'TEMPLE_MANAGEMENT' then 'TEMPLE_MANAGEMENT'::public.account_role
    else 'PRIEST'::public.account_role
  end;
  insert into public.profiles (id, full_name, email, role)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'full_name'),
    lower(trim(new.email)),
    selected_role
  );
  return new;
end;
$$;

create or replace function public.sync_profile_email()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles
  set email = nullif(lower(trim(new.email)), '')
  where id = new.id;
  return new;
end;
$$;

create trigger auth_user_email_updated
after update of email on auth.users
for each row
when (old.email is distinct from new.email)
execute function public.sync_profile_email();

revoke execute on function public.record_recovery_request(text, text, text) from service_role;
revoke execute on function public.admin_resolve_recovery_request(uuid, text) from authenticated;
revoke select, update on public.recovery_requests from authenticated;
revoke all on function public.sync_profile_email() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.protect_user_profile_fields() from public, anon, authenticated;
