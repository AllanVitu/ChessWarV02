<?php

function api_request_id(): string
{
  static $request_id = null;
  if (is_string($request_id) && $request_id !== '') {
    return $request_id;
  }

  $incoming = trim((string) ($_SERVER['HTTP_X_REQUEST_ID'] ?? ''));
  if ($incoming !== '') {
    $request_id = substr($incoming, 0, 64);
    return $request_id;
  }

  $request_id = bin2hex(random_bytes(8));
  return $request_id;
}

function api_logger_enabled(): bool
{
  $raw = strtolower(trim((string) getenv('API_LOG_ENABLED')));
  if ($raw === '') {
    return true;
  }

  return !in_array($raw, ['0', 'false', 'off', 'no'], true);
}

function api_logger_path(): string
{
  $from_env = trim((string) getenv('API_LOG_FILE'));
  if ($from_env !== '') {
    return $from_env;
  }

  $tmp = rtrim((string) sys_get_temp_dir(), DIRECTORY_SEPARATOR);
  if ($tmp === '') {
    $tmp = __DIR__;
  }

  return $tmp . DIRECTORY_SEPARATOR . 'warchess-api.log';
}

function api_logger_context(): array
{
  $path = parse_url((string) ($_SERVER['REQUEST_URI'] ?? ''), PHP_URL_PATH);
  if (!is_string($path)) {
    $path = '';
  }

  return [
    'requestId' => api_request_id(),
    'method' => (string) ($_SERVER['REQUEST_METHOD'] ?? ''),
    'path' => $path,
    'ip' => (string) ($_SERVER['REMOTE_ADDR'] ?? ''),
    'userAgent' => (string) ($_SERVER['HTTP_USER_AGENT'] ?? ''),
  ];
}

function api_log(string $level, string $message, array $context = []): void
{
  if (!api_logger_enabled()) {
    return;
  }

  $entry = [
    'time' => gmdate('c'),
    'level' => strtolower($level),
    'message' => $message,
    'context' => array_merge(api_logger_context(), $context),
  ];

  $line = json_encode($entry, JSON_UNESCAPED_SLASHES);
  if (!is_string($line) || $line === '') {
    return;
  }

  error_log($line . PHP_EOL, 3, api_logger_path());
}
