<?php

function chess_initial_board(): array
{
  return [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['', '', '', '', '', '', '', ''],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'],
  ];
}

function chess_initial_state(): array
{
  return [
    'board' => chess_initial_board(),
    'turn' => 'white',
    'castling' => [
      'K' => true,
      'Q' => true,
      'k' => true,
      'q' => true,
    ],
    'en_passant' => null,
    'halfmove' => 0,
    'fullmove' => 1,
  ];
}

function chess_is_in_bounds(int $row, int $col): bool
{
  return $row >= 0 && $row < 8 && $col >= 0 && $col < 8;
}

function chess_square_to_coords(string $square): ?array
{
  $square = strtolower(trim($square));
  if (!preg_match('/^[a-h][1-8]$/', $square)) {
    return null;
  }

  $file = ord($square[0]) - ord('a');
  $rank = (int) $square[1];

  return [
    'row' => 8 - $rank,
    'col' => $file,
  ];
}

function chess_coords_to_square(int $row, int $col): string
{
  return chr(ord('a') + $col) . (string) (8 - $row);
}

function chess_piece_side(string $piece): ?string
{
  if ($piece === '') {
    return null;
  }

  return strtoupper($piece) === $piece ? 'white' : 'black';
}

function chess_opposite_side(string $side): string
{
  return $side === 'white' ? 'black' : 'white';
}

function chess_is_side_piece(string $piece, string $side): bool
{
  return chess_piece_side($piece) === $side;
}

function chess_piece_type(string $piece): string
{
  return strtolower($piece);
}

function chess_copy_board(array $board): array
{
  return array_map(static function (array $row): array {
    return array_values($row);
  }, $board);
}

function chess_make_move(
  int $from_row,
  int $from_col,
  int $to_row,
  int $to_col,
  ?string $promotion = null,
  bool $is_en_passant = false,
  ?string $castle = null
): array {
  return [
    'from_row' => $from_row,
    'from_col' => $from_col,
    'to_row' => $to_row,
    'to_col' => $to_col,
    'from' => chess_coords_to_square($from_row, $from_col),
    'to' => chess_coords_to_square($to_row, $to_col),
    'promotion' => $promotion,
    'is_en_passant' => $is_en_passant,
    'castle' => $castle,
  ];
}

function chess_find_king(array $state, string $side): ?array
{
  $target = $side === 'white' ? 'K' : 'k';
  $board = $state['board'];

  for ($row = 0; $row < 8; $row += 1) {
    for ($col = 0; $col < 8; $col += 1) {
      if (($board[$row][$col] ?? '') === $target) {
        return ['row' => $row, 'col' => $col];
      }
    }
  }

  return null;
}

function chess_is_square_attacked(array $state, int $row, int $col, string $attacker): bool
{
  $board = $state['board'];

  if ($attacker === 'white') {
    $pawn_row = $row + 1;
    foreach ([$col - 1, $col + 1] as $pawn_col) {
      if (chess_is_in_bounds($pawn_row, $pawn_col) && ($board[$pawn_row][$pawn_col] ?? '') === 'P') {
        return true;
      }
    }
  } else {
    $pawn_row = $row - 1;
    foreach ([$col - 1, $col + 1] as $pawn_col) {
      if (chess_is_in_bounds($pawn_row, $pawn_col) && ($board[$pawn_row][$pawn_col] ?? '') === 'p') {
        return true;
      }
    }
  }

  $knight_offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];
  $knight_piece = $attacker === 'white' ? 'N' : 'n';
  foreach ($knight_offsets as [$dr, $dc]) {
    $nr = $row + $dr;
    $nc = $col + $dc;
    if (chess_is_in_bounds($nr, $nc) && ($board[$nr][$nc] ?? '') === $knight_piece) {
      return true;
    }
  }

  $diagonal_dirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
  $bishop_piece = $attacker === 'white' ? 'B' : 'b';
  $queen_piece = $attacker === 'white' ? 'Q' : 'q';
  foreach ($diagonal_dirs as [$dr, $dc]) {
    $nr = $row + $dr;
    $nc = $col + $dc;
    while (chess_is_in_bounds($nr, $nc)) {
      $piece = $board[$nr][$nc] ?? '';
      if ($piece !== '') {
        if ($piece === $bishop_piece || $piece === $queen_piece) {
          return true;
        }
        break;
      }
      $nr += $dr;
      $nc += $dc;
    }
  }

  $straight_dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  $rook_piece = $attacker === 'white' ? 'R' : 'r';
  foreach ($straight_dirs as [$dr, $dc]) {
    $nr = $row + $dr;
    $nc = $col + $dc;
    while (chess_is_in_bounds($nr, $nc)) {
      $piece = $board[$nr][$nc] ?? '';
      if ($piece !== '') {
        if ($piece === $rook_piece || $piece === $queen_piece) {
          return true;
        }
        break;
      }
      $nr += $dr;
      $nc += $dc;
    }
  }

  $king_piece = $attacker === 'white' ? 'K' : 'k';
  for ($dr = -1; $dr <= 1; $dr += 1) {
    for ($dc = -1; $dc <= 1; $dc += 1) {
      if ($dr === 0 && $dc === 0) {
        continue;
      }
      $nr = $row + $dr;
      $nc = $col + $dc;
      if (chess_is_in_bounds($nr, $nc) && ($board[$nr][$nc] ?? '') === $king_piece) {
        return true;
      }
    }
  }

  return false;
}

function chess_is_side_in_check(array $state, string $side): bool
{
  $king = chess_find_king($state, $side);
  if (!$king) {
    return true;
  }

  return chess_is_square_attacked(
    $state,
    (int) $king['row'],
    (int) $king['col'],
    chess_opposite_side($side)
  );
}

function chess_generate_pawn_moves(array $state, int $row, int $col, string $side): array
{
  $moves = [];
  $board = $state['board'];
  $direction = $side === 'white' ? -1 : 1;
  $start_row = $side === 'white' ? 6 : 1;
  $promotion_row = $side === 'white' ? 0 : 7;

  $one_row = $row + $direction;
  if (chess_is_in_bounds($one_row, $col) && ($board[$one_row][$col] ?? '') === '') {
    if ($one_row === $promotion_row) {
      foreach (['q', 'r', 'b', 'n'] as $promotion) {
        $moves[] = chess_make_move($row, $col, $one_row, $col, $promotion);
      }
    } else {
      $moves[] = chess_make_move($row, $col, $one_row, $col);
    }

    $two_row = $row + ($direction * 2);
    if ($row === $start_row && chess_is_in_bounds($two_row, $col) && ($board[$two_row][$col] ?? '') === '') {
      $moves[] = chess_make_move($row, $col, $two_row, $col);
    }
  }

  foreach ([$col - 1, $col + 1] as $capture_col) {
    if (!chess_is_in_bounds($one_row, $capture_col)) {
      continue;
    }

    $target = $board[$one_row][$capture_col] ?? '';
    if ($target !== '' && chess_piece_side($target) === chess_opposite_side($side)) {
      if ($one_row === $promotion_row) {
        foreach (['q', 'r', 'b', 'n'] as $promotion) {
          $moves[] = chess_make_move($row, $col, $one_row, $capture_col, $promotion);
        }
      } else {
        $moves[] = chess_make_move($row, $col, $one_row, $capture_col);
      }
    }

    $en_passant = $state['en_passant'];
    if (is_array($en_passant) && (int) ($en_passant['row'] ?? -1) === $one_row && (int) ($en_passant['col'] ?? -1) === $capture_col) {
      $moves[] = chess_make_move($row, $col, $one_row, $capture_col, null, true);
    }
  }

  return $moves;
}

function chess_generate_knight_moves(array $state, int $row, int $col, string $side): array
{
  $moves = [];
  $board = $state['board'];
  $offsets = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
  ];

  foreach ($offsets as [$dr, $dc]) {
    $nr = $row + $dr;
    $nc = $col + $dc;
    if (!chess_is_in_bounds($nr, $nc)) {
      continue;
    }

    $target = $board[$nr][$nc] ?? '';
    if ($target === '' || chess_piece_side($target) !== $side) {
      $moves[] = chess_make_move($row, $col, $nr, $nc);
    }
  }

  return $moves;
}

function chess_generate_sliding_moves(array $state, int $row, int $col, string $side, array $directions): array
{
  $moves = [];
  $board = $state['board'];

  foreach ($directions as [$dr, $dc]) {
    $nr = $row + $dr;
    $nc = $col + $dc;
    while (chess_is_in_bounds($nr, $nc)) {
      $target = $board[$nr][$nc] ?? '';
      if ($target === '') {
        $moves[] = chess_make_move($row, $col, $nr, $nc);
      } else {
        if (chess_piece_side($target) !== $side) {
          $moves[] = chess_make_move($row, $col, $nr, $nc);
        }
        break;
      }
      $nr += $dr;
      $nc += $dc;
    }
  }

  return $moves;
}

function chess_generate_king_moves(array $state, int $row, int $col, string $side): array
{
  $moves = [];
  $board = $state['board'];

  for ($dr = -1; $dr <= 1; $dr += 1) {
    for ($dc = -1; $dc <= 1; $dc += 1) {
      if ($dr === 0 && $dc === 0) {
        continue;
      }
      $nr = $row + $dr;
      $nc = $col + $dc;
      if (!chess_is_in_bounds($nr, $nc)) {
        continue;
      }
      $target = $board[$nr][$nc] ?? '';
      if ($target === '' || chess_piece_side($target) !== $side) {
        $moves[] = chess_make_move($row, $col, $nr, $nc);
      }
    }
  }

  if (chess_is_side_in_check($state, $side)) {
    return $moves;
  }

  $castling = $state['castling'];
  if ($side === 'white' && $row === 7 && $col === 4 && ($board[7][4] ?? '') === 'K') {
    if (!empty($castling['K']) && ($board[7][5] ?? '') === '' && ($board[7][6] ?? '') === '' && ($board[7][7] ?? '') === 'R') {
      if (!chess_is_square_attacked($state, 7, 5, 'black') && !chess_is_square_attacked($state, 7, 6, 'black')) {
        $moves[] = chess_make_move(7, 4, 7, 6, null, false, 'K');
      }
    }
    if (!empty($castling['Q']) && ($board[7][3] ?? '') === '' && ($board[7][2] ?? '') === '' && ($board[7][1] ?? '') === '' && ($board[7][0] ?? '') === 'R') {
      if (!chess_is_square_attacked($state, 7, 3, 'black') && !chess_is_square_attacked($state, 7, 2, 'black')) {
        $moves[] = chess_make_move(7, 4, 7, 2, null, false, 'Q');
      }
    }
  }

  if ($side === 'black' && $row === 0 && $col === 4 && ($board[0][4] ?? '') === 'k') {
    if (!empty($castling['k']) && ($board[0][5] ?? '') === '' && ($board[0][6] ?? '') === '' && ($board[0][7] ?? '') === 'r') {
      if (!chess_is_square_attacked($state, 0, 5, 'white') && !chess_is_square_attacked($state, 0, 6, 'white')) {
        $moves[] = chess_make_move(0, 4, 0, 6, null, false, 'k');
      }
    }
    if (!empty($castling['q']) && ($board[0][3] ?? '') === '' && ($board[0][2] ?? '') === '' && ($board[0][1] ?? '') === '' && ($board[0][0] ?? '') === 'r') {
      if (!chess_is_square_attacked($state, 0, 3, 'white') && !chess_is_square_attacked($state, 0, 2, 'white')) {
        $moves[] = chess_make_move(0, 4, 0, 2, null, false, 'q');
      }
    }
  }

  return $moves;
}

function chess_generate_pseudo_moves_for_piece(array $state, int $row, int $col): array
{
  $board = $state['board'];
  $piece = $board[$row][$col] ?? '';
  if ($piece === '') {
    return [];
  }

  $side = chess_piece_side($piece);
  if (!$side) {
    return [];
  }

  $type = chess_piece_type($piece);
  if ($type === 'p') {
    return chess_generate_pawn_moves($state, $row, $col, $side);
  }
  if ($type === 'n') {
    return chess_generate_knight_moves($state, $row, $col, $side);
  }
  if ($type === 'b') {
    return chess_generate_sliding_moves($state, $row, $col, $side, [[-1, -1], [-1, 1], [1, -1], [1, 1]]);
  }
  if ($type === 'r') {
    return chess_generate_sliding_moves($state, $row, $col, $side, [[-1, 0], [1, 0], [0, -1], [0, 1]]);
  }
  if ($type === 'q') {
    return chess_generate_sliding_moves(
      $state,
      $row,
      $col,
      $side,
      [[-1, -1], [-1, 1], [1, -1], [1, 1], [-1, 0], [1, 0], [0, -1], [0, 1]]
    );
  }
  if ($type === 'k') {
    return chess_generate_king_moves($state, $row, $col, $side);
  }

  return [];
}

function chess_apply_move_state(array $state, array $move): array
{
  $board = chess_copy_board($state['board']);
  $from_row = (int) $move['from_row'];
  $from_col = (int) $move['from_col'];
  $to_row = (int) $move['to_row'];
  $to_col = (int) $move['to_col'];

  $piece = $board[$from_row][$from_col] ?? '';
  if ($piece === '') {
    return $state;
  }

  $side = chess_piece_side($piece) ?? 'white';
  $captured_piece = $board[$to_row][$to_col] ?? '';
  $is_capture = $captured_piece !== '';

  $board[$from_row][$from_col] = '';

  if (!empty($move['castle'])) {
    $board[$to_row][$to_col] = $piece;
    if (($move['castle'] === 'K' || $move['castle'] === 'k') && $to_col === 6) {
      $rook = $board[$to_row][7] ?? '';
      $board[$to_row][7] = '';
      $board[$to_row][5] = $rook;
    } elseif (($move['castle'] === 'Q' || $move['castle'] === 'q') && $to_col === 2) {
      $rook = $board[$to_row][0] ?? '';
      $board[$to_row][0] = '';
      $board[$to_row][3] = $rook;
    }
  } else {
    if (!empty($move['is_en_passant'])) {
      $capture_row = $side === 'white' ? $to_row + 1 : $to_row - 1;
      if (chess_is_in_bounds($capture_row, $to_col)) {
        $captured_piece = $board[$capture_row][$to_col] ?? '';
        $board[$capture_row][$to_col] = '';
        $is_capture = $captured_piece !== '';
      }
    }

    $promotion = strtolower((string) ($move['promotion'] ?? ''));
    if ($promotion !== '' && in_array($promotion, ['q', 'r', 'b', 'n'], true)) {
      $board[$to_row][$to_col] = $side === 'white' ? strtoupper($promotion) : $promotion;
    } else {
      $board[$to_row][$to_col] = $piece;
    }
  }

  $castling = $state['castling'];
  if (strtolower($piece) === 'k') {
    if ($side === 'white') {
      $castling['K'] = false;
      $castling['Q'] = false;
    } else {
      $castling['k'] = false;
      $castling['q'] = false;
    }
  }

  if (strtolower($piece) === 'r') {
    if ($from_row === 7 && $from_col === 0) {
      $castling['Q'] = false;
    } elseif ($from_row === 7 && $from_col === 7) {
      $castling['K'] = false;
    } elseif ($from_row === 0 && $from_col === 0) {
      $castling['q'] = false;
    } elseif ($from_row === 0 && $from_col === 7) {
      $castling['k'] = false;
    }
  }

  if (strtolower($captured_piece) === 'r') {
    if ($to_row === 7 && $to_col === 0) {
      $castling['Q'] = false;
    } elseif ($to_row === 7 && $to_col === 7) {
      $castling['K'] = false;
    } elseif ($to_row === 0 && $to_col === 0) {
      $castling['q'] = false;
    } elseif ($to_row === 0 && $to_col === 7) {
      $castling['k'] = false;
    }
  }

  $en_passant = null;
  if (strtolower($piece) === 'p' && abs($to_row - $from_row) === 2) {
    $en_passant = [
      'row' => (int) (($to_row + $from_row) / 2),
      'col' => $from_col,
    ];
  }

  $halfmove = ((strtolower($piece) === 'p') || $is_capture) ? 0 : ((int) $state['halfmove'] + 1);
  $fullmove = (int) $state['fullmove'];
  if ($side === 'black') {
    $fullmove += 1;
  }

  return [
    'board' => $board,
    'turn' => chess_opposite_side($side),
    'castling' => $castling,
    'en_passant' => $en_passant,
    'halfmove' => $halfmove,
    'fullmove' => $fullmove,
  ];
}

function chess_generate_legal_moves(array $state, string $side): array
{
  $board = $state['board'];
  $moves = [];

  for ($row = 0; $row < 8; $row += 1) {
    for ($col = 0; $col < 8; $col += 1) {
      $piece = $board[$row][$col] ?? '';
      if ($piece === '' || chess_piece_side($piece) !== $side) {
        continue;
      }

      $pseudo = chess_generate_pseudo_moves_for_piece($state, $row, $col);
      foreach ($pseudo as $move) {
        $next = chess_apply_move_state($state, $move);
        if (!chess_is_side_in_check($next, $side)) {
          $moves[] = $move;
        }
      }
    }
  }

  return $moves;
}

function chess_find_legal_move(array $state, string $from, string $to, ?string $promotion): ?array
{
  $promotion = $promotion ? strtolower(trim($promotion)) : null;
  $candidates = [];
  $legal = chess_generate_legal_moves($state, (string) $state['turn']);
  foreach ($legal as $move) {
    if (($move['from'] ?? '') !== $from || ($move['to'] ?? '') !== $to) {
      continue;
    }
    $candidates[] = $move;
  }

  if (!$candidates) {
    return null;
  }

  if ($promotion) {
    foreach ($candidates as $move) {
      if (($move['promotion'] ?? null) === $promotion) {
        return $move;
      }
    }
    return null;
  }

  foreach ($candidates as $move) {
    if (($move['promotion'] ?? null) === null) {
      return $move;
    }
  }

  foreach ($candidates as $move) {
    if (($move['promotion'] ?? null) === 'q') {
      return $move;
    }
  }

  return $candidates[0] ?? null;
}

function chess_replay_moves(array $moves): array
{
  $state = chess_initial_state();
  foreach ($moves as $entry) {
    $from = strtolower((string) ($entry['from_square'] ?? ''));
    $to = strtolower((string) ($entry['to_square'] ?? ''));
    $promotion_raw = strtolower((string) ($entry['promotion'] ?? ''));
    $promotion = $promotion_raw !== '' ? $promotion_raw : null;
    $move = chess_find_legal_move($state, $from, $to, $promotion);
    if (!$move) {
      return [
        'ok' => false,
        'state' => $state,
      ];
    }
    $state = chess_apply_move_state($state, $move);
  }

  return [
    'ok' => true,
    'state' => $state,
  ];
}

