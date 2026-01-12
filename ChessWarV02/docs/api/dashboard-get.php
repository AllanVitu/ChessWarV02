<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/seed.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$user = db_fetch_one(
  'SELECT id, email, display_name FROM users WHERE id = :id LIMIT 1',
  ['id' => $user_id]
);

if (!$user) {
  json_response(404, ['ok' => false, 'message' => 'Utilisateur introuvable.']);
  exit;
}

ensure_dashboard_seed($user['id'], $user['email'], $user['display_name'], format_last_seen());

$profile = db_fetch_one(
  'SELECT name, title, rating, motto, location, last_seen, email
   FROM profiles WHERE user_id = :user_id LIMIT 1',
  ['user_id' => $user['id']]
);

$games = db_fetch_all(
  'SELECT id, opponent, result, opening, date, moves, accuracy
   FROM games WHERE user_id = :user_id ORDER BY id DESC',
  ['user_id' => $user['id']]
);

$goals = db_fetch_all(
  'SELECT label, progress FROM goals WHERE user_id = :user_id ORDER BY id ASC',
  ['user_id' => $user['id']]
);

json_response(200, [
  'ok' => true,
  'dashboard' => [
    'profile' => [
      'id' => $user['id'],
      'name' => $profile['name'] ?? $user['display_name'],
      'title' => $profile['title'] ?? '',
      'rating' => $profile['rating'] ?? 0,
      'motto' => $profile['motto'] ?? '',
      'location' => $profile['location'] ?? '',
      'lastSeen' => $profile['last_seen'] ?? '',
      'email' => $profile['email'] ?? $user['email'],
    ],
    'games' => $games,
    'goals' => $goals,
  ],
]);
