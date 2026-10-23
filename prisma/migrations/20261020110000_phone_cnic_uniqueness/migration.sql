-- Mobile phones unique across users, platform_admins, suppliers, customers.
-- Supplier CNIC unique per shop when set. Supplier/customer phone unique when set.

-- Clear duplicate CNICs in a shop (keep the oldest row; null the rest) so the
-- unique index can be created on databases that already have collisions.
WITH ranked_cnic AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY shop_id, cnic
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM suppliers
  WHERE cnic IS NOT NULL
)
UPDATE suppliers s
SET cnic = NULL
FROM ranked_cnic r
WHERE s.id = r.id AND r.rn > 1;

-- Clear duplicate supplier phones (keep oldest).
WITH ranked_supplier_phone AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY phone
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM suppliers
  WHERE phone IS NOT NULL
)
UPDATE suppliers s
SET phone = NULL
FROM ranked_supplier_phone r
WHERE s.id = r.id AND r.rn > 1;

-- Clear duplicate customer phones (keep oldest).
WITH ranked_customer_phone AS (
  SELECT id,
         ROW_NUMBER() OVER (
           PARTITION BY phone
           ORDER BY created_at ASC, id ASC
         ) AS rn
  FROM customers
  WHERE phone IS NOT NULL
)
UPDATE customers c
SET phone = NULL
FROM ranked_customer_phone r
WHERE c.id = r.id AND r.rn > 1;

-- Cross-table phone collisions: party phones lose to login phones.
UPDATE suppliers s
SET phone = NULL
WHERE s.phone IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM users u WHERE u.phone = s.phone)
    OR EXISTS (SELECT 1 FROM platform_admins a WHERE a.phone = s.phone)
  );

UPDATE customers c
SET phone = NULL
WHERE c.phone IS NOT NULL
  AND (
    EXISTS (SELECT 1 FROM users u WHERE u.phone = c.phone)
    OR EXISTS (SELECT 1 FROM platform_admins a WHERE a.phone = c.phone)
    OR EXISTS (SELECT 1 FROM suppliers s WHERE s.phone = c.phone)
  );

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

  IF TG_TABLE_NAME IS DISTINCT FROM 'suppliers' AND EXISTS (
    SELECT 1 FROM suppliers s WHERE s.phone = NEW.phone
  ) THEN
    RAISE EXCEPTION 'mobile phone already registered as supplier'
      USING ERRCODE = '23505';
  END IF;

  IF TG_TABLE_NAME IS DISTINCT FROM 'customers' AND EXISTS (
    SELECT 1 FROM customers c WHERE c.phone = NEW.phone
  ) THEN
    RAISE EXCEPTION 'mobile phone already registered as customer'
      USING ERRCODE = '23505';
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

DROP TRIGGER IF EXISTS suppliers_login_phone_global_unique_trg ON suppliers;
CREATE TRIGGER suppliers_login_phone_global_unique_trg
  BEFORE INSERT OR UPDATE OF phone ON suppliers
  FOR EACH ROW EXECUTE FUNCTION login_phone_global_unique();

DROP TRIGGER IF EXISTS customers_login_phone_global_unique_trg ON customers;
CREATE TRIGGER customers_login_phone_global_unique_trg
  BEFORE INSERT OR UPDATE OF phone ON customers
  FOR EACH ROW EXECUTE FUNCTION login_phone_global_unique();

CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_phone_key" ON "suppliers" ("phone");
CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_shop_id_cnic_key" ON "suppliers" ("shop_id", "cnic");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_phone_key" ON "customers" ("phone");
