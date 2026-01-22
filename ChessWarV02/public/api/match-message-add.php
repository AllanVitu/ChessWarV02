<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/match.php';
require_once __DIR__ . '/_shared/realtime.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

if (!match_tables_available() || !match_chat_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "Le chat multijoueur n'est pas encore disponible.",
  ]);
  exit;
}

$payload = request_json();
$match_id = trim((string) ($payload['matchId'] ?? ''));
$message = trim((string) ($payload['message'] ?? ''));

if ($match_id === '' || $message === '') {
  json_response(400, ['ok' => false, 'message' => 'Message manquant.']);
  exit;
}

if (!is_valid_uuid($match_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

$message = preg_replace('/[\x00-\x1F\x7F]/', ' ', $message);
$message = trim((string) $message);

if ($message === '') {
  json_response(400, ['ok' => false, 'message' => 'Message invalide.']);
  exit;
}

if (strlen($message) > 280) {
  json_response(400, ['ok' => false, 'message' => 'Message trop long.']);
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

db_query(
  'INSERT INTO match_messages (match_id, user_id, message)
   VALUES (:match_id, :user_id, :message)',
  [
    'match_id' => $match_id,
    'user_id' => $user_id,
    'message' => $message,
  ]
);

notify_match_update($match_id, 'message');

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
