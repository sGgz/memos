ALTER TABLE `loan` ADD COLUMN `monthly_repayment_day` INT NOT NULL DEFAULT 0;

ALTER TABLE `repayment` ADD COLUMN `is_early_repayment` TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE `repayment` ADD COLUMN `period` INT DEFAULT NULL;
