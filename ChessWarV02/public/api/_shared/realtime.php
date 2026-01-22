<?php

function realtime_config(): array
{
  $config = require __DIR__ . '/config.php';

  $notify_url = $config['realtime_notify_url'] ?? getenv('REALTIME_NOTIFY_URL') ?? '';
  $secret = $config['realtime_secret'] ?? getenv('REALTIME_SECRET') ?? '';

  return [
    'notify_url' => (string) $notify_url,
    'secret' => (string) $secret,
  ];
}

function notify_match_update(string $match_id, string $event = 'update'): void
{
  $settings = realtime_config();
  $url = $settings['notify_url'] ?? '';
  $secret = $settings['secret'] ?? '';

  if ($url === '') {
    return;
  }

  $payload = json_encode([
    'matchId' => $match_id,
    'event' => $event,
  ], JSON_UNESCAPED_SLASHES);

  if (!$payload) {
    return;
  }

  $headers = "Content-Type: application/json\r\n";
  if ($secret !== '') {
    $headers .= "X-Notify-Secret: " . $secret . "\r\n";
  }

  $context = stream_context_create([
    'http' => [
      'method' => 'POST',
      'header' => $headers,
      'content' => $payload,
      'timeout' => 1,
    ],
  ]);

  @file_get_contents($url, false, $context);
}
