--20261104131718_create_memberships.sql
-- create table to store memberships for clients, so that we can have multiple clients and users with different access levels
--create a table to store platform admins, so that we can have multiple users with access to ALL clients

create table if not exists memberships (
  user_id uuid not null references auth.users(id) on delete cascade,
  client_id uuid not null references clients(id) on delete cascade,
  role text not null default 'viewer' check (role in ('viewer', 'editor')),
  created_at timestamptz not null default now(),
  primary key (user_id, client_id)
);

create index if not exists idx_memberships_client_id on memberships (client_id);


create table if not exists platform_admins (
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id)
);