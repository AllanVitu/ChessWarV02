<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/security.php';
require_once __DIR__ . '/_shared/match.php';

function mm_normalize_mode(string $value): string
{
  $mode = strtolower(trim($value));
  return in_array($mode, ['ranked', 'friendly'], true) ? $mode : 'ranked';
}

function mm_normalize_time_control(string $value): string
{
  $time_control = trim($value);
  if ($time_control === '') {
    return '10+0';
  }
  if (!preg_match('/^\d+(?:\+\d+)?$/', $time_control)) {
    return '10+0';
  }
  return $time_control;
}

function mm_normalize_side(string $value): string
{
  $side = trim($value);
  if (in_array($side, ['Blancs', 'Noirs', 'Aleatoire'], true)) {
    return $side;
  }
  return 'Aleatoire';
}

function mm_resolve_sides(string $self_side, string $opponent_side): ?array
{
  if ($self_side === 'Blancs' && $opponent_side === 'Blancs') {
    return null;
  }
  if ($self_side === 'Noirs' && $opponent_side === 'Noirs') {
    return null;
  }

  if ($self_side === 'Aleatoire' && $opponent_side === 'Aleatoire') {
    $self_side = random_int(0, 1) === 0 ? 'Blancs' : 'Noirs';
    $opponent_side = $self_side === 'Blancs' ? 'Noirs' : 'Blancs';
    return ['self' => $self_side, 'opponent' => $opponent_side];
  }

  if ($self_side === 'Aleatoire') {
    $self_side = $opponent_side === 'Blancs' ? 'Noirs' : 'Blancs';
    return ['self' => $self_side, 'opponent' => $opponent_side];
  }

  if ($opponent_side === 'Aleatoire') {
    $opponent_side = $self_side === 'Blancs' ? 'Noirs' : 'Blancs';
    return ['self' => $self_side, 'opponent' => $opponent_side];
  }

  return ['self' => $self_side, 'opponent' => $opponent_side];
}

function mm_user_name(string $user_id): string
{
  $row = db_fetch_one(
    'SELECT u.display_name, p.name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = :id
     LIMIT 1',
    ['id' => $user_id]
  );

  if (!$row) {
    return '';
  }

  $name = trim((string) ($row['name'] ?? ''));
  if ($name !== '') {
    return $name;
  }
  return trim((string) ($row['display_name'] ?? ''));
}

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

enforce_rate_limit('matchmake-join-user', 20, 60, 'user:' . $user_id);

if (!table_exists('matches') || !match_tables_available() || !match_queue_available()) {
  json_response(503, [
    'ok' => false,
    'message' => "Le matchmaking n'est pas encore disponible.",
  ]);
  exit;
}

$payload = request_json();
$mode = mm_normalize_mode((string) ($payload['mode'] ?? 'ranked'));
$time_control = mm_normalize_time_control((string) ($payload['timeControl'] ?? '10+0'));
$side_preference = mm_normalize_side((string) ($payload['side'] ?? 'Aleatoire'));

$open_match = find_open_match_for_user($user_id);
if ($open_match && !empty($open_match['match_id'])) {
  json_response(200, [
    'ok' => true,
    'status' => 'matched',
    'matchId' => (string) $open_match['match_id'],
    'matchStatus' => normalize_match_room_status((string) ($open_match['status'] ?? 'started')),
  ]);
  exit;
}

$pdo = db();
$pdo->beginTransaction();

try {
  db_query(
    'DELETE FROM match_queue WHERE user_id = :user_id',
    ['user_id' => $user_id]
  );

  $open_row = db_fetch_one(
    "SELECT match_id, status
     FROM match_rooms
     WHERE (white_id = :user_id OR black_id = :user_id)
       AND status IN ('waiting', 'ready', 'started', 'active')
     ORDER BY updated_at DESC
     LIMIT 1
     FOR UPDATE",
    ['user_id' => $user_id]
  );

  if ($open_row && !empty($open_row['match_id'])) {
    $pdo->commit();
    json_response(200, [
      'ok' => true,
      'status' => 'matched',
      'matchId' => (string) $open_row['match_id'],
      'matchStatus' => normalize_match_room_status((string) ($open_row['status'] ?? 'started')),
    ]);
    exit;
  }

  $candidates = db_fetch_all(
    'SELECT id, user_id, side_preference, created_at
     FROM match_queue
     WHERE user_id <> :user_id
       AND mode = :mode
       AND time_control = :time_control
     ORDER BY created_at ASC
     LIMIT 30
     FOR UPDATE SKIP LOCKED',
    [
      'user_id' => $user_id,
      'mode' => $mode,
      'time_control' => $time_control,
    ]
  );

  foreach ($candidates as $candidate) {
    $opponent_id = (string) ($candidate['user_id'] ?? '');
    if ($opponent_id === '' || $opponent_id === $user_id) {
      continue;
    }

    $opponent_open = db_fetch_one(
      "SELECT match_id
       FROM match_rooms
       WHERE (white_id = :user_id OR black_id = :user_id)
         AND status IN ('waiting', 'ready', 'started', 'active')
       ORDER BY updated_at DESC
       LIMIT 1",
      ['user_id' => $opponent_id]
    );
    if ($opponent_open) {
      db_query(
        'DELETE FROM match_queue WHERE id = :id',
        ['id' => (string) ($candidate['id'] ?? '')]
      );
      continue;
    }

    $resolved = mm_resolve_sides(
      $side_preference,
      mm_normalize_side((string) ($candidate['side_preference'] ?? 'Aleatoire'))
    );
    if (!$resolved) {
      continue;
    }

    $self_name = mm_user_name($user_id);
    $opponent_name = mm_user_name($opponent_id);
    if ($self_name === '' || $opponent_name === '') {
      db_query(
        'DELETE FROM match_queue WHERE id = :id',
        ['id' => (string) ($candidate['id'] ?? '')]
      );
      continue;
    }

    $match_id = generate_uuid();
    $created_at = date('Y-m-d H:i');
    $self_side = $resolved['self'];
    $opp_side = $resolved['opponent'];

    $white_id = $self_side === 'Blancs' ? $user_id : $opponent_id;
    $black_id = $self_side === 'Blancs' ? $opponent_id : $user_id;

    db_query(
      'INSERT INTO matches
       (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
       VALUES
       (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)',
      [
        'id' => $match_id,
        'user_id' => $user_id,
        'mode' => 'JcJ',
        'opponent' => $opponent_name,
        'status' => 'waiting',
        'created_at' => $created_at,
        'last_move' => '-',
        'time_control' => $time_control,
        'side' => $self_side,
        'difficulty' => null,
      ]
    );

    db_query(
      'INSERT INTO matches
       (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
       VALUES
       (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)',
      [
        'id' => $match_id,
        'user_id' => $opponent_id,
        'mode' => 'JcJ',
        'opponent' => $self_name,
        'status' => 'waiting',
        'created_at' => $created_at,
        'last_move' => '-',
        'time_control' => $time_control,
        'side' => $opp_side,
        'difficulty' => null,
      ]
    );

    db_query(
      'INSERT INTO match_rooms
       (match_id, white_id, black_id, status, side_to_move, last_move, move_count)
       VALUES
       (:match_id, :white_id, :black_id, :status, :side_to_move, :last_move, :move_count)',
      [
        'match_id' => $match_id,
        'white_id' => $white_id,
        'black_id' => $black_id,
        'status' => 'waiting',
        'side_to_move' => 'white',
        'last_move' => '-',
        'move_count' => 0,
      ]
    );

    db_query(
      'DELETE FROM match_queue WHERE id = :id OR user_id = :self_user_id',
      [
        'id' => (string) ($candidate['id'] ?? ''),
        'self_user_id' => $user_id,
      ]
    );

    $pdo->commit();

    json_response(200, [
      'ok' => true,
      'status' => 'matched',
      'matchId' => $match_id,
      'matchStatus' => 'waiting',
    ]);
    exit;
  }

  $queue_id = generate_uuid();
  db_query(
    'INSERT INTO match_queue (id, user_id, mode, time_control, side_preference)
     VALUES (:id, :user_id, :mode, :time_control, :side_preference)',
    [
      'id' => $queue_id,
      'user_id' => $user_id,
      'mode' => $mode,
      'time_control' => $time_control,
      'side_preference' => $side_preference,
    ]
  );

  $queued_at = db_fetch_value(
    'SELECT created_at
     FROM match_queue
     WHERE id = :id
     LIMIT 1',
    ['id' => $queue_id]
  );

  $pdo->commit();
} catch (Throwable $error) {
  if ($pdo->inTransaction()) {
    $pdo->rollBack();
  }
  json_response(500, ['ok' => false, 'message' => 'Erreur serveur.']);
  exit;
}

json_response(200, [
  'ok' => true,
  'status' => 'queued',
  'mode' => $mode,
  'timeControl' => $time_control,
  'side' => $side_preference,
  'queuedAt' => $queued_at ?: gmdate('c'),
]);
