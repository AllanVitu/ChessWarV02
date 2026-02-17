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
$scope = strtolower(trim((string) ($payload['scope'] ?? 'history')));

if ($scope === 'all') {
  db_query(
    'DELETE FROM matches
     WHERE user_id = :user_id',
    ['user_id' => $user_id]
  );
} else {
  db_query(
    'DELETE FROM matches
     WHERE user_id = :user_id
       AND status IN (:status_finished, :status_aborted, :status_termine, :status_abandonne)',
    [
      'user_id' => $user_id,
      'status_finished' => 'finished',
      'status_aborted' => 'aborted',
      'status_termine' => 'termine',
      'status_abandonne' => 'abandonne',
    ]
  );
}

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

$message = $scope === 'all' ? 'Historique efface.' : 'Historique efface.';

json_response(200, [
  'ok' => true,
  'message' => $message,
  'matches' => $matches,
]);
