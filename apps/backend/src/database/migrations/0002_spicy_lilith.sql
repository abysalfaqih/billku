ALTER TABLE `customers` DROP INDEX `customers_pppoe_tenant_unique`;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_pppoe_unique` UNIQUE(`username_pppoe`);