<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/invites.php';

handle_options();
require_method('POST');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$payload = request_json();
$type = strtolower(trim((string) ($payload['type'] ?? 'all')));

$mark_friends = in_array($type, ['friend', 'friends', 'all'], true);
$mark_matches = in_array($type, ['match', 'matches', 'all'], true);
$mark_ready = in_array($type, ['match-ready', 'matchready', 'ready', 'match-accepted', 'accepted'], true);

if ($mark_friends && table_exists('friend_requests')) {
  db_query(
    'UPDATE friend_requests
     SET recipient_seen_at = now()
     WHERE recipient_id = :user_id
       AND status = :status
       AND recipient_seen_at IS NULL',
    [
      'user_id' => $user_id,
      'status' => 'pending',
    ]
  );
}

if ($mark_matches && table_exists('match_invites')) {
  expire_pending_invites();
  db_query(
    'UPDATE match_invites
     SET recipient_seen_at = now()
     WHERE recipient_id = :user_id
       AND status = :status
       AND (expires_at IS NULL OR expires_at > now())
       AND recipient_seen_at IS NULL',
    [
      'user_id' => $user_id,
      'status' => 'pending',
    ]
  );
}

if ($mark_ready && table_exists('match_invites') && column_exists('match_invites', 'requester_seen_at')) {
  db_query(
    'UPDATE match_invites
     SET requester_seen_at = now()
     WHERE requester_id = :user_id
       AND status = :status
       AND requester_seen_at IS NULL',
    [
      'user_id' => $user_id,
      'status' => 'accepted',
    ]
  );
}

json_response(200, [
  'ok' => true,
  'message' => 'Notifications lues.',
]);
