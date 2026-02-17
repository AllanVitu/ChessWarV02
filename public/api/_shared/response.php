<?php

require_once __DIR__ . '/logger.php';

function cors_origin(): ?string
{
  $origin = getenv('CORS_ORIGIN');
  return $origin ? $origin : null;
}

function send_cors_headers(): void
{
  $origin = cors_origin();
  if ($origin) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Request-Id');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Vary: Origin');
  }
  header('X-Request-Id: ' . api_request_id());
}

function json_response(int $status, array $body): void
{
  http_response_code($status);
  if (!headers_sent()) {
    header('Content-Type: application/json; charset=utf-8');
    send_cors_headers();
  }

  if (!array_key_exists('requestId', $body)) {
    $body['requestId'] = api_request_id();
  }

  $payload = json_encode($body, JSON_UNESCAPED_SLASHES);
  if ($payload === false) {
    $payload = sprintf(
      '{"ok":false,"message":"Erreur serveur.","requestId":"%s"}',
      api_request_id()
    );
  }

  echo $payload;

  if ($status >= 500) {
    api_log('error', 'API response', ['status' => $status]);
    return;
  }

  if ($status >= 400) {
    api_log('warn', 'API response', ['status' => $status]);
  }
}

function handle_options(): void
{
  if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    send_cors_headers();
    exit;
  }
}

function require_method(string $method): void
{
  if (($_SERVER['REQUEST_METHOD'] ?? '') !== $method) {
    json_response(405, ['ok' => false, 'message' => 'Methode non autorisee.']);
    exit;
  }
}

function request_json(): array
{
  $raw = file_get_contents('php://input');
  if (!$raw) {
    return [];
  }

  $data = json_decode($raw, true);
  if (is_array($data)) {
    return $data;
  }

  api_log('warn', 'Invalid JSON body', ['length' => strlen($raw)]);
  return [];
}

function api_handle_error(int $severity, string $message, string $file, int $line): bool
{
  if (!(error_reporting() & $severity)) {
    return false;
  }

  throw new ErrorException($message, 0, $severity, $file, $line);
}

function api_render_fatal_response(): void
{
  if (!headers_sent()) {
    json_response(500, ['ok' => false, 'message' => 'Erreur serveur.']);
    return;
  }

  echo sprintf(
    '{"ok":false,"message":"Erreur serveur.","requestId":"%s"}',
    api_request_id()
  );
}

function api_handle_uncaught_exception(Throwable $error): void
{
  api_log('error', 'Uncaught exception', [
    'type' => get_class($error),
    'message' => $error->getMessage(),
    'file' => $error->getFile(),
    'line' => $error->getLine(),
  ]);

  http_response_code(500);
  api_render_fatal_response();
  exit;
}

function api_handle_shutdown(): void
{
  $error = error_get_last();
  if (!$error) {
    return;
  }

  if (!in_array($error['type'], [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR], true)) {
    return;
  }

  api_log('error', 'Fatal shutdown', [
    'type' => $error['type'],
    'message' => (string) ($error['message'] ?? ''),
    'file' => (string) ($error['file'] ?? ''),
    'line' => (int) ($error['line'] ?? 0),
  ]);

  http_response_code(500);
  api_render_fatal_response();
}

function api_bootstrap_error_handling(): void
{
  static $booted = false;
  if ($booted) {
    return;
  }

  $booted = true;
  set_error_handler('api_handle_error');
  set_exception_handler('api_handle_uncaught_exception');
  register_shutdown_function('api_handle_shutdown');
}

api_bootstrap_error_handling();
