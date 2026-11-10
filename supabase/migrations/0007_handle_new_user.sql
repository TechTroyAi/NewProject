-- 0007_handle_new_user.sql
--
-- BUG #1: no `handle_new_user` trigger → every new auth user lands with zero
-- `profiles` rows, so nothing they create (series, items, …) can reference a
-- profile id. Every signup (email or OAuth) is effectively locked out.
--
-- Fixes:
--   • Create the trigger so every new `auth.users` row gets a matching
--     `public.profiles` row (display name taken from `raw_user_meta_data`).
--   • Backfill any existing `auth.users` rows that still lack a profile.

-- ─── Backfill existing users missing a profile ───────────────────────────────
INSERT INTO public.profiles (id, display_name)
SELECT u.id, (u.raw_user_meta_data->>'display_name')::text
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.raw_user_meta_data IS NOT NULL
ON CONFLICT (id) DO NOTHING;

-- Also backfill users whose raw_user_meta_data is NULL so they still get a row.
INSERT INTO public.profiles (id)
SELECT u.id
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL
  AND u.raw_user_meta_data IS NULL
ON CONFLICT (id) DO NOTHING;

-- ─── Trigger function: create a profile whenever a user is created ───────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  -- The trigger runs on INSERT into auth.users. Create the matching profile so
  -- every downstream FK (series.user_id → profiles.id, items.user_id, …)
  -- resolves immediately.
  INSERT INTO public.profiles (id, display_name)
  VALUES (
    NEW.id,
    (NEW.raw_user_meta_data->>'display_name')::text
  );
  RETURN NEW;
END;
$function$;

-- ─── Wire it into auth.users ─────────────────────────────────────────────────
CREATE TRIGGER handle_new_user_trigger
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();
