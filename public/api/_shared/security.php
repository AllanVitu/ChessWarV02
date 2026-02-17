<?php

function random_hex(int $bytes): string
{
  return bin2hex(random_bytes($bytes));
}

function generate_uuid(): string
{
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  $hex = bin2hex($data);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split($hex, 4));
}

function hash_password(string $password, string $salt): string
{
  $hash = hash_pbkdf2('sha256', $password, $salt, 120000, 32, true);
  return bin2hex($hash);
}

function verify_password(string $password, string $salt, string $expected): bool
{
  $computed = hash_password($password, $salt);
  return hash_equals($expected, $computed);
}

function api_client_ip(): string
{
  $forwarded = trim((string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? ''));
  if ($forwarded !== '') {
    $parts = explode(',', $forwarded);
    $ip = trim((string) ($parts[0] ?? ''));
    if ($ip !== '') {
      return $ip;
    }
  }

  $real_ip = trim((string) ($_SERVER['HTTP_X_REAL_IP'] ?? ''));
  if ($real_ip !== '') {
    return $real_ip;
  }

  return trim((string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown'));
}

function api_rate_limit_enabled(): bool
{
  $raw = strtolower(trim((string) getenv('API_RATE_LIMIT_ENABLED')));
  if ($raw === '') {
    return true;
  }
  return !in_array($raw, ['0', 'false', 'off', 'no'], true);
}

function api_rate_limit_dir(): string
{
  $dir = trim((string) getenv('API_RATE_LIMIT_DIR'));
  if ($dir === '') {
    $tmp = rtrim((string) sys_get_temp_dir(), DIRECTORY_SEPARATOR);
    if ($tmp === '') {
      $tmp = __DIR__;
    }
    $dir = $tmp . DIRECTORY_SEPARATOR . 'warchess-rate-limit';
  }

  if (!is_dir($dir)) {
    @mkdir($dir, 0775, true);
  }

  return $dir;
}

function api_rate_limit_identity(?string $identity = null): string
{
  $resolved = trim((string) $identity);
  if ($resolved !== '') {
    return $resolved;
  }

  $session_token = trim((string) ($_SERVER['HTTP_AUTHORIZATION'] ?? ''));
  if ($session_token !== '') {
    return 'token:' . hash('sha256', $session_token);
  }

  return 'ip:' . api_client_ip();
}

function api_rate_limit_file(string $namespace, string $identity): string
{
  $safe = preg_replace('/[^a-z0-9._-]/i', '_', strtolower($namespace));
  $hash = hash('sha256', $identity);
  return api_rate_limit_dir() . DIRECTORY_SEPARATOR . $safe . '-' . $hash . '.json';
}

function api_consume_rate_limit(
  string $namespace,
  int $max_attempts,
  int $window_seconds,
  ?string $identity = null
): array {
  if (!api_rate_limit_enabled()) {
    return ['ok' => true, 'remaining' => $max_attempts, 'retryAfter' => 0];
  }

  $resolved_identity = api_rate_limit_identity($identity);
  $file = api_rate_limit_file($namespace, $resolved_identity);
  $now = time();

  $handle = fopen($file, 'c+');
  if (!is_resource($handle)) {
    return ['ok' => true, 'remaining' => $max_attempts, 'retryAfter' => 0];
  }

  try {
    if (!flock($handle, LOCK_EX)) {
      fclose($handle);
      return ['ok' => true, 'remaining' => $max_attempts, 'retryAfter' => 0];
    }

    $raw = stream_get_contents($handle);
    $state = is_string($raw) && $raw !== '' ? json_decode($raw, true) : [];
    if (!is_array($state)) {
      $state = [];
    }

    $window_start = isset($state['windowStart']) ? (int) $state['windowStart'] : 0;
    $count = isset($state['count']) ? (int) $state['count'] : 0;

    if ($window_start <= 0 || ($now - $window_start) >= $window_seconds) {
      $window_start = $now;
      $count = 0;
    }

    $count += 1;
    $remaining = $max_attempts - $count;
    $retry_after = max(0, $window_seconds - ($now - $window_start));
    $allowed = $count <= $max_attempts;

    $next_state = [
      'windowStart' => $window_start,
      'count' => $count,
    ];

    rewind($handle);
    ftruncate($handle, 0);
    fwrite($handle, json_encode($next_state));
    fflush($handle);
    flock($handle, LOCK_UN);

    fclose($handle);

    return [
      'ok' => $allowed,
      'remaining' => max(0, $remaining),
      'retryAfter' => $retry_after,
    ];
  } catch (Throwable $error) {
    if (is_resource($handle)) {
      fclose($handle);
    }
    return ['ok' => true, 'remaining' => $max_attempts, 'retryAfter' => 0];
  }
}

function enforce_rate_limit(
  string $namespace,
  int $max_attempts,
  int $window_seconds,
  ?string $identity = null,
  string $message = 'Trop de requetes. Reessayez dans un instant.'
): void {
  $result = api_consume_rate_limit($namespace, $max_attempts, $window_seconds, $identity);
  if (($result['ok'] ?? true) === true) {
    return;
  }

  $retry_after = (int) ($result['retryAfter'] ?? 0);
  if ($retry_after > 0) {
    header('Retry-After: ' . $retry_after);
  }

  if (function_exists('json_response')) {
    json_response(429, ['ok' => false, 'message' => $message]);
    exit;
  }

  http_response_code(429);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode([
    'ok' => false,
    'message' => $message,
  ]);
  exit;
}
