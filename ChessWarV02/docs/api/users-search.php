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

$query = trim((string) ($_GET['q'] ?? ''));
if ($query === '' || strlen($query) < 2) {
  json_response(200, ['ok' => true, 'users' => []]);
  exit;
}

$needle = '%' . strtolower($query) . '%';

$has_last_seen_at = column_exists('profiles', 'last_seen_at');

$rows = db_fetch_all(
  sprintf(
    'SELECT u.id, u.display_name, p.name, p.title, p.rating, p.location, %s
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     WHERE u.id <> :user_id
       AND (LOWER(u.display_name) LIKE :needle OR LOWER(COALESCE(p.name, \'\')) LIKE :needle)
     ORDER BY COALESCE(p.rating, 0) DESC, u.display_name ASC
     LIMIT 8',
    $has_last_seen_at ? 'p.last_seen_at' : 'NULL AS last_seen_at'
  ),
  ['user_id' => $user_id, 'needle' => $needle]
);

$users = array_map(function (array $row) use ($has_last_seen_at): array {
  $name = (string) ($row['name'] ?? '');
  if ($name === '') {
    $name = (string) ($row['display_name'] ?? '');
  }

  $is_online = $has_last_seen_at ? is_recent_timestamp($row['last_seen_at'] ?? null) : false;

  return [
    'id' => $row['id'],
    'name' => $name,
    'title' => $row['title'] ?? '',
    'rating' => isset($row['rating']) ? (int) $row['rating'] : 0,
    'location' => $row['location'] ?? '',
    'isOnline' => $is_online,
  ];
}, $rows);

json_response(200, [
  'ok' => true,
  'users' => $users,
]);
