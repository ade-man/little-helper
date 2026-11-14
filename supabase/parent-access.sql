-- Apply after schema.sql. Existing originator ownership and family data stay intact.
begin;
create table public.lh_parent_members (
  family_id uuid not null references public.lh_families(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner','parent')),
  email text not null default '',
  created_at timestamptz not null default now(),
  primary key (family_id,user_id)
);
create index lh_parent_members_user_idx on public.lh_parent_members(user_id);
create table public.lh_parent_invites (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique check (length(token_hash)=64),
  family_id uuid not null references public.lh_families(id) on delete cascade,
  email text not null,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz
);
create index lh_parent_invites_family_idx on public.lh_parent_invites(family_id);
create index lh_parent_invites_creator_idx on public.lh_parent_invites(created_by);
alter table public.lh_devices add column created_by uuid references auth.users(id) on delete set null;
alter table public.lh_pairings add column created_by uuid references auth.users(id) on delete set null;
create index lh_devices_creator_idx on public.lh_devices(created_by);
create index lh_pairings_creator_idx on public.lh_pairings(created_by);
insert into public.lh_parent_members(family_id,user_id,role,email)
  select f.id,f.owner_id,'owner',coalesce(u.email,'') from public.lh_families f join auth.users u on u.id=f.owner_id;
alter table public.lh_parent_members enable row level security;
alter table public.lh_parent_invites enable row level security;
revoke all on public.lh_parent_members,public.lh_parent_invites from anon,authenticated;
grant select on public.lh_parent_members to authenticated;
grant all on public.lh_parent_members,public.lh_parent_invites to service_role;
create policy "Parents read their own memberships" on public.lh_parent_members for select to authenticated using ((select auth.uid())=user_id);
drop policy "Parents can read only their own family" on public.lh_families;
create policy "Parents read families they belong to" on public.lh_families for select to authenticated
  using (owner_id=(select auth.uid()) or exists(select 1 from public.lh_parent_members m where m.family_id=lh_families.id and m.user_id=(select auth.uid())));

-- API verifies the Supabase user first. This invoker function is service-only,
-- and atomically consumes the invitation and grants membership.
create function public.lh_accept_parent_invite(p_hash text,p_user_id uuid,p_email text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare inv public.lh_parent_invites%rowtype; originator uuid;
begin
  select * into inv from public.lh_parent_invites where token_hash=p_hash for update;
  if not found or inv.accepted_at is not null or inv.expires_at<=now() then
    return jsonb_build_object('error','This invitation has expired or was already used. Ask the original parent for a new link.');
  end if;
  if lower(inv.email)<>lower(p_email) then return jsonb_build_object('error','Sign in with the email address the original parent invited.'); end if;
  select owner_id into originator from public.lh_families where id=inv.family_id for update;
  if originator=p_user_id then return jsonb_build_object('error','You already own this family. Share the link with the invited parent.'); end if;
  if exists(select 1 from public.lh_parent_members where family_id=inv.family_id and user_id=p_user_id) then
    return jsonb_build_object('error','You already have access to this family.');
  end if;
  if (select count(*) from public.lh_parent_members where family_id=inv.family_id and role='parent')>=1 then
    return jsonb_build_object('error','This family already has an additional parent. The original parent can manage access in Family settings.');
  end if;
  insert into public.lh_parent_members(family_id,user_id,role,email) values(inv.family_id,p_user_id,'parent',lower(p_email));
  update public.lh_parent_invites set accepted_at=now() where id=inv.id;
  return jsonb_build_object('familyId',inv.family_id);
end;
$$;
revoke all on function public.lh_accept_parent_invite(text,uuid,text) from public,anon,authenticated;
grant execute on function public.lh_accept_parent_invite(text,uuid,text) to service_role;
commit;
