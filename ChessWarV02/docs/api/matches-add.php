<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$payload = request_json();
$match = is_array($payload['match'] ?? null) ? $payload['match'] : [];

$id = (string) ($match['id'] ?? '');
$mode = (string) ($match['mode'] ?? '');
$status = (string) ($match['status'] ?? '');

if ($id === '' || $mode === '' || $status === '') {
  json_response(400, ['ok' => false, 'message' => 'Match invalide.']);
  exit;
}

db_query(
  'INSERT INTO matches
   (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
   VALUES
   (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)',
  [
    'id' => $id,
    'user_id' => $user_id,
    'mode' => $mode,
    'opponent' => (string) ($match['opponent'] ?? ''),
    'status' => $status,
    'created_at' => (string) ($match['createdAt'] ?? ''),
    'last_move' => (string) ($match['lastMove'] ?? ''),
    'time_control' => (string) ($match['timeControl'] ?? ''),
    'side' => (string) ($match['side'] ?? ''),
    'difficulty' => $match['difficulty'] ?? null,
  ]
);

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
