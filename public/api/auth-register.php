<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/security.php';
require_once __DIR__ . '/_shared/seed.php';

handle_options();
require_method('POST');

$payload = request_json();
$email = strtolower(trim((string) ($payload['email'] ?? '')));
$password = (string) ($payload['password'] ?? '');
$display_name = trim((string) ($payload['displayName'] ?? ''));

if ($email === '' || $password === '' || $display_name === '') {
  json_response(400, ['ok' => false, 'message' => 'Veuillez remplir tous les champs.']);
  exit;
}

enforce_rate_limit('auth-register-ip', 8, 300);
enforce_rate_limit('auth-register-email', 3, 900, 'email:' . $email);

$existing = db_fetch_one(
  'SELECT id FROM users WHERE email = :email LIMIT 1',
  ['email' => $email]
);

if ($existing) {
  json_response(409, ['ok' => false, 'message' => 'Cet email est deja utilise.']);
  exit;
}

$salt = random_hex(16);
$password_hash = hash_password($password, $salt);
$user_id = generate_uuid();

$user = db_fetch_one(
  'INSERT INTO users (id, email, display_name, password_hash, password_salt)
   VALUES (:id, :email, :display_name, :password_hash, :password_salt)
   RETURNING id, email, display_name, created_at',
  [
    'id' => $user_id,
    'email' => $email,
    'display_name' => $display_name,
    'password_hash' => $password_hash,
    'password_salt' => $salt,
  ]
);

$token = generate_uuid();
db_query(
  'INSERT INTO sessions (token, user_id) VALUES (:token, :user_id)',
  ['token' => $token, 'user_id' => $user_id]
);

$last_seen = format_last_seen();
ensure_dashboard_seed($user_id, $email, $display_name, $last_seen);
ensure_matches_seed($user_id);

json_response(200, [
  'ok' => true,
  'message' => 'Compte cree avec succes.',
  'token' => $token,
  'user' => [
    'id' => $user['id'] ?? $user_id,
    'email' => $user['email'] ?? $email,
    'displayName' => $user['display_name'] ?? $display_name,
    'createdAt' => $user['created_at'] ?? null,
  ],
]);
