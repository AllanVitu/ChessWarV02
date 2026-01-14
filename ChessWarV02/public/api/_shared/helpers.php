<?php

function format_last_seen(): string
{
  $now = new DateTime('now');
  return "Aujourd'hui " . $now->format('H:i');
}

function is_valid_uuid(string $value): bool
{
  return (bool) preg_match(
    '/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i',
    $value
  );
}

function table_exists(string $table_name): bool
{
  $row = db_fetch_one(
    'SELECT table_name
     FROM information_schema.tables
     WHERE table_name = :table
       AND table_schema NOT IN (:system_schema, :info_schema)
     LIMIT 1',
    [
      'table' => $table_name,
      'system_schema' => 'pg_catalog',
      'info_schema' => 'information_schema',
    ]
  );

  return $row !== null;
}

function column_exists(string $table_name, string $column_name): bool
{
  $row = db_fetch_one(
    'SELECT column_name
     FROM information_schema.columns
     WHERE table_name = :table
       AND column_name = :column
       AND table_schema NOT IN (:system_schema, :info_schema)
     LIMIT 1',
    [
      'table' => $table_name,
      'column' => $column_name,
      'system_schema' => 'pg_catalog',
      'info_schema' => 'information_schema',
    ]
  );

  return $row !== null;
}

function is_recent_timestamp(?string $value, int $minutes = 10): bool
{
  if (!$value) {
    return false;
  }

  try {
    $time = new DateTime($value);
  } catch (Throwable $error) {
    return false;
  }

  $now = new DateTime('now');
  $diff = $now->getTimestamp() - $time->getTimestamp();
  return $diff >= 0 && $diff <= ($minutes * 60);
}

function touch_last_seen(string $user_id): void
{
  if (!table_exists('profiles')) {
    return;
  }

  $last_seen = format_last_seen();
  if (column_exists('profiles', 'last_seen_at')) {
    db_query(
      'UPDATE profiles
       SET last_seen = :last_seen,
           last_seen_at = now()
       WHERE user_id = :user_id
         AND (last_seen_at IS NULL OR last_seen_at < now() - interval \'2 minutes\')',
      [
        'last_seen' => $last_seen,
        'user_id' => $user_id,
      ]
    );
    return;
  }

  db_query(
    'UPDATE profiles
     SET last_seen = :last_seen
     WHERE user_id = :user_id',
    [
      'last_seen' => $last_seen,
      'user_id' => $user_id,
    ]
  );
}
