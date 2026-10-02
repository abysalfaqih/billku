ALTER TABLE `payments` DROP FOREIGN KEY `payments_created_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `tenant_subscriptions` DROP FOREIGN KEY `tenant_subscriptions_created_by_users_id_fk`;
--> statement-breakpoint
ALTER TABLE `payments` MODIFY COLUMN `created_by` bigint;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;