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

enforce_rate_limit('match-ready-user', 30, 60, 'user:' . $user_id);

if (!match_tables_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "Le multijoueur n'est pas encore disponible.",
  ]);
  exit;
}

if (
  !match_room_has_column('ready_at') ||
  !match_room_has_column('start_at') ||
  !match_room_has_column('white_ready_at') ||
  !match_room_has_column('black_ready_at') ||
  !match_room_has_column('white_seen_at') ||
  !match_room_has_column('black_seen_at')
) {
  json_response(503, [
    'ok' => false,
    'message' => "La synchronisation de depart n'est pas disponible.",
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

$pdo = db();
$pdo->beginTransaction();

try {
  $room = db_fetch_one(
    'SELECT match_id, white_id, black_id, status
     FROM match_rooms
     WHERE match_id = :match_id
     LIMIT 1
     FOR UPDATE',
    ['match_id' => $match_id]
  );

  if (!$room) {
    $pdo->rollBack();
    json_response(404, ['ok' => false, 'message' => 'Match introuvable.']);
    exit;
  }

  if (!is_match_player($user_id, $room)) {
    $pdo->rollBack();
    json_response(403, ['ok' => false, 'message' => 'Acces refuse.']);
    exit;
  }

  $status = normalize_match_room_status((string) ($room['status'] ?? 'waiting'));
  if ($status === 'finished' || $status === 'aborted') {
    $pdo->rollBack();
    json_response(409, ['ok' => false, 'message' => 'Match termine.']);
    exit;
  }

  $side = side_for_user($user_id, $room);
  $ready_column = $side === 'white' ? 'white_ready_at' : 'black_ready_at';
  $seen_column = $side === 'white' ? 'white_seen_at' : 'black_seen_at';

  db_query(
    sprintf(
      'UPDATE match_rooms
       SET %s = COALESCE(%s, now()),
           %s = now(),
           updated_at = now()
       WHERE match_id = :match_id',
      $ready_column,
      $ready_column,
      $seen_column
    ),
    ['match_id' => $match_id]
  );

  $ready_state = db_fetch_one(
    'SELECT status, white_ready_at, black_ready_at
     FROM match_rooms
     WHERE match_id = :match_id
     LIMIT 1
     FOR UPDATE',
    ['match_id' => $match_id]
  );

  if ($ready_state) {
    $status = normalize_match_room_status((string) ($ready_state['status'] ?? 'waiting'));
    $white_ready = !empty($ready_state['white_ready_at']);
    $black_ready = !empty($ready_state['black_ready_at']);

    if (in_array($status, ['waiting', 'ready'], true) && $white_ready && $black_ready) {
      db_query(
        sprintf(
          "UPDATE match_rooms
           SET status = :status,
               ready_at = COALESCE(ready_at, now()),
               start_at = COALESCE(start_at, now() + interval '%d seconds'),
               updated_at = now()
           WHERE match_id = :match_id",
          match_clock_ready_countdown_seconds()
        ),
        [
          'status' => 'ready',
          'match_id' => $match_id,
        ]
      );
    }
  }

  $pdo->commit();
} catch (Throwable $error) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  json_response(500, ['ok' => false, 'message' => 'Erreur serveur.']);
  exit;
}

notify_match_update($match_id, 'ready');

$room = fetch_match_room($match_id);
if (!$room) {
  json_response(404, ['ok' => false, 'message' => 'Match introuvable.']);
  exit;
}

$match_payload = build_match_payload($user_id, $room);
json_response(200, [
  'ok' => true,
  'match' => $match_payload,
]);
