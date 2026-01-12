<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/seed.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

ensure_matches_seed($user_id);

$rows = db_fetch_all(
  'SELECT id, mode, opponent, status, created_at, last_move, time_control, side, difficulty
   FROM matches WHERE user_id = :user_id ORDER BY created_at DESC',
  ['user_id' => $user_id]
);

$matches = array_map(static function (array $item): array {
  return [
    'id' => $item['id'],
    'mode' => $item['mode'],
    'opponent' => $item['opponent'],
    'status' => $item['status'],
    'createdAt' => $item['created_at'],
    'lastMove' => $item['last_move'],
    'timeControl' => $item['time_control'],
    'side' => $item['side'],
    'difficulty' => $item['difficulty'] ?: null,
  ];
}, $rows);

json_response(200, [
  'ok' => true,
  'matches' => $matches,
]);
