-- Helper functions keep the policies short.
-- `security definer` lets them read `memberships`
-- without being blocked by RLS on that table.

create function is_platform_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from platform_admins where user_id = auth.uid());
$$;

create function is_member(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_admin()
      or exists (select 1 from memberships where user_id = auth.uid() and client_id = cid);
$$;

create function can_edit(cid uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select is_platform_admin()
      or exists (select 1 from memberships
                 where user_id = auth.uid() and client_id = cid and role = 'editor');
$$;


--For each client-facing table:


create policy "members read" on tiktok_videos
  for select using (is_member(client_id));

create policy "members read" on tiktok_profile_snapshots
  for select using (is_member(client_id));

create policy "members read" on fan_analysis
  for select using (is_member(client_id));

create policy "members read" on clients
  for select using (is_member(id));

create policy "users read own memberships" on memberships
  for select using (user_id = auth.uid());