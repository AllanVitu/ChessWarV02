<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/match.php';
require_once __DIR__ . '/_shared/chess_rules.php';
require_once __DIR__ . '/_shared/realtime.php';

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
$from = strtolower(trim((string) ($payload['from'] ?? '')));
$to = strtolower(trim((string) ($payload['to'] ?? '')));
$promotion = strtolower(trim((string) ($payload['promotion'] ?? '')));
$notation = trim((string) ($payload['notation'] ?? ''));

if ($match_id === '' || $from === '' || $to === '') {
  json_response(400, ['ok' => false, 'message' => 'Donnees manquantes.']);
  exit;
}

if (!is_valid_uuid($match_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

if (!preg_match('/^[a-h][1-8]$/', $from) || !preg_match('/^[a-h][1-8]$/', $to)) {
  json_response(400, ['ok' => false, 'message' => 'Coup invalide.']);
  exit;
}
if ($from === $to) {
  json_response(400, ['ok' => false, 'message' => 'Coup invalide.']);
  exit;
}

if ($promotion !== '' && !in_array($promotion, ['q', 'r', 'b', 'n'], true)) {
  json_response(400, ['ok' => false, 'message' => 'Promotion invalide.']);
  exit;
}

$pdo = db();
$pdo->beginTransaction();

try {
  $room = db_fetch_one(
    'SELECT match_id, white_id, black_id, status, side_to_move, last_move, move_count
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

  if (($room['status'] ?? 'active') !== 'active') {
    $pdo->rollBack();
    json_response(409, ['ok' => false, 'message' => 'Match termine.']);
    exit;
  }

  if (!is_match_player($user_id, $room)) {
    $pdo->rollBack();
    json_response(403, ['ok' => false, 'message' => 'Acces refuse.']);
    exit;
  }

  $player_side = side_for_user($user_id, $room);
  $expected_side = (string) ($room['side_to_move'] ?? 'white');

  if ($player_side !== $expected_side) {
    $pdo->rollBack();
    json_response(409, ['ok' => false, 'message' => 'Ce n\'est pas votre tour.']);
    exit;
  }

  $history_moves = fetch_match_moves($match_id);
  $replay = chess_replay_moves($history_moves);
  if (!($replay['ok'] ?? false)) {
    $pdo->rollBack();
    json_response(409, ['ok' => false, 'message' => 'Historique du match invalide.']);
    exit;
  }

  $state = $replay['state'];
  $state_turn = (string) ($state['turn'] ?? $expected_side);
  if ($state_turn !== $expected_side) {
    $expected_side = $state_turn;
    if ($player_side !== $expected_side) {
      $pdo->rollBack();
      json_response(409, ['ok' => false, 'message' => 'Ce n\'est pas votre tour.']);
      exit;
    }
  }

  $legal_move = chess_find_legal_move(
    $state,
    $from,
    $to,
    $promotion !== '' ? $promotion : null
  );
  if (!$legal_move) {
    $pdo->rollBack();
    json_response(409, ['ok' => false, 'message' => 'Coup illegal.']);
    exit;
  }

  $next_state = chess_apply_move_state($state, $legal_move);
  $next_side = (string) ($next_state['turn'] ?? ($expected_side === 'white' ? 'black' : 'white'));
  $effective_promotion = (string) ($legal_move['promotion'] ?? '');
  if ($notation === '') {
    $notation = $from . '-' . $to . ($effective_promotion !== '' ? '=' . strtoupper($effective_promotion) : '');
  }

  $next_ply = count($history_moves) + 1;

  if (match_moves_supports_promotion()) {
    db_query(
      'INSERT INTO match_moves
       (match_id, ply, side, from_square, to_square, promotion, notation)
       VALUES
       (:match_id, :ply, :side, :from_square, :to_square, :promotion, :notation)',
      [
        'match_id' => $match_id,
        'ply' => $next_ply,
        'side' => $expected_side,
        'from_square' => $from,
        'to_square' => $to,
        'promotion' => $effective_promotion !== '' ? $effective_promotion : null,
        'notation' => $notation,
      ]
    );
  } else {
    db_query(
      'INSERT INTO match_moves
       (match_id, ply, side, from_square, to_square, notation)
       VALUES
       (:match_id, :ply, :side, :from_square, :to_square, :notation)',
      [
        'match_id' => $match_id,
        'ply' => $next_ply,
        'side' => $expected_side,
        'from_square' => $from,
        'to_square' => $to,
        'notation' => $notation,
      ]
    );
  }

  db_query(
    'UPDATE match_rooms
     SET side_to_move = :side_to_move,
         last_move = :last_move,
         move_count = :move_count,
         updated_at = now()
     WHERE match_id = :match_id',
    [
      'side_to_move' => $next_side,
      'last_move' => $notation,
      'move_count' => $next_ply,
      'match_id' => $match_id,
    ]
  );

  db_query(
    'UPDATE matches
     SET last_move = :last_move,
         status = :status
     WHERE id = :match_id',
    [
      'last_move' => $notation,
      'status' => 'en_cours',
      'match_id' => $match_id,
    ]
  );

  $pdo->commit();
} catch (Throwable $error) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  json_response(500, ['ok' => false, 'message' => 'Erreur serveur.']);
  exit;
}

notify_match_update($match_id, 'move');

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
