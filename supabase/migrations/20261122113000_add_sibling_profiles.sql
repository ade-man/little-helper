-- Existing family rows remain the first child's profile. Null child IDs on
-- existing devices and pairing links continue to select that profile.
create table public.lh_children (
  id uuid primary key default gen_random_uuid(),
  family_id uuid not null references public.lh_families(id) on delete cascade,
  state jsonb not null check (jsonb_typeof(state) = 'object'),
  revision bigint not null default 0 check (revision >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (family_id, id)
);

alter table public.lh_children enable row level security;
revoke all on public.lh_children from public, anon, authenticated;
grant all on public.lh_children to service_role;

alter table public.lh_devices
  add column child_id uuid,
  add foreign key (family_id, child_id)
    references public.lh_children(family_id, id) on delete cascade;
alter table public.lh_pairings
  add column child_id uuid,
  add foreign key (family_id, child_id)
    references public.lh_children(family_id, id) on delete cascade;

-- Project just the names and, on the review tab, pending chores. Never return
-- sibling histories, balances, savings goals or device information.
create function public.lh_parent_dashboard(p_family uuid, p_inbox boolean)
returns jsonb
language sql stable security invoker
set search_path = ''
as $$
  with profiles as (
    select 'primary'::text as id, state, 0 as position, created_at
    from public.lh_families where id = p_family
    union all
    select id::text, state, 1, created_at
    from public.lh_children where family_id = p_family
  )
  select jsonb_build_object(
    'children', coalesce(jsonb_agg(
      jsonb_build_object('id', id, 'name', state #>> '{settings,name}')
      order by position, created_at, id
    ), '[]'::jsonb),
    'inbox', case when p_inbox then coalesce((
      select jsonb_agg(claim || jsonb_build_object(
        'childId', p.id, 'childName', p.state #>> '{settings,name}'
      ) order by claim->>'date' desc, p.id, claim->>'id')
      from profiles p
      cross join lateral jsonb_array_elements(
        jsonb_path_query_array(p.state, '$.completions[*] ? (@.status == "pending")')
      ) as entries(claim)
    ), '[]'::jsonb) end
  )
  from profiles;
$$;
revoke all on function public.lh_parent_dashboard(uuid, boolean) from public, anon, authenticated;
grant execute on function public.lh_parent_dashboard(uuid, boolean) to service_role;
