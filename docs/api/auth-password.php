<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/security.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

enforce_rate_limit('auth-password-user', 6, 300, 'user:' . $user_id);

$payload = request_json();
$current_password = (string) ($payload['currentPassword'] ?? '');
$next_password = (string) ($payload['nextPassword'] ?? '');

if ($current_password === '' || $next_password === '') {
  json_response(400, ['ok' => false, 'message' => 'Veuillez remplir tous les champs.']);
  exit;
}

$user = db_fetch_one(
  'SELECT password_hash, password_salt FROM users WHERE id = :id LIMIT 1',
  ['id' => $user_id]
);

if (!$user) {
  json_response(404, ['ok' => false, 'message' => 'Utilisateur introuvable.']);
  exit;
}

if (!verify_password($current_password, $user['password_salt'], $user['password_hash'])) {
  json_response(401, ['ok' => false, 'message' => 'Mot de passe actuel incorrect.']);
  exit;
}

$next_salt = random_hex(16);
$next_hash = hash_password($next_password, $next_salt);

db_query(
  'UPDATE users SET password_hash = :hash, password_salt = :salt WHERE id = :id',
  ['hash' => $next_hash, 'salt' => $next_salt, 'id' => $user_id]
);

json_response(200, ['ok' => true, 'message' => 'Mot de passe mis a jour.']);
