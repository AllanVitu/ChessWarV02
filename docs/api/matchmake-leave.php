<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/match.php';
require_once __DIR__ . '/_shared/security.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

enforce_rate_limit('matchmake-leave-user', 30, 60, 'user:' . $user_id);

if (!match_queue_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "Le matchmaking n'est pas encore disponible.",
  ]);
  exit;
}

db_query(
  'DELETE FROM match_queue WHERE user_id = :user_id',
  ['user_id' => $user_id]
);

json_response(200, [
  'ok' => true,
  'status' => 'idle',
]);
