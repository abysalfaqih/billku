CREATE TABLE `areas` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `areas_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `subscription_plans` MODIFY COLUMN `max_users` int NOT NULL DEFAULT 2;--> statement-breakpoint
ALTER TABLE `tenants` ADD `favicon_url` varchar(500);--> statement-breakpoint
ALTER TABLE `tenants` ADD `motto` varchar(255);--> statement-breakpoint
ALTER TABLE `tenants` ADD `about` text;--> statement-breakpoint
ALTER TABLE `tenants` ADD `bank_accounts` text;--> statement-breakpoint
ALTER TABLE `customers` ADD `area_id` bigint;--> statement-breakpoint
ALTER TABLE `customers` ADD `pppoe_profile` varchar(100);--> statement-breakpoint
ALTER TABLE `customers` ADD `tax_enabled` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `customers` ADD `tax_percent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `bills` ADD `tax_percent` decimal(5,2);--> statement-breakpoint
ALTER TABLE `bills` ADD `tax_amount` decimal(15,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `bills` ADD `total_amount` decimal(15,2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE `areas` ADD CONSTRAINT `areas_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `areas_tenant_id_idx` ON `areas` (`tenant_id`);--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_area_id_areas_id_fk` FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `customers_area_id_idx` ON `customers` (`area_id`);