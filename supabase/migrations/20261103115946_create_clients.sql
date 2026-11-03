-- 20261103115946_create_clients.sql
-- One row per client (artist/campaign) using the portal. Other tables will
-- point at clients.id through a client_id column (next migration).
-- RLS is switched on automatically by the ensure_rls trigger; no policies yet,
-- so only the service role can read this table until Phase 3.

create table if not exists clients (
  id uuid primary key default gen_random_uuid(),
  -- Used in URLs (/circawaves/dashboard): lowercase letters, numbers, hyphens
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  name text not null,
  -- Handles without the @, as the scrapers expect
  instagram_username text,
  tiktok_username text,
  created_at timestamptz not null default now()
);

insert into clients (slug, name, instagram_username, tiktok_username)
values ('circawaves', 'Circa Waves', 'circawaves', 'circawaves')
on conflict (slug) do nothing;