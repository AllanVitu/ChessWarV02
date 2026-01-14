<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function match_tables_available(): bool
{
  return table_exists('match_rooms') && table_exists('match_moves');
}

function fetch_match_room(string $match_id): ?array
{
  return db_fetch_one(
    'SELECT match_id, white_id, black_id, status, side_to_move, last_move, move_count
     FROM match_rooms
     WHERE match_id = :match_id
     LIMIT 1',
    ['match_id' => $match_id]
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

function build_match_payload(string $user_id, array $room): array
{
  $moves = fetch_match_moves((string) $room['match_id']);

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

  return [
    'matchId' => $room['match_id'],
    'status' => $room['status'] ?? 'active',
    'sideToMove' => $room['side_to_move'] ?? 'white',
    'lastMove' => $room['last_move'] ?? '-',
    'moveCount' => isset($room['move_count']) ? (int) $room['move_count'] : 0,
    'yourSide' => side_for_user($user_id, $room),
    'moves' => $formatted_moves,
  ];
}
