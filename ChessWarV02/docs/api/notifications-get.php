<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/invites.php';
require_once __DIR__ . '/_shared/notifications.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

expire_pending_invites();
$payload = fetch_notifications_payload($user_id);

json_response(200, [
  'ok' => true,
  'friendRequests' => $payload['friendRequests'],
  'matchInvites' => $payload['matchInvites'],
]);
