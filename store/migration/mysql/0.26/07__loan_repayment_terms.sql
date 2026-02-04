-- Deprecated: repayment_periods is now created in loan schema.
SELECT 1;
ALTER TABLE `loan` ADD COLUMN `repayment_method` INT NOT NULL DEFAULT 0;
