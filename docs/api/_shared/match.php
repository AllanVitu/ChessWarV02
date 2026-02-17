<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function match_tables_available(): bool
{
  return table_exists('match_rooms') && table_exists('match_moves');
}

function match_queue_available(): bool
{
  return table_exists('match_queue');
}

function match_chat_available(): bool
{
  return table_exists('match_messages');
}

function match_moves_supports_promotion(): bool
{
  static $supports = null;
  if ($supports !== null) {
    return $supports;
  }

  $column = db_fetch_one(
    "SELECT 1
     FROM information_schema.columns
     WHERE table_schema = current_schema()
       AND table_name = 'match_moves'
       AND column_name = 'promotion'
     LIMIT 1"
  );
  $supports = (bool) $column;
  return $supports;
}

function match_room_has_column(string $column): bool
{
  static $cache = [];
  if (array_key_exists($column, $cache)) {
    return $cache[$column];
  }
  $cache[$column] = column_exists('match_rooms', $column);
  return $cache[$column];
}

function matches_has_column(string $column): bool
{
  static $cache = [];
  if (array_key_exists($column, $cache)) {
    return $cache[$column];
  }
  $cache[$column] = column_exists('matches', $column);
  return $cache[$column];
}

function normalize_match_room_status(string $status): string
{
  $value = strtolower(trim($status));
  if ($value === 'active' || $value === 'en_cours') {
    return 'started';
  }
  if ($value === 'planifie') {
    return 'waiting';
  }
  if (in_array($value, ['waiting', 'ready', 'started', 'finished', 'aborted'], true)) {
    return $value;
  }
  return 'waiting';
}

function match_clock_ready_countdown_seconds(): int
{
  return 3;
}

function match_presence_timeout_seconds(): int
{
  return 35;
}

function match_time_to_unix(?string $value): ?int
{
  if (!$value) {
    return null;
  }

  try {
    $time = new DateTime($value);
  } catch (Throwable $error) {
    return null;
  }

  return $time->getTimestamp();
}

function is_match_presence_stale(?string $value, int $timeout_seconds): bool
{
  $seen_at = match_time_to_unix($value);
  if ($seen_at === null) {
    return false;
  }
  return (time() - $seen_at) > $timeout_seconds;
}

function fetch_match_room_raw(string $match_id): ?array
{
  $columns = [
    'match_id',
    'white_id',
    'black_id',
    'status',
    'side_to_move',
    'last_move',
    'move_count',
    'created_at',
    'updated_at',
  ];

  $optional_columns = [
    'ready_at',
    'start_at',
    'finished_at',
    'aborted_at',
    'white_ready_at',
    'black_ready_at',
    'white_seen_at',
    'black_seen_at',
  ];

  foreach ($optional_columns as $column) {
    if (match_room_has_column($column)) {
      $columns[] = $column;
    }
  }

  return db_fetch_one(
    sprintf(
      'SELECT %s
       FROM match_rooms
       WHERE match_id = :match_id
       LIMIT 1',
      implode(', ', $columns)
    ),
    ['match_id' => $match_id]
  );
}

function sync_matches_status(string $match_id, string $status): void
{
  static $matches_available = null;
  if ($matches_available === null) {
    $matches_available = table_exists('matches');
  }
  if (!$matches_available) {
    return;
  }

  $set = ['status = :status'];
  if ($status === 'started' && matches_has_column('started_at')) {
    $set[] = 'started_at = COALESCE(started_at, now())';
  }
  if (($status === 'finished' || $status === 'aborted') && matches_has_column('finished_at')) {
    $set[] = 'finished_at = COALESCE(finished_at, now())';
  }

  db_query(
    sprintf(
      'UPDATE matches
       SET %s
       WHERE id = :match_id',
      implode(', ', $set)
    ),
    [
      'status' => $status,
      'match_id' => $match_id,
    ]
  );
}

function sync_match_room_state(array $room): array
{
  $match_id = (string) ($room['match_id'] ?? '');
  if ($match_id === '') {
    return $room;
  }

  $status = normalize_match_room_status((string) ($room['status'] ?? 'waiting'));
  $original_status = (string) ($room['status'] ?? '');
  $next_status = $status;

  $updates = [];
  $params = ['match_id' => $match_id];

  $supports_timing = match_room_has_column('ready_at') && match_room_has_column('start_at');
  $supports_presence =
    $supports_timing &&
    match_room_has_column('white_seen_at') &&
    match_room_has_column('black_seen_at') &&
    match_room_has_column('white_ready_at') &&
    match_room_has_column('black_ready_at') &&
    match_room_has_column('aborted_at');

  if ($supports_timing) {
    $white_ready = !empty($room['white_ready_at']);
    $black_ready = !empty($room['black_ready_at']);

    if ($status === 'waiting' && $white_ready && $black_ready) {
      $next_status = 'ready';
      $updates[] = 'ready_at = COALESCE(ready_at, now())';
      $updates[] = sprintf(
        "start_at = COALESCE(start_at, now() + interval '%d seconds')",
        match_clock_ready_countdown_seconds()
      );
    }

    if ($status === 'ready') {
      if (empty($room['ready_at'])) {
        $updates[] = 'ready_at = COALESCE(ready_at, now())';
      }
      if (empty($room['start_at'])) {
        $updates[] = sprintf(
          "start_at = COALESCE(start_at, now() + interval '%d seconds')",
          match_clock_ready_countdown_seconds()
        );
      }
      $start_at = match_time_to_unix($room['start_at'] ?? null);
      if ($start_at !== null && $start_at <= time()) {
        $next_status = 'started';
      }
    }

    if (($status === 'started' || $next_status === 'started') && empty($room['start_at'])) {
      $updates[] = 'start_at = COALESCE(start_at, now())';
    }

    if ($supports_presence && in_array($status, ['waiting', 'ready'], true)) {
      $has_ready_player = $white_ready || $black_ready;
      if ($has_ready_player) {
        $white_stale = is_match_presence_stale(
          isset($room['white_seen_at']) ? (string) $room['white_seen_at'] : null,
          match_presence_timeout_seconds()
        );
        $black_stale = is_match_presence_stale(
          isset($room['black_seen_at']) ? (string) $room['black_seen_at'] : null,
          match_presence_timeout_seconds()
        );

        if ($white_stale || $black_stale) {
          $next_status = 'aborted';
          $updates[] = 'aborted_at = COALESCE(aborted_at, now())';
          if (isset($room['last_move']) && (string) $room['last_move'] === '-') {
            $updates[] = "last_move = 'Abandon (deconnexion)'";
          }
        }
      }
    }
  }

  if ($original_status !== $next_status) {
    $updates[] = 'status = :status';
    $params['status'] = $next_status;
  }

  if (!$updates) {
    return $room;
  }

  $updates[] = 'updated_at = now()';

  db_query(
    sprintf(
      'UPDATE match_rooms
       SET %s
       WHERE match_id = :match_id',
      implode(', ', array_values(array_unique($updates)))
    ),
    $params
  );

  sync_matches_status($match_id, $next_status);

  $fresh = fetch_match_room_raw($match_id);
  return $fresh ?: $room;
}

function fetch_match_room(string $match_id): ?array
{
  $room = fetch_match_room_raw($match_id);
  if (!$room) {
    return null;
  }
  return sync_match_room_state($room);
}

function fetch_match_meta(string $match_id, string $user_id): ?array
{
  static $matches_available = null;
  if ($matches_available === null) {
    $matches_available = table_exists('matches');
  }

  if (!$matches_available) {
    return null;
  }

  return db_fetch_one(
    'SELECT mode, opponent, time_control, side
     FROM matches
     WHERE id = :match_id
       AND user_id = :user_id
     LIMIT 1',
    [
      'match_id' => $match_id,
      'user_id' => $user_id,
    ]
  );
}

function find_open_match_for_user(string $user_id): ?array
{
  if (!match_tables_available()) {
    return null;
  }

  $row = db_fetch_one(
    "SELECT match_id
     FROM match_rooms
     WHERE (white_id = :user_id OR black_id = :user_id)
       AND status IN ('waiting', 'ready', 'started', 'active')
     ORDER BY updated_at DESC
     LIMIT 1",
    ['user_id' => $user_id]
  );

  if (!$row || empty($row['match_id'])) {
    return null;
  }

  return fetch_match_room((string) $row['match_id']);
}

function is_match_player(string $user_id, array $room): bool
{
  return $user_id === ($room['white_id'] ?? '') || $user_id === ($room['black_id'] ?? '');
}

function side_for_user(string $user_id, array $room): string
{
  return $user_id === ($room['white_id'] ?? '') ? 'white' : 'black';
}

function fetch_match_moves(string $match_id): array
{
  if (!match_moves_supports_promotion()) {
    return db_fetch_all(
      'SELECT ply, side, from_square, to_square, notation, created_at
       FROM match_moves
       WHERE match_id = :match_id
       ORDER BY ply ASC',
      ['match_id' => $match_id]
    );
  }

  return db_fetch_all(
    'SELECT ply, side, from_square, to_square, promotion, notation, created_at
     FROM match_moves
     WHERE match_id = :match_id
     ORDER BY ply ASC',
    ['match_id' => $match_id]
  );
}

function fetch_match_messages(string $match_id): array
{
  if (!match_chat_available()) {
    return [];
  }

  return db_fetch_all(
    'SELECT mm.id, mm.user_id, mm.message, mm.created_at, u.display_name, p.name
     FROM (
       SELECT id, match_id, user_id, message, created_at
       FROM match_messages
       WHERE match_id = :match_id
       ORDER BY created_at DESC
       LIMIT 50
     ) mm
     JOIN users u ON u.id = mm.user_id
     LEFT JOIN profiles p ON p.user_id = u.id
     ORDER BY mm.created_at ASC',
    ['match_id' => $match_id]
  );
}

function build_match_payload(string $user_id, array $room): array
{
  $moves = fetch_match_moves((string) $room['match_id']);
  $messages = fetch_match_messages((string) $room['match_id']);
  $meta = fetch_match_meta((string) $room['match_id'], $user_id);

  $formatted_moves = array_map(static function (array $move): array {
    $promotion = $move['promotion'] ?? null;
    if ($promotion === '') {
      $promotion = null;
    }

    return [
      'ply' => isset($move['ply']) ? (int) $move['ply'] : 0,
      'side' => $move['side'] ?? 'white',
      'from' => $move['from_square'],
      'to' => $move['to_square'],
      'promotion' => $promotion,
      'notation' => $move['notation'],
      'createdAt' => $move['created_at'],
    ];
  }, $moves);

  $formatted_messages = array_map(static function (array $message): array {
    $name = (string) ($message['name'] ?? '');
    if ($name === '') {
      $name = (string) ($message['display_name'] ?? '');
    }

    return [
      'id' => $message['id'],
      'userId' => $message['user_id'],
      'userName' => $name,
      'message' => $message['message'],
      'createdAt' => $message['created_at'],
    ];
  }, $messages);

  return [
    'matchId' => $room['match_id'],
    'whiteId' => $room['white_id'] ?? null,
    'blackId' => $room['black_id'] ?? null,
    'status' => normalize_match_room_status((string) ($room['status'] ?? 'waiting')),
    'sideToMove' => $room['side_to_move'] ?? 'white',
    'lastMove' => $room['last_move'] ?? '-',
    'moveCount' => isset($room['move_count']) ? (int) $room['move_count'] : 0,
    'createdAt' => $room['created_at'] ?? null,
    'updatedAt' => $room['updated_at'] ?? null,
    'readyAt' => $room['ready_at'] ?? null,
    'startAt' => $room['start_at'] ?? null,
    'finishedAt' => $room['finished_at'] ?? null,
    'abortedAt' => $room['aborted_at'] ?? null,
    'whiteReadyAt' => $room['white_ready_at'] ?? null,
    'blackReadyAt' => $room['black_ready_at'] ?? null,
    'serverTime' => gmdate('c'),
    'yourSide' => side_for_user($user_id, $room),
    'mode' => $meta['mode'] ?? null,
    'opponent' => $meta['opponent'] ?? null,
    'timeControl' => $meta['time_control'] ?? null,
    'side' => $meta['side'] ?? null,
    'moves' => $formatted_moves,
    'messages' => $formatted_messages,
  ];
}
