<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/invites.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

if (!table_exists('match_invites')) {
  json_response(503, [
    'ok' => false,
    'message' => "Les invitations de match ne sont pas encore disponibles.",
  ]);
  exit;
}

if (!table_exists('match_rooms') || !table_exists('match_moves')) {
  json_response(503, [
    'ok' => false,
    'message' => "Le multijoueur n'est pas encore disponible.",
  ]);
  exit;
}

expire_pending_invites();

$payload = request_json();
$invite_id = trim((string) ($payload['inviteId'] ?? ''));
$action = strtolower(trim((string) ($payload['action'] ?? '')));

if ($invite_id === '') {
  json_response(400, ['ok' => false, 'message' => 'Identifiant manquant.']);
  exit;
}

if (!is_valid_uuid($invite_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

if (!in_array($action, ['accept', 'decline'], true)) {
  json_response(400, ['ok' => false, 'message' => 'Action invalide.']);
  exit;
}

$invite = db_fetch_one(
  'SELECT id, requester_id, recipient_id, match_id, requester_side, recipient_side, time_control, created_at
   FROM match_invites
   WHERE id = :id
     AND recipient_id = :user_id
     AND status = :status
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1',
  [
    'id' => $invite_id,
    'user_id' => $user_id,
    'status' => 'pending',
  ]
);

if (!$invite) {
  $expired = db_fetch_one(
    'SELECT id
     FROM match_invites
     WHERE id = :id
       AND recipient_id = :user_id
       AND status = :status
     LIMIT 1',
    [
      'id' => $invite_id,
      'user_id' => $user_id,
      'status' => 'expired',
    ]
  );

  if ($expired) {
    json_response(410, ['ok' => false, 'message' => 'Invitation expiree.']);
    exit;
  }

  json_response(404, ['ok' => false, 'message' => 'Invitation introuvable.']);
  exit;
}

if ($action === 'decline') {
  db_query(
    'UPDATE match_invites
     SET status = :status,
         responded_at = now()
     WHERE id = :id',
    [
      'status' => 'declined',
      'id' => $invite_id,
    ]
  );

  json_response(200, [
    'ok' => true,
    'message' => 'Invitation refusee.',
    'status' => 'declined',
  ]);
  exit;
}

$accepted = accept_match_invite($invite);

json_response(200, [
  'ok' => true,
  'message' => 'Invitation acceptee.',
  'matchId' => $accepted['matchId'],
  'status' => 'accepted',
]);
