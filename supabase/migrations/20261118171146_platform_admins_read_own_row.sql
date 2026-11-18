-- 20261118171146_platform_admins_read_own_row.sql
-- Lets each user read only their own platform_admins row, so the app can
-- check "am I an admin?" without revealing who the other admins are.


create policy "users read own admin row" on platform_admins
  for select
  to authenticated
  using (user_id = auth.uid());