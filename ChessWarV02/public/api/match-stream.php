<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/match.php';

handle_options();

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'GET') {
  http_response_code(405);
  exit;
}

if (!match_tables_available()) {
  http_response_code(503);
  exit;
}

$token = trim((string) ($_GET['token'] ?? ''));
$match_id = trim((string) ($_GET['matchId'] ?? ''));

if ($token === '' || $match_id === '') {
  http_response_code(401);
  exit;
}

if (!is_valid_uuid($match_id)) {
  http_response_code(400);
  exit;
}

$session = db_fetch_one(
  'SELECT user_id FROM sessions WHERE token = :token LIMIT 1',
  ['token' => $token]
);

$user_id = $session['user_id'] ?? null;
if (!$user_id) {
  http_response_code(401);
  exit;
}

$room = fetch_match_room($match_id);
if (!$room || !is_match_player($user_id, $room)) {
  http_response_code(403);
  exit;
}

send_cors_headers();
header('Content-Type: text/event-stream');
header('Cache-Control: no-cache');
header('Connection: keep-alive');
header('X-Accel-Buffering: no');

ini_set('output_buffering', 'off');
ini_set('zlib.output_compression', '0');
while (ob_get_level() > 0) {
  ob_end_flush();
}
ob_implicit_flush(true);

echo "retry: 5000\n\n";
flush();

$last_payload = '';
$last_ping = time();
$started_at = time();
$last_seen_touch = $started_at;

while (time() - $started_at < 25) {
  if (connection_aborted()) {
    break;
  }

  $room = fetch_match_room($match_id);
  if (!$room) {
    break;
  }

  $payload = build_match_payload($user_id, $room);
  $json = json_encode($payload, JSON_UNESCAPED_SLASHES);

  if ($json !== $last_payload) {
    echo "event: match\n";
    echo 'data: ' . $json . "\n\n";
    $last_payload = $json;
    flush();
  }

  if (time() - $last_ping >= 10) {
    echo ": ping\n\n";
    $last_ping = time();
    flush();
  }

  if (time() - $last_seen_touch >= 10) {
    touch_last_seen($user_id);
    $last_seen_touch = time();
  }

  usleep(2000000);
}
