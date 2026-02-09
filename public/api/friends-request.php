<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/friends.php';
require_once __DIR__ . '/_shared/security.php';

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

if ($target_id === '') {
  json_response(400, ['ok' => false, 'message' => 'Identifiant manquant.']);
  exit;
}

if (!is_valid_uuid($target_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

if ($target_id === $user_id) {
  json_response(400, ['ok' => false, 'message' => 'Action invalide.']);
  exit;
}

$existing = db_fetch_one(
  'SELECT id, requester_id, recipient_id, status
   FROM friend_requests
   WHERE (requester_id = :user_id AND recipient_id = :target_id)
      OR (requester_id = :target_id AND recipient_id = :user_id)
   LIMIT 1',
  ['user_id' => $user_id, 'target_id' => $target_id]
);

if ($existing) {
  $status = $existing['status'] ?? '';
  $requester = $existing['requester_id'] ?? '';

  if ($status === 'accepted') {
    json_response(200, [
      'ok' => true,
      'message' => 'Deja amis.',
      'friendStatus' => 'friends',
    ]);
    exit;
  }

  if ($status === 'pending') {
    $friend_status = $requester === $user_id ? 'outgoing' : 'incoming';
    json_response(200, [
      'ok' => true,
      'message' => 'Demande deja en attente.',
      'friendStatus' => $friend_status,
    ]);
    exit;
  }

  db_query(
    'UPDATE friend_requests
     SET requester_id = :requester_id,
         recipient_id = :recipient_id,
         status = :status,
         created_at = now(),
         responded_at = NULL,
         recipient_seen_at = NULL
     WHERE id = :id',
    [
      'requester_id' => $user_id,
      'recipient_id' => $target_id,
      'status' => 'pending',
      'id' => $existing['id'],
    ]
  );

  json_response(200, [
    'ok' => true,
    'message' => 'Demande envoyee.',
    'friendStatus' => 'outgoing',
  ]);
  exit;
}

$id = generate_uuid();

db_query(
  'INSERT INTO friend_requests (id, requester_id, recipient_id, status, recipient_seen_at)
   VALUES (:id, :requester_id, :recipient_id, :status, NULL)',
  [
    'id' => $id,
    'requester_id' => $user_id,
    'recipient_id' => $target_id,
    'status' => 'pending',
  ]
);

json_response(200, [
  'ok' => true,
  'message' => 'Demande envoyee.',
  'friendStatus' => 'outgoing',
]);
