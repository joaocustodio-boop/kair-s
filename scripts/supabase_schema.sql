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

create index if not exists profiles_family_id_idx on public.profiles(family_id);
create index if not exists dependents_family_id_idx on public.dependents(family_id);
create index if not exists families_code_idx on public.families(code);

alter table public.families enable row level security;
alter table public.profiles enable row level security;
alter table public.dependents enable row level security;

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
