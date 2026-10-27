-- Drop old global unique indexes on customer and supplier phones
DROP INDEX IF EXISTS "customers_phone_key";
DROP INDEX IF EXISTS "suppliers_phone_key";

-- Create per-shop unique composite indexes
CREATE UNIQUE INDEX "customers_shop_id_phone_key" ON "customers"("shop_id", "phone");
CREATE UNIQUE INDEX "suppliers_shop_id_phone_key" ON "suppliers"("shop_id", "phone");

-- Drop global unique trigger on customers and suppliers
DROP TRIGGER IF EXISTS suppliers_login_phone_global_unique_trg ON suppliers;
DROP TRIGGER IF EXISTS customers_login_phone_global_unique_trg ON customers;

-- Re-create login_phone_global_unique function scoped only to login accounts (users & platform_admins)
CREATE OR REPLACE FUNCTION login_phone_global_unique() RETURNS trigger AS $$
BEGIN
  IF NEW.phone IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME IS DISTINCT FROM 'users' AND EXISTS (
    SELECT 1 FROM users u WHERE u.phone = NEW.phone
  ) THEN
    RAISE EXCEPTION 'mobile phone already registered as shop user'
      USING ERRCODE = '23505';
  END IF;

  IF TG_TABLE_NAME IS DISTINCT FROM 'platform_admins' AND EXISTS (
    SELECT 1 FROM platform_admins a WHERE a.phone = NEW.phone
  ) THEN
    RAISE EXCEPTION 'mobile phone already registered as platform admin'
      USING ERRCODE = '23505';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
