<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$payload = request_json();
$profile = is_array($payload['profile'] ?? null) ? $payload['profile'] : [];

$name = (string) ($profile['name'] ?? '');
$title = (string) ($profile['title'] ?? '');
$motto = (string) ($profile['motto'] ?? '');
$location = (string) ($profile['location'] ?? '');

db_query(
  'UPDATE profiles
   SET name = :name, title = :title, motto = :motto, location = :location
   WHERE user_id = :user_id',
  [
    'name' => $name,
    'title' => $title,
    'motto' => $motto,
    'location' => $location,
    'user_id' => $user_id,
  ]
);

db_query(
  'UPDATE users SET display_name = :name WHERE id = :user_id',
  ['name' => $name, 'user_id' => $user_id]
);

$profile_row = db_fetch_one(
  'SELECT name, title, rating, motto, location, last_seen, email
   FROM profiles WHERE user_id = :user_id LIMIT 1',
  ['user_id' => $user_id]
);

$games = db_fetch_all(
  'SELECT id, opponent, result, opening, date, moves, accuracy
   FROM games WHERE user_id = :user_id ORDER BY id DESC',
  ['user_id' => $user_id]
);

$goals = db_fetch_all(
  'SELECT label, progress FROM goals WHERE user_id = :user_id ORDER BY id ASC',
  ['user_id' => $user_id]
);

json_response(200, [
  'ok' => true,
  'dashboard' => [
    'profile' => [
      'id' => $user_id,
      'name' => $profile_row['name'] ?? $name,
      'title' => $profile_row['title'] ?? '',
      'rating' => $profile_row['rating'] ?? 0,
      'motto' => $profile_row['motto'] ?? '',
      'location' => $profile_row['location'] ?? '',
      'lastSeen' => $profile_row['last_seen'] ?? '',
      'email' => $profile_row['email'] ?? '',
    ],
    'games' => $games,
    'goals' => $goals,
  ],
]);
