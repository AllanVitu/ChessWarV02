<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/friends.php';
require_once __DIR__ . '/_shared/security.php';
require_once __DIR__ . '/_shared/invites.php';
require_once __DIR__ . '/_shared/match.php';

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

expire_pending_invites();

if (!friend_requests_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "La gestion d'amis n'est pas encore disponible.",
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

$target = db_fetch_one(
  'SELECT id FROM users WHERE id = :id LIMIT 1',
  ['id' => $target_id]
);

if (!$target) {
  json_response(404, ['ok' => false, 'message' => 'Utilisateur introuvable.']);
  exit;
}

if (!are_friends($user_id, $target_id)) {
  json_response(403, ['ok' => false, 'message' => 'Vous devez etre amis pour inviter.']);
  exit;
}

$incoming = db_fetch_one(
  'SELECT id, requester_id, recipient_id, match_id, requester_side, recipient_side, time_control, created_at
   FROM match_invites
   WHERE status = :status
     AND requester_id = :target_id
     AND recipient_id = :user_id
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1',
  [
    'status' => 'pending',
    'user_id' => $user_id,
    'target_id' => $target_id,
  ]
);

if ($incoming) {
  if (!match_tables_available()) {
    json_response(503, [
      'ok' => false,
      'message' => "Le multijoueur n'est pas encore disponible.",
    ]);
    exit;
  }

  $accepted = accept_match_invite($incoming);
  json_response(200, [
    'ok' => true,
    'message' => 'Invitation acceptee.',
    'inviteId' => $incoming['id'],
    'matchId' => $accepted['matchId'],
    'status' => 'accepted',
  ]);
  exit;
}

$allowed_sides = ['Blancs', 'Noirs', 'Aleatoire'];
$requester_side = trim((string) ($payload['requesterSide'] ?? 'Aleatoire'));
if (!in_array($requester_side, $allowed_sides, true)) {
  $requester_side = 'Aleatoire';
}

$recipient_side = 'Aleatoire';
if ($requester_side === 'Blancs') {
  $recipient_side = 'Noirs';
} elseif ($requester_side === 'Noirs') {
  $recipient_side = 'Blancs';
}

$time_control = trim((string) ($payload['timeControl'] ?? '10+0'));
if ($time_control === '') {
  $time_control = '10+0';
}

$existing = db_fetch_one(
  'SELECT id, match_id
   FROM match_invites
   WHERE status = :status
     AND requester_id = :user_id
     AND recipient_id = :target_id
     AND (expires_at IS NULL OR expires_at > now())
   LIMIT 1',
  [
    'status' => 'pending',
    'user_id' => $user_id,
    'target_id' => $target_id,
  ]
);

if ($existing) {
  json_response(200, [
    'ok' => true,
    'message' => 'Une invitation est deja en attente.',
    'inviteId' => $existing['id'],
    'matchId' => $existing['match_id'],
    'status' => 'pending',
  ]);
  exit;
}

$invite_id = generate_uuid();
$match_id = generate_uuid();
$created_at = date('Y-m-d H:i');
$expires_at = (new DateTime('now', new DateTimeZone('UTC')))->modify('+24 hours')->format('c');

db_query(
  'INSERT INTO match_invites
   (id, requester_id, recipient_id, match_id, requester_side, recipient_side, time_control, status, created_at, expires_at)
   VALUES
   (:id, :requester_id, :recipient_id, :match_id, :requester_side, :recipient_side, :time_control, :status, :created_at, :expires_at)',
  [
    'id' => $invite_id,
    'requester_id' => $user_id,
    'recipient_id' => $target_id,
    'match_id' => $match_id,
    'requester_side' => $requester_side,
    'recipient_side' => $recipient_side,
    'time_control' => $time_control,
    'status' => 'pending',
    'created_at' => $created_at,
    'expires_at' => $expires_at,
  ]
);

json_response(200, [
  'ok' => true,
  'message' => 'Invitation envoyee.',
  'inviteId' => $invite_id,
  'matchId' => $match_id,
  'status' => 'pending',
]);
