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

$has_last_seen_at = column_exists('profiles', 'last_seen_at');

if (!table_exists('friend_requests')) {
  json_response(200, [
    'ok' => true,
    'friends' => [],
    'incoming' => [],
    'outgoing' => [],
  ]);
  exit;
}

$friends_rows = db_fetch_all(
  sprintf(
    'SELECT fr.id, fr.created_at, u.id AS user_id, u.display_name, p.name, p.title, p.rating, p.location, p.last_seen, %s
     FROM friend_requests fr
     JOIN users u
       ON u.id = CASE
         WHEN fr.requester_id = :user_id THEN fr.recipient_id
         ELSE fr.requester_id
       END
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE fr.status = :status
       AND (fr.requester_id = :user_id OR fr.recipient_id = :user_id)
     ORDER BY COALESCE(p.rating, 0) DESC, u.display_name ASC',
    $has_last_seen_at ? 'p.last_seen_at' : 'NULL AS last_seen_at'
  ),
  [
    'user_id' => $user_id,
    'status' => 'accepted',
  ]
);

$friends = array_map(function (array $row) use ($has_last_seen_at): array {
  $name = (string) ($row['name'] ?? '');
  if ($name === '') {
    $name = (string) ($row['display_name'] ?? '');
  }

  $is_online = $has_last_seen_at ? is_recent_timestamp($row['last_seen_at'] ?? null) : false;

  return [
    'id' => $row['user_id'],
    'name' => $name,
    'title' => $row['title'] ?? '',
    'rating' => isset($row['rating']) ? (int) $row['rating'] : 0,
    'location' => $row['location'] ?? '',
    'lastSeen' => $row['last_seen'] ?? '',
    'isOnline' => $is_online,
  ];
}, $friends_rows);

$incoming_rows = db_fetch_all(
  'SELECT fr.id, fr.created_at, u.id AS user_id, u.display_name, p.name, p.title, p.rating
   FROM friend_requests fr
   JOIN users u ON u.id = fr.requester_id
   LEFT JOIN profiles p ON p.user_id = u.id
   WHERE fr.status = :status
     AND fr.recipient_id = :user_id
   ORDER BY fr.created_at DESC',
  [
    'status' => 'pending',
    'user_id' => $user_id,
  ]
);

$incoming = array_map(static function (array $row): array {
  $name = (string) ($row['name'] ?? '');
  if ($name === '') {
    $name = (string) ($row['display_name'] ?? '');
  }

  return [
    'id' => $row['id'],
    'createdAt' => $row['created_at'],
    'user' => [
      'id' => $row['user_id'],
      'name' => $name,
      'title' => $row['title'] ?? '',
      'rating' => isset($row['rating']) ? (int) $row['rating'] : 0,
    ],
  ];
}, $incoming_rows);

$outgoing_rows = db_fetch_all(
  'SELECT fr.id, fr.created_at, u.id AS user_id, u.display_name, p.name, p.title, p.rating
   FROM friend_requests fr
   JOIN users u ON u.id = fr.recipient_id
   LEFT JOIN profiles p ON p.user_id = u.id
   WHERE fr.status = :status
     AND fr.requester_id = :user_id
   ORDER BY fr.created_at DESC',
  [
    'status' => 'pending',
    'user_id' => $user_id,
  ]
);

$outgoing = array_map(static function (array $row): array {
  $name = (string) ($row['name'] ?? '');
  if ($name === '') {
    $name = (string) ($row['display_name'] ?? '');
  }

  return [
    'id' => $row['id'],
    'createdAt' => $row['created_at'],
    'user' => [
      'id' => $row['user_id'],
      'name' => $name,
      'title' => $row['title'] ?? '',
      'rating' => isset($row['rating']) ? (int) $row['rating'] : 0,
    ],
  ];
}, $outgoing_rows);

json_response(200, [
  'ok' => true,
  'friends' => $friends,
  'incoming' => $incoming,
  'outgoing' => $outgoing,
]);
