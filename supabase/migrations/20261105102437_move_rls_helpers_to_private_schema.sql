-- Move the RLS helpers out of the API-exposed public schema, so they
-- can't be called through /rest/v1/rpc. Policies keep working.
create schema if not exists private;

alter function public.is_platform_admin() set schema private;
alter function public.is_member(uuid) set schema private;
alter function public.can_edit(uuid) set schema private;

-- is_member and can_edit call is_platform_admin(), which is now in private
alter function private.is_member(uuid) set search_path = public, private;
alter function private.can_edit(uuid) set search_path = public, private;

-- The ensure_rls event trigger doesn't need these grants to fire
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
