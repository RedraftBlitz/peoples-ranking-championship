INSERT OR IGNORE INTO `board_shares` (`token`, `board_id`, `created_at`)
SELECT lower(hex(randomblob(16))), `e`.`board_id`, `e`.`submitted_at`
FROM `board_entries` `e`
LEFT JOIN `board_shares` `s` ON `s`.`board_id` = `e`.`board_id`
WHERE `e`.`season` = 2026 AND `s`.`board_id` IS NULL;
