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

enforce_rate_limit('match-presence-user', 120, 60, 'user:' . $user_id);

if (!match_tables_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "Le multijoueur n'est pas encore disponible.",
  ]);
  exit;
}

if (!match_room_has_column('white_seen_at') || !match_room_has_column('black_seen_at')) {
  json_response(503, [
    'ok' => false,
    'message' => "La presence multijoueur n'est pas disponible.",
  ]);
  exit;
}

$payload = request_json();
$match_id = trim((string) ($payload['matchId'] ?? ''));
if ($match_id === '') {
  json_response(400, ['ok' => false, 'message' => 'Identifiant manquant.']);
  exit;
}
if (!is_valid_uuid($match_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

$room = db_fetch_one(
  'SELECT match_id, white_id, black_id
   FROM match_rooms
   WHERE match_id = :match_id
   LIMIT 1',
  ['match_id' => $match_id]
);

if (!$room) {
  json_response(404, ['ok' => false, 'message' => 'Match introuvable.']);
  exit;
}

if (!is_match_player($user_id, $room)) {
  json_response(403, ['ok' => false, 'message' => 'Acces refuse.']);
  exit;
}

$side = side_for_user($user_id, $room);
$seen_column = $side === 'white' ? 'white_seen_at' : 'black_seen_at';

db_query(
  sprintf(
    'UPDATE match_rooms
     SET %s = now(),
         updated_at = now()
     WHERE match_id = :match_id',
    $seen_column
  ),
  ['match_id' => $match_id]
);

$synced_room = fetch_match_room($match_id);
if (!$synced_room) {
  json_response(404, ['ok' => false, 'message' => 'Match introuvable.']);
  exit;
}

$status = normalize_match_room_status((string) ($synced_room['status'] ?? 'waiting'));
if (in_array($status, ['ready', 'started', 'aborted'], true)) {
  notify_match_update($match_id, 'presence');
}

$match_payload = build_match_payload($user_id, $synced_room);
json_response(200, [
  'ok' => true,
  'match' => $match_payload,
]);
