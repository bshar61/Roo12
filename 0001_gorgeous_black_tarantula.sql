CREATE TABLE `server_config` (
	`id` text PRIMARY KEY NOT NULL,
	`url` text NOT NULL,
	`checked_at` integer DEFAULT 0 NOT NULL
);
