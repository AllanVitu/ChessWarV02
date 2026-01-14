<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/helpers.php';

function expire_pending_invites(): void
{
  if (!table_exists('match_invites')) {
    return;
  }

  db_query(
    'UPDATE match_invites
     SET expires_at = now() + interval \'24 hours\'
     WHERE status = :pending
       AND expires_at IS NULL',
    [
      'pending' => 'pending',
    ]
  );

  db_query(
    'UPDATE match_invites
     SET status = :status,
         responded_at = now()
    WHERE status = :pending
      AND expires_at IS NOT NULL
      AND expires_at <= now()',
    [
      'status' => 'expired',
      'pending' => 'pending',
    ]
  );
}
