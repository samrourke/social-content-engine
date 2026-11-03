-- 20261103141953_fix_circawaves_tiktok_username
-- fixes the incorrect tiktok_username for the circawaves client in the supabase clients table.
update clients
set tiktok_username = 'circawaves'
where slug = 'circawaves';