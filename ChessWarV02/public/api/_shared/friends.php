<?php

require_once __DIR__ . '/db.php';

function friend_status(string $current_id, string $target_id): string
{
  if ($current_id === $target_id) {
    return 'self';
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
