CREATE TABLE `tenants` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`slug` varchar(100) NOT NULL,
	`email` varchar(255) NOT NULL,
	`phone` varchar(20) NOT NULL,
	`address` text,
	`logo_url` varchar(500),
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenants_id` PRIMARY KEY(`id`),
	CONSTRAINT `tenants_slug_unique` UNIQUE(`slug`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`email` varchar(255) NOT NULL,
	`password` varchar(255) NOT NULL,
	`role` enum('super_admin','admin','staff') NOT NULL DEFAULT 'staff',
	`is_active` boolean NOT NULL DEFAULT true,
	`last_login_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_email_tenant_unique` UNIQUE(`tenant_id`,`email`)
);
--> statement-breakpoint
CREATE TABLE `mikrotik_configs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`host` varchar(100) NOT NULL,
	`port` int NOT NULL DEFAULT 8728,
	`username` varchar(100) NOT NULL,
	`password` varchar(255) NOT NULL,
	`radius_secret` varchar(255) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `mikrotik_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`user_id` bigint NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`token_hash` varchar(255) NOT NULL,
	`expires_at` timestamp NOT NULL,
	`is_revoked` boolean NOT NULL DEFAULT false,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `refresh_tokens_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `ip_pools` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`mikrotik_config_id` bigint NOT NULL,
	`display_name` varchar(255) NOT NULL,
	`name` varchar(100) NOT NULL,
	`network` varchar(20) NOT NULL,
	`gateway` varchar(45) NOT NULL,
	`ip_start` varchar(45) NOT NULL,
	`ip_end` varchar(45) NOT NULL,
	`dns_primary` varchar(45) NOT NULL DEFAULT '8.8.8.8',
	`dns_secondary` varchar(45) NOT NULL DEFAULT '8.8.4.4',
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `ip_pools_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `packages` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`ip_pool_id` bigint,
	`name` varchar(255) NOT NULL,
	`description` text,
	`speed_download` int NOT NULL,
	`speed_upload` int NOT NULL,
	`price` decimal(15,2) NOT NULL,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `packages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`package_id` bigint,
	`name` varchar(255) NOT NULL,
	`email` varchar(255),
	`phone` varchar(20) NOT NULL,
	`address` text,
	`nik` varchar(20),
	`username_pppoe` varchar(100),
	`password_pppoe` varchar(255),
	`ip_address` varchar(45),
	`billing_date` int NOT NULL,
	`installation_date` date,
	`status` enum('active','isolated','suspended','terminated') NOT NULL DEFAULT 'active',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `customers_id` PRIMARY KEY(`id`),
	CONSTRAINT `customers_pppoe_tenant_unique` UNIQUE(`tenant_id`,`username_pppoe`)
);
--> statement-breakpoint
CREATE TABLE `bills` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`customer_id` bigint NOT NULL,
	`bill_number` varchar(50) NOT NULL,
	`period_start` date NOT NULL,
	`period_end` date NOT NULL,
	`due_date` date NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`package_name` varchar(255) NOT NULL,
	`status` enum('unpaid','paid','overdue','cancelled') NOT NULL DEFAULT 'unpaid',
	`notes` text,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `bills_id` PRIMARY KEY(`id`),
	CONSTRAINT `bills_number_tenant_unique` UNIQUE(`tenant_id`,`bill_number`)
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`bill_id` bigint NOT NULL,
	`customer_id` bigint NOT NULL,
	`amount` decimal(15,2) NOT NULL,
	`payment_method` enum('cash','transfer','other') NOT NULL DEFAULT 'cash',
	`paid_at` timestamp NOT NULL DEFAULT (now()),
	`notes` text,
	`created_by` bigint NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `payments_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_configs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`provider` enum('fonnte','wablast','meta') NOT NULL,
	`name` varchar(255) NOT NULL,
	`api_key` varchar(500) NOT NULL,
	`sender_number` varchar(20) NOT NULL,
	`extra_config` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `whatsapp_configs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `whatsapp_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`customer_id` bigint,
	`bill_id` bigint,
	`trigger` enum('registration','reminder','isolir','payment') NOT NULL,
	`phone` varchar(20) NOT NULL,
	`message` text NOT NULL,
	`provider` varchar(50) NOT NULL,
	`status` enum('pending','sent','failed') NOT NULL DEFAULT 'pending',
	`provider_response` text,
	`error_message` text,
	`sent_at` timestamp,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `whatsapp_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `activity_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36),
	`user_id` bigint,
	`method` varchar(10) NOT NULL,
	`path` varchar(500) NOT NULL,
	`action` varchar(255) NOT NULL,
	`ip_address` varchar(45),
	`user_agent` varchar(500),
	`status_code` int NOT NULL,
	`duration_ms` int NOT NULL,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `activity_logs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`name` varchar(100) NOT NULL,
	`description` text,
	`price_monthly` decimal(15,2) NOT NULL,
	`max_customers` int NOT NULL DEFAULT 100,
	`max_mikrotik` int NOT NULL DEFAULT 1,
	`max_ip_pools` int NOT NULL DEFAULT 5,
	`max_users` int NOT NULL DEFAULT 3,
	`has_whatsapp` boolean NOT NULL DEFAULT false,
	`has_api_access` boolean NOT NULL DEFAULT false,
	`has_reports` boolean NOT NULL DEFAULT true,
	`extra_features` text,
	`is_active` boolean NOT NULL DEFAULT true,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `subscription_plans_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tenant_subscriptions` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`tenant_id` varchar(36) NOT NULL,
	`plan_id` bigint NOT NULL,
	`status` enum('active','expired','trial','cancelled') NOT NULL DEFAULT 'trial',
	`started_at` timestamp NOT NULL DEFAULT (now()),
	`expires_at` timestamp NOT NULL,
	`duration_months` int NOT NULL DEFAULT 1,
	`amount_paid` decimal(15,2) NOT NULL DEFAULT '0',
	`notes` text,
	`created_by` bigint,
	`created_at` timestamp NOT NULL DEFAULT (now()),
	`updated_at` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `tenant_subscriptions_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `mikrotik_configs` ADD CONSTRAINT `mikrotik_configs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `refresh_tokens` ADD CONSTRAINT `refresh_tokens_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ip_pools` ADD CONSTRAINT `ip_pools_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `ip_pools` ADD CONSTRAINT `ip_pools_mikrotik_config_id_mikrotik_configs_id_fk` FOREIGN KEY (`mikrotik_config_id`) REFERENCES `mikrotik_configs`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packages` ADD CONSTRAINT `packages_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `packages` ADD CONSTRAINT `packages_ip_pool_id_ip_pools_id_fk` FOREIGN KEY (`ip_pool_id`) REFERENCES `ip_pools`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `customers` ADD CONSTRAINT `customers_package_id_packages_id_fk` FOREIGN KEY (`package_id`) REFERENCES `packages`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bills` ADD CONSTRAINT `bills_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `bills` ADD CONSTRAINT `bills_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_bill_id_bills_id_fk` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `payments` ADD CONSTRAINT `payments_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_configs` ADD CONSTRAINT `whatsapp_configs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_logs` ADD CONSTRAINT `whatsapp_logs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_logs` ADD CONSTRAINT `whatsapp_logs_customer_id_customers_id_fk` FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `whatsapp_logs` ADD CONSTRAINT `whatsapp_logs_bill_id_bills_id_fk` FOREIGN KEY (`bill_id`) REFERENCES `bills`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `activity_logs` ADD CONSTRAINT `activity_logs_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_tenant_id_tenants_id_fk` FOREIGN KEY (`tenant_id`) REFERENCES `tenants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_plan_id_subscription_plans_id_fk` FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tenant_subscriptions` ADD CONSTRAINT `tenant_subscriptions_created_by_users_id_fk` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_tenant_id_idx` ON `users` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `mikrotik_configs_tenant_id_idx` ON `mikrotik_configs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_id_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_tenant_id_idx` ON `refresh_tokens` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `ip_pools_tenant_id_idx` ON `ip_pools` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `ip_pools_mikrotik_config_id_idx` ON `ip_pools` (`mikrotik_config_id`);--> statement-breakpoint
CREATE INDEX `packages_tenant_id_idx` ON `packages` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `customers_tenant_id_idx` ON `customers` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `customers_status_idx` ON `customers` (`status`);--> statement-breakpoint
CREATE INDEX `customers_billing_date_idx` ON `customers` (`billing_date`);--> statement-breakpoint
CREATE INDEX `bills_tenant_id_idx` ON `bills` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `bills_customer_id_idx` ON `bills` (`customer_id`);--> statement-breakpoint
CREATE INDEX `bills_status_idx` ON `bills` (`status`);--> statement-breakpoint
CREATE INDEX `bills_due_date_idx` ON `bills` (`due_date`);--> statement-breakpoint
CREATE INDEX `payments_tenant_id_idx` ON `payments` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `payments_bill_id_idx` ON `payments` (`bill_id`);--> statement-breakpoint
CREATE INDEX `payments_customer_id_idx` ON `payments` (`customer_id`);--> statement-breakpoint
CREATE INDEX `payments_paid_at_idx` ON `payments` (`paid_at`);--> statement-breakpoint
CREATE INDEX `whatsapp_configs_tenant_id_idx` ON `whatsapp_configs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `whatsapp_logs_tenant_id_idx` ON `whatsapp_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `whatsapp_logs_trigger_idx` ON `whatsapp_logs` (`trigger`);--> statement-breakpoint
CREATE INDEX `whatsapp_logs_status_idx` ON `whatsapp_logs` (`status`);--> statement-breakpoint
CREATE INDEX `activity_logs_tenant_id_idx` ON `activity_logs` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_user_id_idx` ON `activity_logs` (`user_id`);--> statement-breakpoint
CREATE INDEX `activity_logs_created_at_idx` ON `activity_logs` (`created_at`);--> statement-breakpoint
CREATE INDEX `tenant_subscriptions_tenant_id_idx` ON `tenant_subscriptions` (`tenant_id`);--> statement-breakpoint
CREATE INDEX `tenant_subscriptions_status_idx` ON `tenant_subscriptions` (`status`);--> statement-breakpoint
CREATE INDEX `tenant_subscriptions_expires_at_idx` ON `tenant_subscriptions` (`expires_at`);