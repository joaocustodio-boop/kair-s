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

-- Families policies
create policy if not exists "families_select_own_or_member"
on public.families for select
using (
  owner_id = auth.uid()
  or id in (select family_id from public.profiles where id = auth.uid())
);

create policy if not exists "families_insert_owner"
on public.families for insert
with check (owner_id = auth.uid());

create policy if not exists "families_update_owner"
on public.families for update
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

-- Profiles policies
create policy if not exists "profiles_select_self_or_family"
on public.profiles for select
using (
  id = auth.uid()
  or family_id in (select family_id from public.profiles where id = auth.uid())
);

create policy if not exists "profiles_insert_self"
on public.profiles for insert
with check (id = auth.uid());

create policy if not exists "profiles_update_self"
on public.profiles for update
using (id = auth.uid())
with check (id = auth.uid());

-- Dependents policies
create policy if not exists "dependents_select_family"
on public.dependents for select
using (
  family_id in (select family_id from public.profiles where id = auth.uid())
);

create policy if not exists "dependents_insert_family"
on public.dependents for insert
with check (
  created_by = auth.uid()
  and family_id in (select family_id from public.profiles where id = auth.uid())
);

create policy if not exists "dependents_update_family"
on public.dependents for update
using (
  family_id in (select family_id from public.profiles where id = auth.uid())
)
with check (
  family_id in (select family_id from public.profiles where id = auth.uid())
);
