<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function friend_requests_available(): bool
{
  static $available = null;

  if (is_bool($available)) {
    return $available;
  }

  try {
    $available = table_exists('friend_requests');
  } catch (Exception $error) {
    $available = false;
  }

  return $available;
}

function are_friends(string $user_id, string $target_id): bool
{
  if ($user_id === $target_id) {
    return false;
  }

  if (!friend_requests_available()) {
    return false;
  }

  $row = db_fetch_one(
    'SELECT id
     FROM friend_requests
     WHERE status = :status
       AND ((requester_id = :user_id AND recipient_id = :target_id)
         OR (requester_id = :target_id AND recipient_id = :user_id))
     LIMIT 1',
    [
      'status' => 'accepted',
      'user_id' => $user_id,
      'target_id' => $target_id,
    ]
  );

  return $row !== null;
}

function friend_status(string $current_id, string $target_id): string
{
  if ($current_id === $target_id) {
    return 'self';
  }

  if (!friend_requests_available()) {
    return 'none';
  }

  $row = db_fetch_one(
    'SELECT requester_id, recipient_id, status
     FROM friend_requests
     WHERE (requester_id = :current_id AND recipient_id = :target_id)
        OR (requester_id = :target_id AND recipient_id = :current_id)
     LIMIT 1',
    ['current_id' => $current_id, 'target_id' => $target_id]
  );

  if (!$row) {
    return 'none';
  }

  if (($row['status'] ?? '') === 'accepted') {
    return 'friends';
  }

  if (($row['status'] ?? '') === 'pending') {
    return ($row['requester_id'] ?? '') === $current_id ? 'outgoing' : 'incoming';
  }

  return 'none';
}
