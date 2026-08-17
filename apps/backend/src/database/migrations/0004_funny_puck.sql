ALTER TABLE `activity_logs` ADD `target_id` varchar(64);--> statement-breakpoint
ALTER TABLE `activity_logs` ADD `metadata` json;--> statement-breakpoint
CREATE INDEX `activity_logs_target_id_idx` ON `activity_logs` (`target_id`);