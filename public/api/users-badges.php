<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$target_id = trim((string) ($_GET['id'] ?? ''));
if ($target_id === '') {
  json_response(400, ['ok' => false, 'message' => 'Identifiant manquant.']);
  exit;
}

if (!is_valid_uuid($target_id)) {
  json_response(400, ['ok' => false, 'message' => 'Identifiant invalide.']);
  exit;
}

$win_streak = 0;
$games_checked = 0;
if (table_exists('games')) {
  $rows = db_fetch_all(
    'SELECT result
     FROM games
     WHERE user_id = :user_id
     ORDER BY id DESC
     LIMIT 8',
    ['user_id' => $target_id]
  );

  foreach ($rows as $row) {
    $games_checked += 1;
    if (($row['result'] ?? '') === 'win') {
      $win_streak += 1;
    } else {
      break;
    }
  }
}

$jcc_count = 0;
$finished_count = 0;
$abandon_count = 0;
if (table_exists('matches')) {
  $stats = db_fetch_one(
    'SELECT
        SUM(CASE WHEN mode = :mode THEN 1 ELSE 0 END) AS jcc_count,
        SUM(CASE WHEN status = :status THEN 1 ELSE 0 END) AS finished_count,
        SUM(CASE WHEN status = :status AND LOWER(last_move) LIKE :abandon THEN 1 ELSE 0 END) AS abandon_count
     FROM matches
     WHERE user_id = :user_id',
    [
      'user_id' => $target_id,
      'mode' => 'JcJ',
      'status' => 'termine',
      'abandon' => '%abandon%',
    ]
  );

  $jcc_count = (int) ($stats['jcc_count'] ?? 0);
  $finished_count = (int) ($stats['finished_count'] ?? 0);
  $abandon_count = (int) ($stats['abandon_count'] ?? 0);
}

$streak_target = 3;
$tournament_target = 3;
$fair_play_earned = $finished_count > 0 && $abandon_count === 0;

$badges = [
  [
    'key' => 'streak',
    'label' => 'Serie',
    'description' => 'Enchainez 3 victoires de suite.',
    'value' => $games_checked === 0 ? 'Aucune partie' : $win_streak . ' victoires',
    'earned' => $win_streak >= $streak_target,
  ],
  [
    'key' => 'tournament',
    'label' => 'Tournois',
    'description' => 'Jouez au moins 3 matchs JcJ.',
    'value' => $jcc_count . ' matchs JcJ',
    'earned' => $jcc_count >= $tournament_target,
  ],
  [
    'key' => 'fairplay',
    'label' => 'Fair-play',
    'description' => 'Terminez vos matchs sans abandon.',
    'value' => $finished_count === 0 ? 'Aucun match termine' : $abandon_count . ' abandon',
    'earned' => $fair_play_earned,
  ],
];

json_response(200, [
  'ok' => true,
  'badges' => $badges,
]);
