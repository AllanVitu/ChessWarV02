<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$friend_requests = [];
if (table_exists('friend_requests')) {
  $rows = db_fetch_all(
    'SELECT fr.id, u.id AS user_id, u.display_name, p.name, p.title, p.rating
     FROM friend_requests fr
     JOIN users u ON u.id = fr.requester_id
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE fr.recipient_id = :user_id
       AND fr.status = :status
     ORDER BY fr.created_at DESC
     LIMIT 8',
    [
      'user_id' => $user_id,
      'status' => 'pending',
    ]
  );

  foreach ($rows as $row) {
    $name = (string) ($row['name'] ?? '');
    if ($name === '') {
      $name = (string) ($row['display_name'] ?? '');
    }

    $friend_requests[] = [
      'id' => $row['id'],
      'user' => [
        'id' => $row['user_id'],
        'name' => $name,
        'title' => $row['title'] ?? '',
        'rating' => isset($row['rating']) ? (int) $row['rating'] : 0,
      ],
    ];
  }
}

$match_invites = [];
if (table_exists('match_invites')) {
  $rows = db_fetch_all(
    'SELECT mi.id, mi.match_id, mi.time_control, mi.created_at,
            u.id AS user_id, u.display_name, p.name, p.title, p.rating
     FROM match_invites mi
     JOIN users u ON u.id = mi.requester_id
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE mi.recipient_id = :user_id
       AND mi.status = :status
     ORDER BY mi.created_at DESC
     LIMIT 8',
    [
      'user_id' => $user_id,
      'status' => 'pending',
    ]
  );

  foreach ($rows as $row) {
    $name = (string) ($row['name'] ?? '');
    if ($name === '') {
      $name = (string) ($row['display_name'] ?? '');
    }

    $match_invites[] = [
      'id' => $row['id'],
      'matchId' => $row['match_id'],
      'timeControl' => $row['time_control'],
      'createdAt' => $row['created_at'],
      'from' => [
        'id' => $row['user_id'],
        'name' => $name,
        'title' => $row['title'] ?? '',
        'rating' => isset($row['rating']) ? (int) $row['rating'] : 0,
      ],
    ];
  }
}

json_response(200, [
  'ok' => true,
  'friendRequests' => $friend_requests,
  'matchInvites' => $match_invites,
]);
