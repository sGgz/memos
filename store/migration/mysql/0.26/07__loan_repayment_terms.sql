-- Deprecated: repayment_periods/repayment_method are now created in loan schema.
SELECT 1;
ALTER TABLE `loan` ADD COLUMN `repayment_method` INT NOT NULL DEFAULT 0;
