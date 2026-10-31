-- AlterTable cash_reconciliations: allow negative system_cash on drawer overdraft while preserving counted_cash >= 0 and difference equation
ALTER TABLE cash_reconciliations DROP CONSTRAINT IF EXISTS cash_recon_amounts_chk;
ALTER TABLE cash_reconciliations ADD CONSTRAINT cash_recon_amounts_chk CHECK (counted_cash >= 0 AND difference = counted_cash - system_cash);
