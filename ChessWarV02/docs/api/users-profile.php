<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/friends.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$target_id = trim((string) ($_GET['id'] ?? ''));
if ($target_id === '') {
  json_response(400, ['ok' => false, 'message' => 'Identifiant manquant.']);
  exit;
}

if (!is_valid_uuid($target_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

$profile = db_fetch_one(
  'SELECT u.id, u.display_name, p.name, p.title, p.rating, p.motto, p.location, p.last_seen
   FROM users u
   LEFT JOIN profiles p ON p.user_id = u.id
   WHERE u.id = :id
   LIMIT 1',
  ['id' => $target_id]
);

if (!$profile) {
  json_response(404, ['ok' => false, 'message' => 'Utilisateur introuvable.']);
  exit;
}

$name = (string) ($profile['name'] ?? '');
if ($name === '') {
  $name = (string) ($profile['display_name'] ?? '');
}

$status = friend_status($user_id, $target_id);

json_response(200, [
  'ok' => true,
  'profile' => [
    'id' => $profile['id'],
    'name' => $name,
    'title' => $profile['title'] ?? '',
    'rating' => isset($profile['rating']) ? (int) $profile['rating'] : 0,
    'motto' => $profile['motto'] ?? '',
    'location' => $profile['location'] ?? '',
    'lastSeen' => $profile['last_seen'] ?? '',
  ],
  'friendStatus' => $status,
]);
