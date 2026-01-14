<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';

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
   LIMIT 1',
  [
    'id' => $invite_id,
    'user_id' => $user_id,
    'status' => 'pending',
  ]
);

if (!$invite) {
  json_response(404, ['ok' => false, 'message' => 'Invitation introuvable.']);
  exit;
}

$next_status = $action === 'accept' ? 'accepted' : 'declined';

db_query(
  'UPDATE match_invites
   SET status = :status,
       responded_at = now()
   WHERE id = :id',
  [
    'status' => $next_status,
    'id' => $invite_id,
  ]
);

if ($next_status === 'declined') {
  json_response(200, [
    'ok' => true,
    'message' => 'Invitation refusee.',
  ]);
  exit;
}

$requester = db_fetch_one(
  'SELECT u.id, u.display_name, p.name
   FROM users u
   LEFT JOIN profiles p ON p.user_id = u.id
   WHERE u.id = :id
   LIMIT 1',
  ['id' => $invite['requester_id']]
);

$recipient = db_fetch_one(
  'SELECT u.id, u.display_name, p.name
   FROM users u
   LEFT JOIN profiles p ON p.user_id = u.id
   WHERE u.id = :id
   LIMIT 1',
  ['id' => $invite['recipient_id']]
);

$requester_name = (string) ($requester['name'] ?? '');
if ($requester_name === '') {
  $requester_name = (string) ($requester['display_name'] ?? '');
}

$recipient_name = (string) ($recipient['name'] ?? '');
if ($recipient_name === '') {
  $recipient_name = (string) ($recipient['display_name'] ?? '');
}

$match_id = (string) $invite['match_id'];
$created_at = (string) $invite['created_at'];
$time_control = (string) $invite['time_control'];
$requester_side = (string) ($invite['requester_side'] ?? '');
if ($requester_side === '') {
  $requester_side = 'Aleatoire';
}
$recipient_side = (string) ($invite['recipient_side'] ?? '');
if ($recipient_side === '') {
  $recipient_side = 'Aleatoire';
}

db_query(
  'INSERT INTO matches
   (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
   VALUES
   (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)
   ON CONFLICT DO NOTHING',
  [
    'id' => $match_id,
    'user_id' => $invite['requester_id'],
    'mode' => 'JcJ',
    'opponent' => $recipient_name,
    'status' => 'planifie',
    'created_at' => $created_at,
    'last_move' => '-',
    'time_control' => $time_control,
    'side' => $requester_side,
    'difficulty' => null,
  ]
);

db_query(
  'INSERT INTO matches
   (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
   VALUES
   (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)
   ON CONFLICT DO NOTHING',
  [
    'id' => $match_id,
    'user_id' => $invite['recipient_id'],
    'mode' => 'JcJ',
    'opponent' => $requester_name,
    'status' => 'planifie',
    'created_at' => $created_at,
    'last_move' => '-',
    'time_control' => $time_control,
    'side' => $recipient_side,
    'difficulty' => null,
  ]
);

json_response(200, [
  'ok' => true,
  'message' => 'Invitation acceptee.',
  'matchId' => $match_id,
]);
