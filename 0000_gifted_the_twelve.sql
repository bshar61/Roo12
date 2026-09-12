CREATE TABLE `audit` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`at` integer NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `licenses` (
	`id` text PRIMARY KEY NOT NULL,
	`hash` text NOT NULL,
	`label` text NOT NULL,
	`created_at` integer NOT NULL,
	`activated_at` integer,
	`expires_at` integer,
	`revoked` integer DEFAULT 0 NOT NULL,
	`bound_to` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `licenses_hash_unique` ON `licenses` (`hash`);--> statement-breakpoint
CREATE TABLE `rate_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`count` integer NOT NULL,
	`reset_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `signal_locks` (
	`owner` text PRIMARY KEY NOT NULL,
	`until` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `market_candles` (
	`asset` text NOT NULL,
	`time` integer NOT NULL,
	`open` real NOT NULL,
	`high` real NOT NULL,
	`low` real NOT NULL,
	`close` real NOT NULL,
	`first_at` real NOT NULL,
	`last_at` real NOT NULL,
	`samples` integer NOT NULL,
	`max_gap` real NOT NULL,
	PRIMARY KEY(`asset`, `time`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`hash` text PRIMARY KEY NOT NULL,
	`license_id` text NOT NULL,
	`admin` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	FOREIGN KEY (`license_id`) REFERENCES `licenses`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_sessions_license` ON `sessions` (`license_id`);--> statement-breakpoint
CREATE TABLE `settings` (
	`id` text PRIMARY KEY NOT NULL,
	`encrypted` text NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `trades` (
	`id` text PRIMARY KEY NOT NULL,
	`owner` text NOT NULL,
	`source` text NOT NULL,
	`created_at` integer NOT NULL,
	`exit_at` integer NOT NULL,
	`result` text NOT NULL,
	`data` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_trades_owner_source` ON `trades` (`owner`,`source`,`created_at`);