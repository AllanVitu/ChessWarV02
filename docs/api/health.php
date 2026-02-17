<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/match.php';

handle_options();
require_method('GET');

$checks = [
  'api' => ['ok' => true],
  'db' => ['ok' => false],
  'schema' => ['ok' => false],
];

try {
  $db_probe = db_fetch_value('SELECT 1');
  $checks['db']['ok'] = ((int) $db_probe) === 1;
} catch (Throwable $error) {
  $checks['db']['ok'] = false;
  $checks['db']['message'] = 'Database unavailable.';
}

$required_tables = ['users', 'sessions', 'profiles', 'matches', 'match_rooms', 'match_moves'];
$missing_tables = [];
foreach ($required_tables as $table) {
  if (!table_exists($table)) {
    $missing_tables[] = $table;
  }
}

$checks['schema']['ok'] = count($missing_tables) === 0;
if ($missing_tables) {
  $checks['schema']['missingTables'] = $missing_tables;
}

$checks['matchmaking'] = [
  'ok' => match_queue_available(),
];

$ok = true;
foreach ($checks as $check) {
  if (($check['ok'] ?? false) !== true) {
    $ok = false;
    break;
  }
}

json_response($ok ? 200 : 503, [
  'ok' => $ok,
  'status' => $ok ? 'ok' : 'degraded',
  'time' => gmdate('c'),
  'checks' => $checks,
]);
