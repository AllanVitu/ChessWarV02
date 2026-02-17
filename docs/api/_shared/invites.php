<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function expire_pending_invites(): void
{
  if (!table_exists('match_invites')) {
    return;
  }

  db_query(
    'UPDATE match_invites
     SET expires_at = now() + interval \'24 hours\'
     WHERE status = :pending
       AND expires_at IS NULL',
    [
      'pending' => 'pending',
    ]
  );

  db_query(
    'UPDATE match_invites
     SET status = :status,
         responded_at = now()
    WHERE status = :pending
      AND expires_at IS NOT NULL
      AND expires_at <= now()',
    [
      'status' => 'expired',
      'pending' => 'pending',
    ]
  );
}

function accept_match_invite(array $invite): array
{
  $invite_id = (string) ($invite['id'] ?? '');
  $match_id = (string) ($invite['match_id'] ?? '');
  $requester_id = (string) ($invite['requester_id'] ?? '');
  $recipient_id = (string) ($invite['recipient_id'] ?? '');
  $created_at = (string) ($invite['created_at'] ?? '');
  $time_control = (string) ($invite['time_control'] ?? '10+0');

  $allowed_sides = ['Blancs', 'Noirs', 'Aleatoire'];
  $requester_side = (string) ($invite['requester_side'] ?? 'Aleatoire');
  $recipient_side = (string) ($invite['recipient_side'] ?? 'Aleatoire');
  if (!in_array($requester_side, $allowed_sides, true)) {
    $requester_side = 'Aleatoire';
  }
  if (!in_array($recipient_side, $allowed_sides, true)) {
    $recipient_side = 'Aleatoire';
  }

  if ($created_at === '') {
    $created_at = date('Y-m-d H:i');
  }

  db_query(
    'UPDATE match_invites
     SET status = :status,
         responded_at = now()
     WHERE id = :id',
    [
      'status' => 'accepted',
      'id' => $invite_id,
    ]
  );

  $requester = db_fetch_one(
    'SELECT u.id, u.display_name, p.name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = :id
     LIMIT 1',
    ['id' => $requester_id]
  );

  $recipient = db_fetch_one(
    'SELECT u.id, u.display_name, p.name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id = :id
     LIMIT 1',
    ['id' => $recipient_id]
  );

  $requester_name = (string) ($requester['name'] ?? '');
  if ($requester_name === '') {
    $requester_name = (string) ($requester['display_name'] ?? '');
  }

  $recipient_name = (string) ($recipient['name'] ?? '');
  if ($recipient_name === '') {
    $recipient_name = (string) ($recipient['display_name'] ?? '');
  }

  if ($requester_side === 'Aleatoire' || $recipient_side === 'Aleatoire') {
    $requester_side = random_int(0, 1) === 0 ? 'Blancs' : 'Noirs';
    $recipient_side = $requester_side === 'Blancs' ? 'Noirs' : 'Blancs';
    db_query(
      'UPDATE match_invites
       SET requester_side = :requester_side,
           recipient_side = :recipient_side
       WHERE id = :id',
      [
        'requester_side' => $requester_side,
        'recipient_side' => $recipient_side,
        'id' => $invite_id,
      ]
    );
  } elseif ($requester_side === 'Blancs') {
    $recipient_side = 'Noirs';
  } elseif ($requester_side === 'Noirs') {
    $recipient_side = 'Blancs';
  }

  db_query(
    'INSERT INTO matches
     (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
     VALUES
     (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)
     ON CONFLICT DO NOTHING',
    [
      'id' => $match_id,
      'user_id' => $requester_id,
      'mode' => 'JcJ',
      'opponent' => $recipient_name,
      'status' => 'waiting',
      'created_at' => $created_at,
      'last_move' => '-',
      'time_control' => $time_control,
      'side' => $requester_side,
      'difficulty' => null,
    ]
  );

  db_query(
    'INSERT INTO matches
     (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
     VALUES
     (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)
     ON CONFLICT DO NOTHING',
    [
      'id' => $match_id,
      'user_id' => $recipient_id,
      'mode' => 'JcJ',
      'opponent' => $requester_name,
      'status' => 'waiting',
      'created_at' => $created_at,
      'last_move' => '-',
      'time_control' => $time_control,
      'side' => $recipient_side,
      'difficulty' => null,
    ]
  );

  $white_id = $requester_side === 'Blancs' ? $requester_id : $recipient_id;
  $black_id = $requester_side === 'Blancs' ? $recipient_id : $requester_id;

  db_query(
    'INSERT INTO match_rooms
     (match_id, white_id, black_id, status, side_to_move, last_move, move_count)
     VALUES
     (:match_id, :white_id, :black_id, :status, :side_to_move, :last_move, :move_count)
     ON CONFLICT (match_id) DO NOTHING',
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

  return [
    'matchId' => $match_id,
    'requesterSide' => $requester_side,
    'recipientSide' => $recipient_side,
  ];
}
