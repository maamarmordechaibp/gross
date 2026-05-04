-- =============================================================================
-- promote-me.sql — One-time fix for "I can't see customers / nothing is listed"
--
-- The auth trigger creates every new user with role='customer', which makes
-- is_staff() return false and RLS hides everything from the staff app.
--
-- Run this ONCE in Supabase Dashboard → SQL Editor while logged in as the
-- account you use to operate the shop. It promotes EVERY existing profile
-- to admin (safe in dev, where the only profiles are yours).
-- =============================================================================

update public.profiles set role = 'admin' where role = 'customer';

-- (Optional) keep new signups from being customers in dev:
-- alter table public.profiles alter column role set default 'staff';
