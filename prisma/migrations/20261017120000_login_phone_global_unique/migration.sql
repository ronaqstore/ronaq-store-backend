-- Login phones must be unique across users AND platform_admins.
-- Per-table @unique still covers same-table duplicates; this trigger blocks
-- the cross-table case (e.g. shop owner phone matching a platform admin).

CREATE OR REPLACE FUNCTION login_phone_global_unique() RETURNS trigger AS $$
BEGIN
  IF TG_TABLE_NAME = 'users' THEN
    IF EXISTS (
      SELECT 1 FROM platform_admins a
      WHERE a.phone = NEW.phone
    ) THEN
      RAISE EXCEPTION 'login phone already registered as platform admin'
        USING ERRCODE = '23505';
    END IF;
  ELSIF TG_TABLE_NAME = 'platform_admins' THEN
    IF EXISTS (
      SELECT 1 FROM users u
      WHERE u.phone = NEW.phone
    ) THEN
      RAISE EXCEPTION 'login phone already registered as shop user'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS users_login_phone_global_unique_trg ON users;
CREATE TRIGGER users_login_phone_global_unique_trg
  BEFORE INSERT OR UPDATE OF phone ON users
  FOR EACH ROW EXECUTE FUNCTION login_phone_global_unique();

DROP TRIGGER IF EXISTS platform_admins_login_phone_global_unique_trg ON platform_admins;
CREATE TRIGGER platform_admins_login_phone_global_unique_trg
  BEFORE INSERT OR UPDATE OF phone ON platform_admins
  FOR EACH ROW EXECUTE FUNCTION login_phone_global_unique();
