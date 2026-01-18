<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function match_tables_available(): bool
{
  return table_exists('match_rooms') && table_exists('match_moves');
}

function match_chat_available(): bool
{
  return table_exists('match_messages');
}

function fetch_match_room(string $match_id): ?array
{
  return db_fetch_one(
    'SELECT match_id, white_id, black_id, status, side_to_move, last_move, move_count,
            created_at, updated_at
     FROM match_rooms
     WHERE match_id = :match_id
     LIMIT 1',
    ['match_id' => $match_id]
  );
}

function fetch_match_meta(string $match_id, string $user_id): ?array
{
  if (!table_exists('matches')) {
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
  return db_fetch_all(
    'SELECT ply, side, from_square, to_square, notation, created_at
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
    return [
      'ply' => isset($move['ply']) ? (int) $move['ply'] : 0,
      'side' => $move['side'] ?? 'white',
      'from' => $move['from_square'],
      'to' => $move['to_square'],
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
    'status' => $room['status'] ?? 'active',
    'sideToMove' => $room['side_to_move'] ?? 'white',
    'lastMove' => $room['last_move'] ?? '-',
    'moveCount' => isset($room['move_count']) ? (int) $room['move_count'] : 0,
    'createdAt' => $room['created_at'] ?? null,
    'updatedAt' => $room['updated_at'] ?? null,
    'yourSide' => side_for_user($user_id, $room),
    'mode' => $meta['mode'] ?? null,
    'opponent' => $meta['opponent'] ?? null,
    'timeControl' => $meta['time_control'] ?? null,
    'side' => $meta['side'] ?? null,
    'moves' => $formatted_moves,
    'messages' => $formatted_messages,
  ];
}
