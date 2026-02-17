<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/match.php';
require_once __DIR__ . '/_shared/realtime.php';
require_once __DIR__ . '/_shared/security.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

enforce_rate_limit('match-finish-user', 20, 60, 'user:' . $user_id);

if (!match_tables_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "Le multijoueur n'est pas encore disponible.",
  ]);
  exit;
}

$payload = request_json();
$match_id = trim((string) ($payload['matchId'] ?? ''));
$result = strtolower(trim((string) ($payload['result'] ?? '')));

if ($match_id === '' || $result === '') {
  json_response(400, ['ok' => false, 'message' => 'Donnees manquantes.']);
  exit;
}

if (!is_valid_uuid($match_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

if (!in_array($result, ['resign', 'draw', 'timeout'], true)) {
  json_response(400, ['ok' => false, 'message' => 'Resultat invalide.']);
  exit;
}

$room = fetch_match_room($match_id);
if (!$room) {
  json_response(404, ['ok' => false, 'message' => 'Match introuvable.']);
  exit;
}

if (!is_match_player($user_id, $room)) {
  json_response(403, ['ok' => false, 'message' => 'Acces refuse.']);
  exit;
}

$status = normalize_match_room_status((string) ($room['status'] ?? 'waiting'));
if ($status === 'finished' || $status === 'aborted') {
  $payload = build_match_payload($user_id, $room);
  json_response(200, [
    'ok' => true,
    'match' => $payload,
  ]);
  exit;
}

if ($result === 'draw') {
  $label = 'Match nul';
} elseif ($result === 'timeout') {
  $label = 'Temps ecoule';
} else {
  $label = 'Abandon';
}

$room_finished_fragment = match_room_has_column('finished_at')
  ? 'finished_at = COALESCE(finished_at, now()),'
  : '';
db_query(
  sprintf(
    'UPDATE match_rooms
     SET status = :status,
         %s
         last_move = :last_move,
         updated_at = now()
     WHERE match_id = :match_id',
    $room_finished_fragment
  ),
  [
    'status' => 'finished',
    'last_move' => $label,
    'match_id' => $match_id,
  ]
);

$matches_finished_fragment = matches_has_column('finished_at')
  ? ', finished_at = COALESCE(finished_at, now())'
  : '';
db_query(
  sprintf(
    'UPDATE matches
     SET status = :status%s,
         last_move = :last_move
     WHERE id = :match_id',
    $matches_finished_fragment
  ),
  [
    'status' => 'finished',
    'last_move' => $label,
    'match_id' => $match_id,
  ]
);

notify_match_update($match_id, 'finish');

$room = fetch_match_room($match_id);
if (!$room) {
  json_response(404, ['ok' => false, 'message' => 'Match introuvable.']);
  exit;
}

$payload = build_match_payload($user_id, $room);

json_response(200, [
  'ok' => true,
  'match' => $payload,
]);
