-- supabase/migrations/20261103165454_add_instagram_band_accounts.sql

-- Add a new column to clients table to store instagram accounts
--linked to band members so that they can be filtered out of the
--fan analysis summary lists. 

alter table clients
add column instagram_band_accounts text[] not null default '{}';

update clients 
set instagram_band_accounts = array['colindjones', 'franciswaves', 'harpomilk', 'samedrourke'] 
where slug = 'circawaves';
