CREATE TABLE `whatsapp_templates` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`type` enum('registration','reminder','isolir','payment') NOT NULL,
	`content` text NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_templates_id` PRIMARY KEY(`id`),
	CONSTRAINT `whatsapp_templates_tenant_type_unique` UNIQUE(`tenant_id`,`type`)
);
--> statement-breakpoint
ALTER TABLE `whatsapp_templates` ADD CONSTRAINT `whatsapp_templates_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `whatsapp_templates_tenant_id_idx` ON `whatsapp_templates` (`tenant_id`);
