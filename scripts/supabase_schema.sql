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

create or replace function public.join_family_by_code(input_code text)
returns public.families
language plpgsql
security definer
set search_path = public
as $$
declare
  safe_code text := upper(trim(coalesce(input_code, '')));
  target_family public.families;
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
  where code = safe_code
  limit 1;

  if target_family.id is null then
    raise exception 'Codigo de familia nao encontrado.';
  end if;

  update public.profiles
  set family_id = target_family.id
  where id = auth.uid();

  if not found then
    raise exception 'Perfil do usuario nao encontrado.';
  end if;

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
  or id in (select family_id from public.profiles where id = auth.uid())
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
  or family_id in (select family_id from public.profiles where id = auth.uid())
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
  family_id in (select family_id from public.profiles where id = auth.uid())
);

drop policy if exists "dependents_insert_family" on public.dependents;
create policy "dependents_insert_family"
on public.dependents for insert
with check (
  created_by = auth.uid()
  and family_id in (select family_id from public.profiles where id = auth.uid())
);

drop policy if exists "dependents_update_family" on public.dependents;
create policy "dependents_update_family"
on public.dependents for update
using (
  family_id in (select family_id from public.profiles where id = auth.uid())
)
with check (
  family_id in (select family_id from public.profiles where id = auth.uid())
);
