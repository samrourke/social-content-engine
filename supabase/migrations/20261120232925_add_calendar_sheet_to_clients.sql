-- 20261120232925_add_calendar_sheet_to_clients.sql
-- add calendar_sheet_id and calendar_sheet_tab columns
-- to clients table


alter table clients
  add column if not exists calendar_sheet_id text,
  add column if not exists calendar_sheet_tab text;