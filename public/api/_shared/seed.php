<?php

require_once __DIR__ . '/db.php';
require_once __DIR__ . '/defaults.php';
require_once __DIR__ . '/helpers.php';

function ensure_dashboard_seed(string $user_id, string $email, string $display_name, string $last_seen): void
{
  global $default_profile, $default_games, $default_goals;

  $profile = db_fetch_one(
    'SELECT user_id FROM profiles WHERE user_id = :user_id LIMIT 1',
    ['user_id' => $user_id]
  );

  if (!$profile) {
    $columns = 'user_id, name, title, rating, motto, location, last_seen, email';
    $values = ':user_id, :name, :title, :rating, :motto, :location, :last_seen, :email';
    $params = [
      'user_id' => $user_id,
      'name' => $display_name,
      'title' => $default_profile['title'],
      'rating' => $default_profile['rating'],
      'motto' => $default_profile['motto'],
      'location' => $default_profile['location'],
      'last_seen' => $last_seen,
      'email' => $email,
    ];

    if (column_exists('profiles', 'last_seen_at')) {
      $columns .= ', last_seen_at';
      $values .= ', :last_seen_at';
      $params['last_seen_at'] = (new DateTime('now'))->format('c');
    }

    db_query(
      sprintf('INSERT INTO profiles (%s) VALUES (%s)', $columns, $values),
      $params
    );
  }

  $games_count = (int) (db_fetch_value(
    'SELECT COUNT(*) FROM games WHERE user_id = :user_id',
    ['user_id' => $user_id]
  ) ?? 0);

  if ($games_count === 0) {
    foreach ($default_games as $game) {
      db_query(
        'INSERT INTO games (id, user_id, opponent, result, opening, date, moves, accuracy)
         VALUES (:id, :user_id, :opponent, :result, :opening, :date, :moves, :accuracy)',
        [
          'id' => $game['id'],
          'user_id' => $user_id,
          'opponent' => $game['opponent'],
          'result' => $game['result'],
          'opening' => $game['opening'],
          'date' => $game['date'],
          'moves' => $game['moves'],
          'accuracy' => $game['accuracy'],
        ]
      );
    }
  }

  $goals_count = (int) (db_fetch_value(
    'SELECT COUNT(*) FROM goals WHERE user_id = :user_id',
    ['user_id' => $user_id]
  ) ?? 0);

  if ($goals_count === 0) {
    foreach ($default_goals as $goal) {
      db_query(
        'INSERT INTO goals (user_id, label, progress)
         VALUES (:user_id, :label, :progress)',
        [
          'user_id' => $user_id,
          'label' => $goal['label'],
          'progress' => $goal['progress'],
        ]
      );
    }
  }
}

function ensure_matches_seed(string $user_id): void
{
  global $default_matches;

  $matches_count = (int) (db_fetch_value(
    'SELECT COUNT(*) FROM matches WHERE user_id = :user_id',
    ['user_id' => $user_id]
  ) ?? 0);

  if ($matches_count === 0) {
    foreach ($default_matches as $match) {
      db_query(
        'INSERT INTO matches (id, user_id, mode, opponent, status, created_at, last_move, time_control, side, difficulty)
         VALUES (:id, :user_id, :mode, :opponent, :status, :created_at, :last_move, :time_control, :side, :difficulty)',
        [
          'id' => $match['id'],
          'user_id' => $user_id,
          'mode' => $match['mode'],
          'opponent' => $match['opponent'],
          'status' => $match['status'],
          'created_at' => $match['createdAt'],
          'last_move' => $match['lastMove'],
          'time_control' => $match['timeControl'],
          'side' => $match['side'],
          'difficulty' => $match['difficulty'] ?? null,
        ]
      );
    }
  }
}
