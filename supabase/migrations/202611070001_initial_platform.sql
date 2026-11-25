create extension if not exists pgcrypto;

create type public.account_role as enum ('PRIEST', 'TEMPLE_MANAGEMENT', 'ADMIN');
create type public.verification_status as enum (
  'NOT_SUBMITTED', 'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'CORRECTION_REQUIRED', 'REJECTED'
);
create type public.document_status as enum (
  'PENDING', 'UNDER_REVIEW', 'VERIFIED', 'CORRECTION_REQUIRED', 'REJECTED'
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (length(trim(full_name)) between 2 and 120),
  phone text not null unique check (phone ~ '^\+[1-9][0-9]{7,14}$'),
  role public.account_role not null default 'PRIEST',
  account_status text not null default 'ACTIVE' check (account_status in ('ACTIVE', 'SUSPENDED', 'CLOSED')),
  phone_verified boolean not null default false,
  privacy_consent_at timestamptz not null default now(),
  privacy_notice_version text not null default '2026-11-07',
  verification_status public.verification_status not null default 'NOT_SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.priests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  experience_years integer check (experience_years between 0 and 80),
  religious_education text,
  qualifications text,
  expertise text[] not null default '{}',
  languages text[] not null default '{}',
  preferred_locations text[] not null default '{}',
  availability text,
  expected_honorarium numeric(12, 2) check (expected_honorarium is null or expected_honorarium >= 0),
  public_listing boolean not null default false,
  verification_status public.verification_status not null default 'NOT_SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.temples (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null unique references public.profiles(id) on delete cascade,
  temple_name text not null check (length(trim(temple_name)) between 2 and 180),
  legal_structure text not null check (
    legal_structure in ('REGISTERED_TRUST', 'REGISTERED_SOCIETY', 'RELIGIOUS_INSTITUTION', 'INDIVIDUAL_OR_COMMITTEE', 'OTHER')
  ),
  registration_number text,
  address text,
  city text,
  state text,
  contact_phone text,
  management_details text,
  public_listing boolean not null default false,
  verification_status public.verification_status not null default 'NOT_SUBMITTED',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_type public.account_role not null check (owner_type in ('PRIEST', 'TEMPLE_MANAGEMENT')),
  document_category text not null check (length(trim(document_category)) between 2 and 80),
  file_name text not null check (length(file_name) between 1 and 255),
  storage_path text not null unique,
  mime_type text not null check (mime_type in ('application/pdf', 'image/jpeg', 'image/png')),
  file_size bigint not null check (file_size between 1 and 10485760),
  verification_status public.document_status not null default 'PENDING',
  uploaded_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  admin_remarks text,
  constraint documents_owner_path check (storage_path like (owner_id::text || '/%'))
);

create table public.verifications (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  owner_type public.account_role not null check (owner_type in ('PRIEST', 'TEMPLE_MANAGEMENT')),
  verification_category text not null,
  status public.verification_status not null default 'NOT_SUBMITTED',
  submitted_at timestamptz,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  rejection_reason text,
  internal_remarks text,
  verification_basis text,
  updated_at timestamptz not null default now(),
  unique (owner_id, verification_category)
);

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid not null,
  previous_status text,
  new_status text,
  verification_category text,
  remarks text,
  created_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  temple_id uuid not null references public.profiles(id) on delete cascade,
  title text not null check (length(trim(title)) between 5 and 160),
  description text not null check (length(trim(description)) > 0),
  location text not null check (length(trim(location)) > 0),
  compensation text,
  status text not null default 'DRAFT' check (status in ('DRAFT', 'PUBLISHED', 'CLOSED')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint published_opportunity_has_timestamp check (status <> 'PUBLISHED' or published_at is not null)
);

create table public.applications (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  priest_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'SUBMITTED' check (status in ('SUBMITTED', 'REVIEWING', 'SHORTLISTED', 'REJECTED', 'WITHDRAWN')),
  cover_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (opportunity_id, priest_id)
);

create table public.recovery_requests (
  id uuid primary key default gen_random_uuid(),
  requested_phone text not null,
  phone_hash text not null,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id),
  admin_notes text
);

create index profiles_role_status_idx on public.profiles(role, verification_status);
create index documents_owner_uploaded_idx on public.documents(owner_id, uploaded_at desc);
create index verifications_owner_status_idx on public.verifications(owner_id, status);
create index audit_logs_entity_created_idx on public.audit_logs(entity_type, entity_id, created_at desc);
create index notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index opportunities_status_created_idx on public.opportunities(status, created_at desc);
create index applications_priest_created_idx on public.applications(priest_id, created_at desc);
create index applications_opportunity_created_idx on public.applications(opportunity_id, created_at desc);
create index recovery_requests_created_idx on public.recovery_requests(created_at desc);
create index recovery_requests_phone_created_idx on public.recovery_requests(phone_hash, created_at desc);
create index recovery_requests_ip_created_idx on public.recovery_requests(ip_hash, created_at desc);

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_updated_at before update on public.profiles
for each row execute function public.set_updated_at();
create trigger priests_updated_at before update on public.priests
for each row execute function public.set_updated_at();
create trigger temples_updated_at before update on public.temples
for each row execute function public.set_updated_at();
create trigger opportunities_updated_at before update on public.opportunities
for each row execute function public.set_updated_at();
create trigger applications_updated_at before update on public.applications
for each row execute function public.set_updated_at();

create or replace function public.protect_application_identity()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin')
    and (new.opportunity_id is distinct from old.opportunity_id
      or new.priest_id is distinct from old.priest_id
      or new.created_at is distinct from old.created_at) then
    raise exception 'Application identity cannot be changed';
  end if;
  return new;
end;
$$;

create trigger applications_protect_identity before update on public.applications
for each row execute function public.protect_application_identity();

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
      or new.phone is distinct from old.phone then
      raise exception 'Protected profile fields cannot be changed by this account';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_protect_fields before update on public.profiles
for each row execute function public.protect_user_profile_fields();

create or replace function public.protect_verification_status()
returns trigger language plpgsql set search_path = ''
as $$
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Verification status is managed by authorised administrators';
  end if;
  return new;
end;
$$;

create trigger priests_protect_verification before update of verification_status on public.priests
for each row execute function public.protect_verification_status();
create trigger temples_protect_verification before update of verification_status on public.temples
for each row execute function public.protect_verification_status();

create or replace function public.invalidate_profile_review(p_profile_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.account_role;
  v_previous public.verification_status;
begin
  select role, verification_status into v_role, v_previous
  from public.profiles where id = p_profile_id for update;
  if not found or v_previous not in ('PENDING', 'UNDER_REVIEW', 'VERIFIED') then
    return;
  end if;

  update public.profiles set verification_status = 'NOT_SUBMITTED' where id = p_profile_id;
  if v_role = 'PRIEST' then
    update public.priests set verification_status = 'NOT_SUBMITTED' where profile_id = p_profile_id;
  elsif v_role = 'TEMPLE_MANAGEMENT' then
    update public.temples set verification_status = 'NOT_SUBMITTED' where profile_id = p_profile_id;
  end if;
  update public.verifications
  set status = 'NOT_SUBMITTED', submitted_at = null, reviewed_by = null, reviewed_at = null,
      rejection_reason = null, internal_remarks = null, verification_basis = null, updated_at = now()
  where owner_id = p_profile_id;

  insert into public.notifications(user_id, title, message)
  values (p_profile_id, 'Profile changes need review', 'Your profile changed after submission or verification. Please submit it again for manual review.');
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, previous_status, new_status)
  values ((select auth.uid()), 'PROFILE_CHANGED', 'PROFILE', p_profile_id, v_previous::text, 'NOT_SUBMITTED');
end;
$$;

create or replace function public.invalidate_review_after_profile_name_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if new.full_name is distinct from old.full_name then
    perform public.invalidate_profile_review(new.id);
  end if;
  return new;
end;
$$;

create trigger profiles_invalidate_review_after_name_change
after update of full_name on public.profiles
for each row execute function public.invalidate_review_after_profile_name_change();

create or replace function public.invalidate_review_after_priest_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'id' - 'profile_id' - 'verification_status' - 'public_listing' - 'created_at' - 'updated_at')
    is distinct from
     (to_jsonb(old) - 'id' - 'profile_id' - 'verification_status' - 'public_listing' - 'created_at' - 'updated_at') then
    perform public.invalidate_profile_review(new.profile_id);
  end if;
  return new;
end;
$$;

create trigger priests_invalidate_review_after_change
after update of experience_years, religious_education, qualifications, expertise, languages,
  preferred_locations, availability, expected_honorarium on public.priests
for each row execute function public.invalidate_review_after_priest_change();

create or replace function public.invalidate_review_after_temple_change()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if (to_jsonb(new) - 'id' - 'profile_id' - 'verification_status' - 'public_listing' - 'created_at' - 'updated_at')
    is distinct from
     (to_jsonb(old) - 'id' - 'profile_id' - 'verification_status' - 'public_listing' - 'created_at' - 'updated_at') then
    perform public.invalidate_profile_review(new.profile_id);
  end if;
  return new;
end;
$$;

create trigger temples_invalidate_review_after_change
after update of temple_name, legal_structure, registration_number, address, city, state,
  contact_phone, management_details on public.temples
for each row execute function public.invalidate_review_after_temple_change();

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
declare
  selected_role public.account_role;
begin
  if new.raw_user_meta_data ->> 'privacy_consent' is distinct from 'true'
    or new.raw_user_meta_data ->> 'privacy_notice_version' is distinct from '2026-11-07' then
    raise exception 'Privacy notice acknowledgement is required';
  end if;
  if new.raw_user_meta_data ->> 'account_type' is null
    or new.raw_user_meta_data ->> 'account_type' not in ('PRIEST', 'TEMPLE_MANAGEMENT') then
    raise exception 'A supported account type is required';
  end if;
  if length(trim(coalesce(new.raw_user_meta_data ->> 'full_name', ''))) not between 2 and 120 then
    raise exception 'A valid full name is required';
  end if;
  selected_role := case
    when new.raw_user_meta_data ->> 'account_type' = 'TEMPLE_MANAGEMENT' then 'TEMPLE_MANAGEMENT'::public.account_role
    else 'PRIEST'::public.account_role
  end;
  if new.phone is null or new.phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'A valid E.164 mobile number is required';
  end if;
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    trim(new.raw_user_meta_data ->> 'full_name'),
    new.phone,
    selected_role
  );
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.notify_document_uploaded()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.notifications(user_id, title, message)
  values (new.owner_id, 'Document uploaded', 'Your supporting document is stored privately and is awaiting manual review.');
  return new;
end;
$$;

create trigger documents_notify_owner after insert on public.documents
for each row execute function public.notify_document_uploaded();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'ADMIN' and p.account_status = 'ACTIVE'
  );
$$;

create or replace function public.submit_verification()
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.account_role;
  v_status public.verification_status;
  v_categories text[];
  v_category text;
begin
  select p.role, p.verification_status
    into v_role, v_status
  from public.profiles p
  where p.id = (select auth.uid()) and p.account_status = 'ACTIVE';

  if not found or v_role not in ('PRIEST', 'TEMPLE_MANAGEMENT') then
    raise exception 'An active priest or temple account is required';
  end if;
  if v_role = 'PRIEST' and not exists (
    select 1 from public.priests pr where pr.profile_id = (select auth.uid())
  ) then
    raise exception 'Complete your priest profile before submitting';
  end if;
  if v_role = 'TEMPLE_MANAGEMENT' and not exists (
    select 1 from public.temples t where t.profile_id = (select auth.uid())
  ) then
    raise exception 'Complete your temple profile before submitting';
  end if;
  if v_status = 'VERIFIED' then
    raise exception 'This profile is already verified';
  end if;

  v_categories := case when v_role = 'PRIEST'
    then array['CONTACT_INFORMATION', 'PROFESSIONAL_PROFILE', 'QUALIFICATIONS', 'EXPERIENCE']
    else array['TEMPLE_INFORMATION', 'MANAGEMENT_REPRESENTATIVE', 'LEGAL_STRUCTURE', 'REGISTRATION']
  end;

  update public.profiles set verification_status = 'PENDING' where id = (select auth.uid());
  if v_role = 'PRIEST' then
    update public.priests set verification_status = 'PENDING' where profile_id = (select auth.uid());
  else
    update public.temples set verification_status = 'PENDING' where profile_id = (select auth.uid());
  end if;

  foreach v_category in array v_categories loop
    insert into public.verifications(owner_id, owner_type, verification_category, status, submitted_at)
    values ((select auth.uid()), v_role, v_category, 'PENDING', now())
    on conflict (owner_id, verification_category) do update
      set owner_type = excluded.owner_type,
          status = 'PENDING',
          submitted_at = now(),
          reviewed_by = null,
          reviewed_at = null,
          rejection_reason = null,
          internal_remarks = null,
          verification_basis = null,
          updated_at = now();
  end loop;

  insert into public.notifications(user_id, title, message)
  values ((select auth.uid()), 'Profile submitted', 'Your profile is awaiting manual review. Supporting documents are optional.');
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, previous_status, new_status)
  values ((select auth.uid()), 'PROFILE_SUBMITTED', 'PROFILE', (select auth.uid()), v_status::text, 'PENDING');
end;
$$;

create or replace function public.review_profile(
  p_owner_id uuid,
  p_status public.verification_status,
  p_category text,
  p_remarks text default null,
  p_verification_basis text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_previous public.verification_status;
  v_overall public.verification_status;
  v_category_previous public.verification_status;
  v_verification_id uuid;
  v_role public.account_role;
  v_title text;
  v_message text;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_status is null or p_status not in ('UNDER_REVIEW', 'VERIFIED', 'CORRECTION_REQUIRED', 'REJECTED') then
    raise exception 'Invalid review decision';
  end if;
  if p_status in ('CORRECTION_REQUIRED', 'REJECTED') and nullif(trim(p_remarks), '') is null then
    raise exception 'Provide an explanation for this decision';
  end if;
  if p_status = 'VERIFIED' and nullif(trim(p_verification_basis), '') is null then
    raise exception 'Record the basis for approving this profile';
  end if;

  select verification_status, role into v_previous, v_role
  from public.profiles where id = p_owner_id and role in ('PRIEST', 'TEMPLE_MANAGEMENT');
  if not found then
    raise exception 'Profile not found';
  end if;
  select id, status into v_verification_id, v_category_previous
  from public.verifications
  where owner_id = p_owner_id and verification_category = p_category
  for update;
  if not found then
    raise exception 'Select a submitted verification category';
  end if;
  if v_category_previous = 'NOT_SUBMITTED' then
    raise exception 'This verification category has not been submitted for review';
  end if;

  update public.verifications
  set status = p_status, reviewed_by = (select auth.uid()), reviewed_at = now(),
      rejection_reason = case when p_status = 'REJECTED' then p_remarks else null end,
      internal_remarks = case when p_status in ('CORRECTION_REQUIRED', 'REJECTED') then p_remarks else null end,
      verification_basis = case when p_status = 'VERIFIED' then p_verification_basis else null end,
      updated_at = now()
  where owner_id = p_owner_id and verification_category = p_category;

  select case
    when bool_or(status = 'REJECTED') then 'REJECTED'::public.verification_status
    when bool_or(status = 'CORRECTION_REQUIRED') then 'CORRECTION_REQUIRED'::public.verification_status
    when bool_and(status = 'VERIFIED') then 'VERIFIED'::public.verification_status
    else 'UNDER_REVIEW'::public.verification_status
  end into v_overall
  from public.verifications where owner_id = p_owner_id;
  update public.profiles set verification_status = v_overall where id = p_owner_id;
  if v_role = 'PRIEST' then
    update public.priests set verification_status = v_overall where profile_id = p_owner_id;
  else
    update public.temples set verification_status = v_overall where profile_id = p_owner_id;
  end if;

  v_title := case v_overall
    when 'UNDER_REVIEW' then 'Verification review started'
    when 'VERIFIED' then 'Profile verified'
    when 'CORRECTION_REQUIRED' then 'Corrections requested'
    else 'Profile verification rejected'
  end;
  v_message := case v_overall
    when 'UNDER_REVIEW' then 'An administrator has started reviewing your profile.'
    when 'VERIFIED' then 'Your profile has been manually reviewed and verified by MandirSetu.'
    when 'CORRECTION_REQUIRED' then 'Please review the administrator feedback and update your profile.'
    else 'Your profile was not approved. Review the administrator explanation and contact support if needed.'
  end;
  insert into public.notifications(user_id, title, message) values (p_owner_id, v_title, v_message);
  insert into public.audit_logs(
    actor_id, action, entity_type, entity_id, previous_status, new_status, verification_category, remarks
  )
  values (
    (select auth.uid()), 'PROFILE_REVIEWED', 'VERIFICATION', v_verification_id,
    v_category_previous::text, p_status::text, p_category, p_remarks
  );
  if v_overall is distinct from v_previous then
    insert into public.audit_logs(actor_id, action, entity_type, entity_id, previous_status, new_status, remarks)
    values ((select auth.uid()), 'PROFILE_STATUS_CHANGED', 'PROFILE', p_owner_id, v_previous::text, v_overall::text, p_remarks);
  end if;
end;
$$;

create or replace function public.review_document(
  p_document_id uuid,
  p_status public.document_status,
  p_remarks text default null
)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_owner uuid;
  v_previous public.document_status;
begin
  if not public.is_admin() then
    raise exception 'Administrator access required';
  end if;
  if p_status in ('CORRECTION_REQUIRED', 'REJECTED') and nullif(trim(p_remarks), '') is null then
    raise exception 'Provide an explanation for this document decision';
  end if;
  select verification_status into v_previous
  from public.documents where id = p_document_id for update;
  if not found then
    raise exception 'Document not found';
  end if;
  update public.documents
  set verification_status = p_status, reviewed_by = (select auth.uid()), reviewed_at = now(),
      admin_remarks = p_remarks
  where id = p_document_id
  returning owner_id into v_owner;
  insert into public.notifications(user_id, title, message)
  values (
    v_owner,
    case p_status when 'VERIFIED' then 'Document approved' when 'CORRECTION_REQUIRED' then 'Document correction requested'
      when 'REJECTED' then 'Document rejected' else 'Document review updated' end,
    coalesce(nullif(trim(p_remarks), ''), 'An administrator updated the status of one of your documents.')
  );
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, previous_status, new_status, remarks)
  values ((select auth.uid()), 'DOCUMENT_REVIEWED', 'DOCUMENT', p_document_id, v_previous::text, p_status::text, p_remarks);
end;
$$;

create or replace function public.mark_notifications_read(p_notification_id uuid default null)
returns void language sql security definer set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid())
    and read_at is null
    and (p_notification_id is null or id = p_notification_id);
$$;

create or replace function public.admin_set_account_status(p_user_id uuid, p_status text, p_remarks text default null)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  v_previous text;
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  if p_status not in ('ACTIVE', 'SUSPENDED', 'CLOSED') then raise exception 'Invalid account status'; end if;
  select account_status into v_previous from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Account not found'; end if;
  update public.profiles set account_status = p_status where id = p_user_id;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, previous_status, new_status, remarks)
  values ((select auth.uid()), 'ACCOUNT_STATUS_CHANGED', 'PROFILE', p_user_id, v_previous, p_status, p_remarks);
end;
$$;

create or replace function public.record_recovery_request(p_phone text, p_phone_hash text, p_ip_hash text)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if auth.role() is distinct from 'service_role' then raise exception 'Service access required'; end if;
  if p_phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Invalid mobile number'; end if;
  perform pg_advisory_xact_lock(hashtextextended('phone:' || p_phone_hash, 0));
  perform pg_advisory_xact_lock(hashtextextended('ip:' || p_ip_hash, 0));
  if (select count(*) from public.recovery_requests
      where phone_hash = p_phone_hash and created_at > now() - interval '24 hours') >= 3
    or (select count(*) from public.recovery_requests
      where ip_hash = p_ip_hash and created_at > now() - interval '24 hours') >= 10 then
    return;
  end if;
  insert into public.recovery_requests(requested_phone, phone_hash, ip_hash)
  values (p_phone, p_phone_hash, p_ip_hash);
end;
$$;

create or replace function public.admin_resolve_recovery_request(p_request_id uuid, p_admin_notes text default null)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then raise exception 'Administrator access required'; end if;
  update public.recovery_requests
  set resolved_at = now(), resolved_by = (select auth.uid()), admin_notes = p_admin_notes
  where id = p_request_id and resolved_at is null;
  if not found then raise exception 'Recovery request not found or already resolved'; end if;
  insert into public.audit_logs(actor_id, action, entity_type, entity_id, remarks)
  values ((select auth.uid()), 'RECOVERY_REQUEST_RESOLVED', 'RECOVERY_REQUEST', p_request_id, p_admin_notes);
end;
$$;

alter table public.profiles enable row level security;
alter table public.priests enable row level security;
alter table public.temples enable row level security;
alter table public.documents enable row level security;
alter table public.verifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.notifications enable row level security;
alter table public.opportunities enable row level security;
alter table public.applications enable row level security;
alter table public.recovery_requests enable row level security;

create policy "Profiles can be read by owner or admin" on public.profiles
for select to authenticated using (id = (select auth.uid()) or public.is_admin());
create policy "Users can update their editable profile fields" on public.profiles
for update to authenticated using (id = (select auth.uid()) or public.is_admin())
with check (id = (select auth.uid()) or public.is_admin());

create policy "Priest profile owner or admin can read" on public.priests
for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());
create policy "Priest can create own profile" on public.priests
for insert to authenticated with check (
  profile_id = (select auth.uid()) and verification_status = 'NOT_SUBMITTED' and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'PRIEST'
  )
);
create policy "Priest can update own profile" on public.priests
for update to authenticated using (profile_id = (select auth.uid()) or public.is_admin())
with check (profile_id = (select auth.uid()) or public.is_admin());

create policy "Temple profile owner or admin can read" on public.temples
for select to authenticated using (profile_id = (select auth.uid()) or public.is_admin());
create policy "Temple representative can create own profile" on public.temples
for insert to authenticated with check (
  profile_id = (select auth.uid()) and verification_status = 'NOT_SUBMITTED' and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'TEMPLE_MANAGEMENT'
  )
);
create policy "Temple representative can update own profile" on public.temples
for update to authenticated using (profile_id = (select auth.uid()) or public.is_admin())
with check (profile_id = (select auth.uid()) or public.is_admin());

create policy "Document owner or admin can read metadata" on public.documents
for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());
create policy "Owner can add own pending document metadata" on public.documents
for insert to authenticated with check (
  owner_id = (select auth.uid())
  and owner_type in ('PRIEST', 'TEMPLE_MANAGEMENT')
  and verification_status = 'PENDING'
  and reviewed_by is null and reviewed_at is null and admin_remarks is null
  and (
    (owner_type = 'PRIEST' and document_category in (
      'RELIGIOUS_QUALIFICATION', 'EDUCATIONAL_CERTIFICATE', 'EXPERIENCE_CERTIFICATE',
      'TRAINING_CERTIFICATE', 'RECOMMENDATION_LETTER', 'OTHER'
    ))
    or (owner_type = 'TEMPLE_MANAGEMENT' and document_category in (
      'TRUST_OR_SOCIETY_REGISTRATION', 'GOVERNING_DOCUMENT', 'ORGANISATION_PAN',
      'REPRESENTATIVE_AUTHORITY', 'TEMPLE_MANAGEMENT_PROOF', 'OTHER'
    ))
  )
  and exists (select 1 from public.profiles p where p.id = owner_id and p.role = owner_type)
);

create policy "Owner or admin can read verification categories" on public.verifications
for select to authenticated using (owner_id = (select auth.uid()) or public.is_admin());

create policy "Only admins can read audit logs" on public.audit_logs
for select to authenticated using (public.is_admin());

create policy "Users can read own notifications" on public.notifications
for select to authenticated using (user_id = (select auth.uid()));

create policy "Opportunity owner and public can read published listings" on public.opportunities
for select to anon, authenticated using (
  (status = 'PUBLISHED' and exists (
    select 1 from public.profiles p
    where p.id = temple_id and p.role = 'TEMPLE_MANAGEMENT'
      and p.verification_status = 'VERIFIED' and p.account_status = 'ACTIVE'
  ))
  or temple_id = (select auth.uid())
  or public.is_admin()
);
create policy "Temple can create own recruitment drafts" on public.opportunities
for insert to authenticated with check (
  temple_id = (select auth.uid()) and status = 'DRAFT'
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'TEMPLE_MANAGEMENT' and p.account_status = 'ACTIVE'
  )
);
create policy "Verified temple can edit own recruitment" on public.opportunities
for update to authenticated using (temple_id = (select auth.uid()) or public.is_admin())
with check (
  (public.is_admin() or (
    temple_id = (select auth.uid())
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'TEMPLE_MANAGEMENT'
        and p.account_status = 'ACTIVE'
    )
  ))
  and (status <> 'PUBLISHED' or exists (
    select 1 from public.profiles p
    where p.id = temple_id and p.role = 'TEMPLE_MANAGEMENT'
      and p.verification_status = 'VERIFIED' and p.account_status = 'ACTIVE'
  ))
);

create policy "Applicant or relevant temple can read application" on public.applications
for select to authenticated using (
  priest_id = (select auth.uid())
  or exists (
    select 1 from public.opportunities o
    join public.profiles temple on temple.id = o.temple_id
    where o.id = opportunity_id and o.temple_id = (select auth.uid())
      and temple.role = 'TEMPLE_MANAGEMENT' and temple.account_status = 'ACTIVE'
  )
  or public.is_admin()
);
create policy "Priests can apply to published opportunities" on public.applications
for insert to authenticated with check (
  priest_id = (select auth.uid()) and status = 'SUBMITTED'
  and exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'PRIEST'
      and p.account_status = 'ACTIVE'
  )
  and exists (select 1 from public.opportunities o where o.id = opportunity_id and o.status = 'PUBLISHED')
);
create policy "Temple can manage status of own applications" on public.applications
for update to authenticated using (
  exists (
    select 1 from public.opportunities o
    join public.profiles temple on temple.id = o.temple_id
    where o.id = opportunity_id and o.temple_id = (select auth.uid())
      and temple.role = 'TEMPLE_MANAGEMENT' and temple.account_status = 'ACTIVE'
  )
  or public.is_admin()
)
with check (
  status in ('SUBMITTED', 'REVIEWING', 'SHORTLISTED', 'REJECTED')
  and (
    exists (
      select 1 from public.opportunities o
      join public.profiles temple on temple.id = o.temple_id
      where o.id = opportunity_id and o.temple_id = (select auth.uid())
        and temple.role = 'TEMPLE_MANAGEMENT' and temple.account_status = 'ACTIVE'
    )
    or public.is_admin()
  )
);

create policy "Admins can read account recovery requests" on public.recovery_requests
for select to authenticated using (public.is_admin());
create policy "Admins can update account recovery requests" on public.recovery_requests
for update to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace view public.public_priests
with (security_barrier = true)
as
select p.id, p.full_name, pr.experience_years, pr.religious_education, pr.qualifications,
  pr.expertise, pr.languages, pr.preferred_locations, pr.availability
from public.profiles p
join public.priests pr on pr.profile_id = p.id
where p.role = 'PRIEST' and p.verification_status = 'VERIFIED'
  and p.account_status = 'ACTIVE' and pr.public_listing;

create or replace view public.public_temples
with (security_barrier = true)
as
select p.id, t.temple_name, t.legal_structure, t.city, t.state
from public.profiles p
join public.temples t on t.profile_id = p.id
where p.role = 'TEMPLE_MANAGEMENT' and p.verification_status = 'VERIFIED'
  and p.account_status = 'ACTIVE' and t.public_listing;

create or replace view public.public_opportunities
with (security_barrier = true)
as
select o.id, o.title, o.description, o.location, o.compensation, o.published_at, t.temple_name, t.city, t.state
from public.opportunities o
join public.profiles p on p.id = o.temple_id
join public.temples t on t.profile_id = o.temple_id
where o.status = 'PUBLISHED' and p.role = 'TEMPLE_MANAGEMENT'
  and p.verification_status = 'VERIFIED' and p.account_status = 'ACTIVE';

create or replace view public.temple_application_applicants
with (security_barrier = true)
as
select a.id, a.opportunity_id, a.priest_id, a.status, a.cover_note, a.created_at, a.updated_at,
  p.full_name, pr.experience_years, pr.religious_education, pr.qualifications, pr.expertise, pr.languages
from public.applications a
join public.opportunities o on o.id = a.opportunity_id
join public.profiles p on p.id = a.priest_id and p.role = 'PRIEST'
join public.priests pr on pr.profile_id = p.id
where (
  o.temple_id = (select auth.uid())
  and exists (
    select 1 from public.profiles temple
    where temple.id = o.temple_id and temple.role = 'TEMPLE_MANAGEMENT'
      and temple.account_status = 'ACTIVE'
  )
) or public.is_admin();

grant select on public.public_priests, public.public_temples, public.public_opportunities to anon, authenticated;
grant select on public.temple_application_applicants to authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.priests, public.temples to authenticated;
grant select, insert on public.documents to authenticated;
grant select on public.verifications, public.audit_logs, public.notifications to authenticated;
grant select on public.opportunities to anon, authenticated;
grant insert, update on public.opportunities to authenticated;
grant insert on public.applications to authenticated;
revoke update on public.applications from public, anon, authenticated;
grant update (status) on public.applications to authenticated;
grant select on public.applications, public.recovery_requests to authenticated;
grant update on public.recovery_requests to authenticated;
grant usage on type public.account_role, public.verification_status, public.document_status to anon, authenticated;
grant execute on function public.submit_verification() to authenticated;
grant execute on function public.review_profile(uuid, public.verification_status, text, text, text) to authenticated;
grant execute on function public.review_document(uuid, public.document_status, text) to authenticated;
grant execute on function public.mark_notifications_read(uuid) to authenticated;
grant execute on function public.admin_set_account_status(uuid, text, text) to authenticated;
grant execute on function public.record_recovery_request(text, text, text) to service_role;
grant execute on function public.admin_resolve_recovery_request(uuid, text) to authenticated;
revoke all on function public.invalidate_profile_review(uuid) from public, anon, authenticated;
revoke all on function public.invalidate_review_after_profile_name_change() from public, anon, authenticated;
revoke all on function public.invalidate_review_after_priest_change() from public, anon, authenticated;
revoke all on function public.invalidate_review_after_temple_change() from public, anon, authenticated;
revoke all on function public.protect_application_identity() from public, anon, authenticated;
revoke all on function public.protect_user_profile_fields() from public, anon, authenticated;
revoke all on function public.protect_verification_status() from public, anon, authenticated;
revoke all on function public.submit_verification() from public, anon;
revoke all on function public.review_profile(uuid, public.verification_status, text, text, text) from public, anon;
revoke all on function public.review_document(uuid, public.document_status, text) from public, anon;
revoke all on function public.mark_notifications_read(uuid) from public, anon;
revoke all on function public.admin_set_account_status(uuid, text, text) from public, anon;
revoke all on function public.record_recovery_request(text, text, text) from public, anon, authenticated;
revoke all on function public.admin_resolve_recovery_request(uuid, text) from public, anon;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.notify_document_uploaded() from public, anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'private-verification-documents',
  'private-verification-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Document owner or admin can read private files"
on storage.objects for select to authenticated
using (
  bucket_id = 'private-verification-documents'
  and (
    (storage.foldername(name))[1] = (select auth.uid())::text
    or public.is_admin()
  )
);

create policy "Authenticated users can upload only into their own folder"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'private-verification-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('PRIEST', 'TEMPLE_MANAGEMENT')
      and p.account_status = 'ACTIVE'
  )
);

create policy "Owner can clean up an unlinked upload"
on storage.objects for delete to authenticated
using (
  bucket_id = 'private-verification-documents'
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and not exists (select 1 from public.documents d where d.storage_path = name)
);

revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to anon, authenticated;
