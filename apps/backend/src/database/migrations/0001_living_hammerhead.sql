CREATE TABLE `customer_code_counters` (
	`tenant_id` varchar(36) NOT NULL,
	`date_key` varchar(6) NOT NULL,
	`last_seq` int NOT NULL DEFAULT 0,
	CONSTRAINT `customer_code_counters_tenant_id_date_key_pk` PRIMARY KEY(`tenant_id`,`date_key`)
);
--> statement-breakpoint
ALTER TABLE `customers` ADD `customer_code` varchar(30);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_code_tenant_unique` UNIQUE(`tenant_id`,`customer_code`);--> statement-breakpoint
ALTER TABLE `customer_code_counters` ADD CONSTRAINT `customer_code_counters_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;