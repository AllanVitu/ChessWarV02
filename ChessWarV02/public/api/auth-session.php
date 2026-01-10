<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$user = db_fetch_one(
  'SELECT id, email, display_name, created_at FROM users WHERE id = :id LIMIT 1',
  ['id' => $user_id]
);

if (!$user) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

json_response(200, [
  'ok' => true,
  'user' => [
    'id' => $user['id'],
    'email' => $user['email'],
    'displayName' => $user['display_name'],
    'createdAt' => $user['created_at'],
  ],
]);
