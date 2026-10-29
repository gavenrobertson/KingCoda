CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_user_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `activity_day` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`submissions` integer DEFAULT 0 NOT NULL,
	`accepted` integer DEFAULT 0 NOT NULL,
	`freeze_used` integer DEFAULT false NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`actor_id` text NOT NULL,
	`action` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`detail` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`actor_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `audit_log_created_idx` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE TABLE `board` (
	`scope` text NOT NULL,
	`period_key` text NOT NULL,
	`user_id` text NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`solved` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`scope`, `period_key`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `board_rank_idx` ON `board` (`scope`,`period_key`,`points`,`updated_at`);--> statement-breakpoint
CREATE TABLE `contest` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`starts_at` integer NOT NULL,
	`duration_min` integer NOT NULL,
	`status` text DEFAULT 'scheduled' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `contest_slug_unique` ON `contest` (`slug`);--> statement-breakpoint
CREATE INDEX `contest_starts_idx` ON `contest` (`starts_at`);--> statement-breakpoint
CREATE TABLE `contest_problem` (
	`contest_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`ordinal` integer NOT NULL,
	`points` integer NOT NULL,
	PRIMARY KEY(`contest_id`, `problem_id`),
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `contest_registration` (
	`contest_id` text NOT NULL,
	`user_id` text NOT NULL,
	`virtual_start_at` integer,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`contest_id`, `user_id`),
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `contest_result` (
	`contest_id` text NOT NULL,
	`user_id` text NOT NULL,
	`rank` integer NOT NULL,
	`solved` integer NOT NULL,
	`penalty` integer NOT NULL,
	`per_problem` text NOT NULL,
	PRIMARY KEY(`contest_id`, `user_id`),
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `contest_result_rank_idx` ON `contest_result` (`contest_id`,`rank`);--> statement-breakpoint
CREATE TABLE `daily_challenge` (
	`day` text PRIMARY KEY NOT NULL,
	`problem_id` text NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `daily_completion` (
	`user_id` text NOT NULL,
	`day` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `day`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `draft` (
	`user_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`lang` text NOT NULL,
	`code` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `problem_id`, `lang`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `follow` (
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`follower_id`, `followee_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`followee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `follow_followee_idx` ON `follow` (`followee_id`);--> statement-breakpoint
CREATE TABLE `ledger` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`points` integer DEFAULT 0 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`ref` text,
	`week_key` text NOT NULL,
	`month_key` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ledger_user_created_idx` ON `ledger` (`user_id`,`created_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `ledger_unique_reward_idx` ON `ledger` (`user_id`,`kind`,`ref`);--> statement-breakpoint
CREATE TABLE `perf_histogram` (
	`problem_id` text NOT NULL,
	`lang` text NOT NULL,
	`metric` text NOT NULL,
	`bucket` integer NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`problem_id`, `lang`, `metric`, `bucket`),
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `plagiarism_flag` (
	`id` text PRIMARY KEY NOT NULL,
	`contest_id` text NOT NULL,
	`submission_a` text NOT NULL,
	`submission_b` text NOT NULL,
	`similarity` real NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `post` (
	`id` text PRIMARY KEY NOT NULL,
	`thread_id` text NOT NULL,
	`parent_id` text,
	`author_id` text NOT NULL,
	`body_md` text NOT NULL,
	`body_html` text NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`hidden` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`edited_at` integer,
	FOREIGN KEY (`thread_id`) REFERENCES `thread`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `post_thread_idx` ON `post` (`thread_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `problem` (
	`id` text PRIMARY KEY NOT NULL,
	`number` integer NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`difficulty` text NOT NULL,
	`difficulty_display` text NOT NULL,
	`tags` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`version` integer DEFAULT 1 NOT NULL,
	`license` text NOT NULL,
	`source` text DEFAULT 'Original KingCoda problem' NOT NULL,
	`accepted_count` integer DEFAULT 0 NOT NULL,
	`submission_count` integer DEFAULT 0 NOT NULL,
	`acceptance_rate` real,
	`median_attempts` real,
	`is_premium` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `problem_number_unique` ON `problem` (`number`);--> statement-breakpoint
CREATE UNIQUE INDEX `problem_slug_unique` ON `problem` (`slug`);--> statement-breakpoint
CREATE INDEX `problem_status_number_idx` ON `problem` (`status`,`number`);--> statement-breakpoint
CREATE INDEX `problem_status_difficulty_idx` ON `problem` (`status`,`difficulty_display`,`number`);--> statement-breakpoint
CREATE INDEX `problem_status_acceptance_idx` ON `problem` (`status`,`acceptance_rate`);--> statement-breakpoint
CREATE TABLE `problem_content` (
	`problem_id` text NOT NULL,
	`version` integer NOT NULL,
	`statement_md` text NOT NULL,
	`constraints_md` text NOT NULL,
	`examples` text NOT NULL,
	`hints` text NOT NULL,
	`signature` text NOT NULL,
	`starter_code` text NOT NULL,
	`limits` text NOT NULL,
	`checker` text NOT NULL,
	`editorial_md` text NOT NULL,
	`reference_solutions` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`problem_id`, `version`),
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `problem_tag` (
	`problem_id` text NOT NULL,
	`tag` text NOT NULL,
	PRIMARY KEY(`problem_id`, `tag`),
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `problem_tag_tag_idx` ON `problem_tag` (`tag`,`problem_id`);--> statement-breakpoint
CREATE TABLE `profile` (
	`user_id` text PRIMARY KEY NOT NULL,
	`handle` text NOT NULL,
	`display_name` text NOT NULL,
	`tz` text DEFAULT 'UTC' NOT NULL,
	`main_lang` text DEFAULT 'python' NOT NULL,
	`xp` integer DEFAULT 0 NOT NULL,
	`level` integer DEFAULT 1 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`points_all_time` integer DEFAULT 0 NOT NULL,
	`rating` integer DEFAULT 1500 NOT NULL,
	`rating_peak` integer DEFAULT 1500 NOT NULL,
	`contests_rated` integer DEFAULT 0 NOT NULL,
	`streak_current` integer DEFAULT 0 NOT NULL,
	`streak_best` integer DEFAULT 0 NOT NULL,
	`streak_last_day` text,
	`freezes_held` integer DEFAULT 0 NOT NULL,
	`sound_on` integer DEFAULT false NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	`equipped` text DEFAULT '{"theme":"midnight","frame":null,"banner":null,"fx":null,"flame":null,"title":null}' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `profile_handle_unique` ON `profile` (`handle`);--> statement-breakpoint
CREATE TABLE `rank_snapshot` (
	`scope` text NOT NULL,
	`period_key` text NOT NULL,
	`day` text NOT NULL,
	`user_id` text NOT NULL,
	`rank` integer NOT NULL,
	PRIMARY KEY(`scope`, `period_key`, `day`, `user_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `rating_change` (
	`contest_id` text NOT NULL,
	`user_id` text NOT NULL,
	`old_rating` integer NOT NULL,
	`new_rating` integer NOT NULL,
	`performance` integer NOT NULL,
	PRIMARY KEY(`contest_id`, `user_id`),
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `recap` (
	`user_id` text NOT NULL,
	`week_key` text NOT NULL,
	`stats` text NOT NULL,
	`image_r2_key` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `week_key`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `report` (
	`id` text PRIMARY KEY NOT NULL,
	`reporter_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`reason` text NOT NULL,
	`status` text DEFAULT 'open' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`reporter_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_user_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `study_plan` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `study_plan_slug_unique` ON `study_plan` (`slug`);--> statement-breakpoint
CREATE TABLE `study_plan_item` (
	`plan_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`section` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`plan_id`, `problem_id`),
	FOREIGN KEY (`plan_id`) REFERENCES `study_plan`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `study_plan_item_order_idx` ON `study_plan_item` (`plan_id`,`position`);--> statement-breakpoint
CREATE TABLE `submission` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`problem_version` integer NOT NULL,
	`lang` text NOT NULL,
	`mode` text NOT NULL,
	`contest_id` text,
	`status` text DEFAULT 'queued' NOT NULL,
	`verdict` text,
	`passed` integer,
	`total` integer,
	`runtime_ms` integer,
	`memory_kb` integer,
	`code_r2_key` text NOT NULL,
	`code_hash` text NOT NULL,
	`code_bytes` integer NOT NULL,
	`fail_case` text,
	`fail_category` text,
	`compile_log` text,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`judged_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`contest_id`) REFERENCES `contest`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `submission_user_problem_idx` ON `submission` (`user_id`,`problem_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `submission_user_created_idx` ON `submission` (`user_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `submission_contest_idx` ON `submission` (`contest_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `submission_status_idx` ON `submission` (`status`,`created_at`);--> statement-breakpoint
CREATE TABLE `test_set` (
	`problem_id` text NOT NULL,
	`version` integer NOT NULL,
	`kind` text NOT NULL,
	`r2_key` text NOT NULL,
	`count` integer NOT NULL,
	`checksum` text NOT NULL,
	PRIMARY KEY(`problem_id`, `version`, `kind`),
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `thread` (
	`id` text PRIMARY KEY NOT NULL,
	`problem_id` text,
	`author_id` text NOT NULL,
	`title` text NOT NULL,
	`kind` text DEFAULT 'discussion' NOT NULL,
	`lang` text,
	`score` integer DEFAULT 0 NOT NULL,
	`post_count` integer DEFAULT 0 NOT NULL,
	`locked` integer DEFAULT false NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`author_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `thread_problem_idx` ON `thread` (`problem_id`,`kind`,`score`);--> statement-breakpoint
CREATE TABLE `track` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `track_slug_unique` ON `track` (`slug`);--> statement-breakpoint
CREATE TABLE `track_problem` (
	`track_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`track_id`, `problem_id`),
	FOREIGN KEY (`track_id`) REFERENCES `track`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `track_problem_problem_idx` ON `track_problem` (`problem_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`role` text DEFAULT 'user' NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `user_badge` (
	`user_id` text NOT NULL,
	`badge_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `badge_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_item` (
	`user_id` text NOT NULL,
	`item_id` text NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `item_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `user_problem` (
	`user_id` text NOT NULL,
	`problem_id` text NOT NULL,
	`status` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`wrong_streak` integer DEFAULT 0 NOT NULL,
	`first_accepted_at` integer,
	`first_try` integer DEFAULT false NOT NULL,
	`best_runtime_ms` integer,
	`best_memory_kb` integer,
	`langs_solved` integer DEFAULT 0 NOT NULL,
	`editorial_revealed_at` integer,
	`hints_revealed` integer DEFAULT 0 NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	PRIMARY KEY(`user_id`, `problem_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`problem_id`) REFERENCES `problem`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_problem_status_idx` ON `user_problem` (`user_id`,`status`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch('subsec') * 1000) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);--> statement-breakpoint
CREATE TABLE `vote` (
	`user_id` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`value` integer NOT NULL,
	PRIMARY KEY(`user_id`, `target_type`, `target_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
