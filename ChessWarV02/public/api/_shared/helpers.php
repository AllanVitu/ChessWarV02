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
