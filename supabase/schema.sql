-- Run once in your Supabase project's SQL editor.
-- A small family aggregate makes all reward rules transactional through a
-- revision-based compare-and-swap in the Netlify API. Child devices never get
-- database keys or direct table access. Monetary values are integer pennies.
begin;
create table public.lh_families (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references auth.users(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.lh_devices (
  token_hash text primary key check (length(token_hash) = 64),
  family_id uuid not null references public.lh_families(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index lh_devices_family_id_idx on public.lh_devices(family_id);
create table public.lh_pairings (
  code_hash text primary key check (length(code_hash) = 64),
  family_id uuid not null references public.lh_families(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index lh_pairings_family_id_idx on public.lh_pairings(family_id);

alter table public.lh_families enable row level security;
alter table public.lh_devices enable row level security;
alter table public.lh_pairings enable row level security;
revoke all on public.lh_families, public.lh_devices, public.lh_pairings from anon, authenticated;
grant select on public.lh_families to authenticated;
create policy "Parents can read only their own family" on public.lh_families
  for select to authenticated using ((select auth.uid()) = owner_id);
-- No user-writable policies: every change passes through the authenticated API.
-- Explicit grants support projects with restrictive Data API defaults.
grant all on public.lh_families, public.lh_devices, public.lh_pairings to service_role;
commit;

-- Optional periodic housekeeping (not required for expiry enforcement):
-- delete from public.lh_pairings where expires_at < now();
-- delete from public.lh_devices where expires_at < now();
