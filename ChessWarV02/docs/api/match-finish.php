<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/match.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

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

if (!in_array($result, ['resign', 'draw'], true)) {
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

$label = $result === 'draw' ? 'Match nul' : 'Abandon';

db_query(
  'UPDATE match_rooms
   SET status = :status,
       last_move = :last_move,
       updated_at = now()
   WHERE match_id = :match_id',
  [
    'status' => 'finished',
    'last_move' => $label,
    'match_id' => $match_id,
  ]
);

db_query(
  'UPDATE matches
   SET status = :status,
       last_move = :last_move
   WHERE id = :match_id',
  [
    'status' => 'termine',
    'last_move' => $label,
    'match_id' => $match_id,
  ]
);

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
