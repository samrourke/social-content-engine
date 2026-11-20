-- Members can read and update their own client's review queues.
-- No insert or delete policies: only the pipeline scripts (service role) add rows.

create policy "members read" on content_discoveries
  for select
  to authenticated
  using (private.is_member(client_id));

create policy "members update" on content_discoveries
  for update
  to authenticated
  using (private.is_member(client_id))
  with check (private.is_member(client_id));


create policy "members read" on instagram_discoveries
  for select
  to authenticated
  using (private.is_member(client_id));

create policy "members update" on instagram_discoveries
  for update
  to authenticated
  using (private.is_member(client_id))
  with check (private.is_member(client_id));