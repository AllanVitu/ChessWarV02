<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/match.php';
require_once __DIR__ . '/_shared/security.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

enforce_rate_limit('matchmake-status-user', 45, 60, 'user:' . $user_id);

if (!match_tables_available() || !match_queue_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "Le matchmaking n'est pas encore disponible.",
  ]);
  exit;
}

$open_match = find_open_match_for_user($user_id);
if ($open_match && !empty($open_match['match_id'])) {
  json_response(200, [
    'ok' => true,
    'status' => 'matched',
    'matchId' => (string) $open_match['match_id'],
    'matchStatus' => normalize_match_room_status((string) ($open_match['status'] ?? 'started')),
  ]);
  exit;
}

$queued = db_fetch_one(
  'SELECT mode, time_control, side_preference, created_at
   FROM match_queue
   WHERE user_id = :user_id
   ORDER BY created_at DESC
   LIMIT 1',
  ['user_id' => $user_id]
);

if ($queued) {
  json_response(200, [
    'ok' => true,
    'status' => 'queued',
    'mode' => (string) ($queued['mode'] ?? 'ranked'),
    'timeControl' => (string) ($queued['time_control'] ?? '10+0'),
    'side' => (string) ($queued['side_preference'] ?? 'Aleatoire'),
    'queuedAt' => $queued['created_at'] ?? null,
  ]);
  exit;
}

json_response(200, [
  'ok' => true,
  'status' => 'idle',
]);
