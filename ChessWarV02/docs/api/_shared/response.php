<?php

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
    header('Access-Control-Allow-Headers: Content-Type, Authorization');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
  }
}

function json_response(int $status, array $body): void
{
  http_response_code($status);
  header('Content-Type: application/json');
  send_cors_headers();
  echo json_encode($body);
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
  return is_array($data) ? $data : [];
}
