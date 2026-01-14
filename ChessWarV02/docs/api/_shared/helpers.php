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
