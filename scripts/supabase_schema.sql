-- Run this script in Supabase SQL Editor.
-- It creates the tables needed by src/auth.js cloud migration.

create extension if not exists pgcrypto;

create table if not exists public.families (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null unique,
  photo_url text,
  family_id uuid references public.families(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.dependents (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  name text not null,
  birth_date date,
  photo_url text,
  role text not null default 'filho',
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz
);

create table if not exists public.family_join_requests (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.families(id) on delete cascade,
  requester_id uuid not null references auth.users(id) on delete cascade,
  requester_name text not null,
  requester_email text not null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create index if not exists profiles_family_id_idx on public.profiles(family_id);
create index if not exists dependents_family_id_idx on public.dependents(family_id);
create index if not exists families_code_idx on public.families(code);
create index if not exists family_join_requests_family_id_idx on public.family_join_requests(family_id);
create index if not exists family_join_requests_requester_id_idx on public.family_join_requests(requester_id);
create unique index if not exists family_join_requests_pending_unique_idx
on public.family_join_requests(family_id, requester_id)
where status = 'pending';

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.dependents enable row level security;
alter table public.family_join_requests enable row level security;

create or replace function public.current_user_family_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select family_id
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

grant execute on function public.current_user_family_id() to authenticated;

create or replace function public.find_family_by_code(input_code text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_code text := upper(regexp_replace(trim(coalesce(input_code, '')), '[^A-Z0-9]', '', 'g'));
  alt_letter_code text;
  alt_digit_code text;
  target_family public.families;
begin
  if safe_code = '' then
    return null;
  end if;

  select *
  into target_family
  from public.families
  where upper(code) = safe_code
  limit 1;

  if target_family.id is null then
    alt_letter_code := translate(safe_code, '10', 'IO');
    alt_digit_code := translate(safe_code, 'IO', '10');

    select *
    into target_family
    from public.families
    where upper(code) in (alt_letter_code, alt_digit_code)
    order by case
      when upper(code) = alt_letter_code then 0
      when upper(code) = alt_digit_code then 1
      else 2
    end
    limit 1;
  end if;

  return target_family;
end;
$$;

grant execute on function public.find_family_by_code(text) to authenticated;

create or replace function public.search_families_by_name(input_name text)
returns setof public.families
language sql
security definer
set search_path = public
stable
as $$
  select f.*
  from public.families f
  where trim(coalesce(input_name, '')) <> ''
    and f.name ilike ('%' || trim(input_name) || '%')
  order by f.created_at desc
  limit 30
$$;

grant execute on function public.search_families_by_name(text) to authenticated;

create or replace function public.join_family_by_code(input_code text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_code text := upper(regexp_replace(trim(coalesce(input_code, '')), '[^A-Z0-9]', '', 'g'));
  alt_letter_code text;
  alt_digit_code text;
  target_family public.families;
  auth_user_email text;
  auth_user_name text;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if safe_code = '' then
    raise exception 'Informe o codigo da familia.';
  end if;

  select *
  into target_family
  from public.families
  where upper(code) = safe_code
  limit 1;

  if target_family.id is null then
    alt_letter_code := translate(safe_code, '10', 'IO');
    alt_digit_code := translate(safe_code, 'IO', '10');

    select *
    into target_family
    from public.families
    where upper(code) in (alt_letter_code, alt_digit_code)
    order by case
      when upper(code) = alt_letter_code then 0
      when upper(code) = alt_digit_code then 1
      else 2
    end
    limit 1;
  end if;

  if target_family.id is null then
    raise exception 'Codigo de familia nao encontrado.';
  end if;

  select
    lower(email),
    coalesce(nullif(raw_user_meta_data ->> 'name', ''), nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1), 'Usuario')
  into auth_user_email, auth_user_name
  from auth.users
  where id = auth.uid()
  limit 1;

  if auth_user_email is null then
    raise exception 'Email do usuario nao encontrado.';
  end if;

  update public.profiles
  set
    family_id = target_family.id,
    name = coalesce(nullif(public.profiles.name, ''), auth_user_name),
    email = coalesce(public.profiles.email, auth_user_email)
  where id = auth.uid();

  if found then
    return target_family;
  end if;

  update public.profiles
  set
    id = auth.uid(),
    family_id = target_family.id,
    name = coalesce(nullif(public.profiles.name, ''), auth_user_name)
  where lower(email) = auth_user_email;

  if found then
    return target_family;
  end if;

  insert into public.profiles (id, name, email, family_id)
  values (auth.uid(), auth_user_name, auth_user_email, target_family.id)
  on conflict (id)
  do update set
    family_id = excluded.family_id,
    name = coalesce(nullif(public.profiles.name, ''), excluded.name),
    email = coalesce(public.profiles.email, excluded.email);

  return target_family;
end;
$$;

grant execute on function public.join_family_by_code(text) to authenticated;

create or replace function public.request_family_join_by_code(input_code text)
returns public.family_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  target_family public.families;
  auth_user_email text;
  auth_user_name text;
  result_request public.family_join_requests;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  target_family := public.find_family_by_code(input_code);
  if target_family.id is null then
    raise exception 'Codigo de familia nao encontrado.';
  end if;

  if target_family.owner_id = auth.uid() then
    raise exception 'Voce ja e o criador desta familia.';
  end if;

  select
    lower(email),
    coalesce(nullif(raw_user_meta_data ->> 'name', ''), nullif(raw_user_meta_data ->> 'full_name', ''), split_part(email, '@', 1), 'Usuario')
  into auth_user_email, auth_user_name
  from auth.users
  where id = auth.uid()
  limit 1;

  if auth_user_email is null then
    raise exception 'Email do usuario nao encontrado.';
  end if;

  insert into public.family_join_requests (family_id, requester_id, requester_name, requester_email, status)
  values (target_family.id, auth.uid(), auth_user_name, auth_user_email, 'pending')
  on conflict (family_id, requester_id) where status = 'pending'
  do update set
    requester_name = excluded.requester_name,
    requester_email = excluded.requester_email,
    created_at = now()
  returning * into result_request;

  return result_request;
end;
$$;

grant execute on function public.request_family_join_by_code(text) to authenticated;

create or replace function public.list_pending_family_join_requests()
returns setof public.family_join_requests
language sql
security definer
set search_path = public
stable
as $$
  select r.*
  from public.family_join_requests r
  join public.families f on f.id = r.family_id
  where f.owner_id = auth.uid()
    and r.status = 'pending'
  order by r.created_at desc
$$;

grant execute on function public.list_pending_family_join_requests() to authenticated;

create or replace function public.review_family_join_request(request_id uuid, decision text)
returns public.family_join_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_decision text := lower(trim(coalesce(decision, '')));
  req public.family_join_requests;
begin
  if auth.uid() is null then
    raise exception 'Usuario nao autenticado.';
  end if;

  if safe_decision not in ('approved', 'rejected') then
    raise exception 'Decisao invalida.';
  end if;

  select r.*
  into req
  from public.family_join_requests r
  join public.families f on f.id = r.family_id
  where r.id = request_id
    and r.status = 'pending'
    and f.owner_id = auth.uid()
  limit 1;

  if req.id is null then
    raise exception 'Solicitacao nao encontrada.';
  end if;

  update public.family_join_requests
  set status = safe_decision,
      reviewed_at = now(),
      reviewed_by = auth.uid()
  where id = req.id
  returning * into req;

  if safe_decision = 'approved' then
    insert into public.profiles (id, name, email, family_id)
    values (req.requester_id, req.requester_name, req.requester_email, req.family_id)
    on conflict (id)
    do update set family_id = excluded.family_id;
  end if;

  return req;
end;
$$;

grant execute on function public.review_family_join_request(uuid, text) to authenticated;

-- Requests policies
drop policy if exists "family_join_requests_owner_or_requester_select" on public.family_join_requests;
create policy "family_join_requests_owner_or_requester_select"
on public.family_join_requests for select
using (
  requester_id = auth.uid()
  or family_id in (select id from public.families where owner_id = auth.uid())
);

-- Families policies
drop policy if exists "families_select_own_or_member" on public.families;
create policy "families_select_own_or_member"
on public.families for select
using (
  owner_id = auth.uid()
  or id = public.current_user_family_id()
);

drop policy if exists "families_insert_owner" on public.families;
create policy "families_insert_owner"
on public.families for insert
with check (owner_id = auth.uid());

drop policy if exists "families_update_owner" on public.families;
create policy "families_update_owner"
on public.families for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Profiles policies
drop policy if exists "profiles_select_self_or_family" on public.profiles;
create policy "profiles_select_self_or_family"
on public.profiles for select
using (
  id = auth.uid()
  or family_id = public.current_user_family_id()
);

drop policy if exists "profiles_insert_self" on public.profiles;
create policy "profiles_insert_self"
on public.profiles for insert
with check (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Dependents policies
drop policy if exists "dependents_select_family" on public.dependents;
create policy "dependents_select_family"
on public.dependents for select
using (
  family_id = public.current_user_family_id()
);

drop policy if exists "dependents_insert_family" on public.dependents;
create policy "dependents_insert_family"
on public.dependents for insert
with check (
  created_by = auth.uid()
  and family_id = public.current_user_family_id()
);

drop policy if exists "dependents_update_family" on public.dependents;
create policy "dependents_update_family"
on public.dependents for update
using (
  family_id = public.current_user_family_id()
)
with check (
  family_id = public.current_user_family_id()
);
