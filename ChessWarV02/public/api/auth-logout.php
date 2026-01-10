<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';

handle_options();
require_method('POST');

$headers = request_headers();
$token = get_token_from_headers($headers);

if ($token) {
  db_query('DELETE FROM sessions WHERE token = :token', ['token' => $token]);
}

json_response(200, ['ok' => true]);
