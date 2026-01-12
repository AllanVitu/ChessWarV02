<?php

require_once __DIR__ . '/db.php';

function request_headers(): array
{
  $headers = [];

  if (function_exists('getallheaders')) {
    foreach (getallheaders() as $key => $value) {
      $headers[strtolower($key)] = $value;
    }
  }

  foreach ($_SERVER as $key => $value) {
    if (strpos($key, 'HTTP_') === 0) {
      $name = strtolower(str_replace('_', '-', substr($key, 5)));
      if (!isset($headers[$name])) {
        $headers[$name] = $value;
      }
    }
  }

  if (isset($_SERVER['REDIRECT_HTTP_AUTHORIZATION'])) {
    $headers['authorization'] = $_SERVER['REDIRECT_HTTP_AUTHORIZATION'];
  } elseif (isset($_SERVER['HTTP_AUTHORIZATION'])) {
    $headers['authorization'] = $_SERVER['HTTP_AUTHORIZATION'];
  }

  return $headers;
}

function get_token_from_headers(array $headers): ?string
{
  $auth = $headers['authorization'] ?? null;
  if (!$auth) {
    return null;
  }

  if (stripos($auth, 'Bearer ') === 0) {
    return substr($auth, 7);
  }

  return $auth;
}

function require_user_id(): ?string
{
  $headers = request_headers();
  $token = get_token_from_headers($headers);
  if (!$token) {
    return null;
  }

  $session = db_fetch_one(
    'SELECT user_id FROM sessions WHERE token = :token LIMIT 1',
    ['token' => $token]
  );

  return $session['user_id'] ?? null;
}
