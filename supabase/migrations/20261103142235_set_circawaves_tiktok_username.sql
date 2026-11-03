-- Sets the Circa Waves TikTok handle to the real account. The previous
-- migration (20261103141953) was pushed with the old value by mistake.
update clients
set tiktok_username = 'circawavesofficial'
where slug = 'circawaves';