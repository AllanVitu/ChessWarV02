<?php

function format_last_seen(): string
{
  $now = new DateTime('now');
  return "Aujourd'hui " . $now->format('H:i');
}
