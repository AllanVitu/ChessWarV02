<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/security.php';
require_once __DIR__ . '/_shared/seed.php';

handle_options();
require_method('POST');

$payload = request_json();
$email = strtolower(trim((string) ($payload['email'] ?? '')));
$password = (string) ($payload['password'] ?? '');

if ($email === '' || $password === '') {
  json_response(400, ['ok' => false, 'message' => 'Veuillez remplir tous les champs.']);
  exit;
}

enforce_rate_limit('auth-login-ip', 20, 60);
enforce_rate_limit('auth-login-email', 8, 300, 'email:' . $email);

$user = db_fetch_one(
  'SELECT id, email, display_name, password_hash, password_salt, created_at
   FROM users
   WHERE email = :email
   LIMIT 1',
  ['email' => $email]
);

if (!$user || !verify_password($password, $user['password_salt'], $user['password_hash'])) {
  json_response(401, ['ok' => false, 'message' => 'Identifiants invalides.']);
  exit;
}

$token = generate_uuid();

db_query(
  'INSERT INTO sessions (token, user_id) VALUES (:token, :user_id)',
  ['token' => $token, 'user_id' => $user['id']]
);

$last_seen = format_last_seen();
ensure_dashboard_seed($user['id'], $user['email'], $user['display_name'], $last_seen);
ensure_matches_seed($user['id']);

db_query(
  column_exists('profiles', 'last_seen_at')
    ? 'UPDATE profiles SET last_seen = :last_seen, last_seen_at = now() WHERE user_id = :user_id'
    : 'UPDATE profiles SET last_seen = :last_seen WHERE user_id = :user_id',
  [
    'last_seen' => $last_seen,
    'user_id' => $user['id'],
  ]
);

json_response(200, [
  'ok' => true,
  'message' => 'Connexion reussie.',
  'token' => $token,
  'user' => [
    'id' => $user['id'],
    'email' => $user['email'],
    'displayName' => $user['display_name'],
    'createdAt' => $user['created_at'],
  ],
]);
