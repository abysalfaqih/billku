ALTER TABLE `tenant_subscriptions` MODIFY COLUMN `expires_at` datetime NOT NULL;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD `user_email` varchar(255);