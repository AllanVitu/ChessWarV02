<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/friends.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

if (!friend_requests_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "La gestion d'amis n'est pas encore disponible.",
    'friendStatus' => 'none',
  ]);
  exit;
}

$payload = request_json();
$target_id = trim((string) ($payload['userId'] ?? ''));
$action = strtolower(trim((string) ($payload['action'] ?? '')));

if ($target_id === '') {
  json_response(400, ['ok' => false, 'message' => 'Identifiant manquant.']);
  exit;
}

if (!is_valid_uuid($target_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

if (!in_array($action, ['accept', 'decline'], true)) {
  json_response(400, ['ok' => false, 'message' => 'Action invalide.']);
  exit;
}

$request = db_fetch_one(
  'SELECT id
   FROM friend_requests
   WHERE requester_id = :target_id
     AND recipient_id = :user_id
     AND status = :status
   LIMIT 1',
  [
    'target_id' => $target_id,
    'user_id' => $user_id,
    'status' => 'pending',
  ]
);

if (!$request) {
  json_response(404, ['ok' => false, 'message' => 'Demande introuvable.']);
  exit;
}

$next_status = $action === 'accept' ? 'accepted' : 'declined';

db_query(
  'UPDATE friend_requests
   SET status = :status,
       responded_at = now(),
       recipient_seen_at = now()
   WHERE id = :id',
  [
    'status' => $next_status,
    'id' => $request['id'],
  ]
);

json_response(200, [
  'ok' => true,
  'message' => $next_status === 'accepted' ? 'Demande acceptee.' : 'Demande refusee.',
  'friendStatus' => $next_status === 'accepted' ? 'friends' : 'none',
]);
