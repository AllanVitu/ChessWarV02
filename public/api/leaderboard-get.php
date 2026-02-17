<?php

require_once __DIR__ . '/_shared/response.php';
require_once __DIR__ . '/_shared/db.php';
require_once __DIR__ . '/_shared/auth.php';
require_once __DIR__ . '/_shared/helpers.php';
require_once __DIR__ . '/_shared/friends.php';

function leaderboard_match_time_expr(): string
{
  if (column_exists('matches', 'finished_at')) {
    return 'm.finished_at';
  }

  return "CASE
    WHEN m.created_at ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN to_timestamp(m.created_at, 'YYYY-MM-DD HH24:MI')
    ELSE NULL
  END";
}

function leaderboard_stats_available(): bool
{
  return table_exists('matches') && column_exists('matches', 'elo_delta');
}

handle_options();
require_method('GET');

$user_id = require_user_id();
if (!$user_id) {
  json_response(401, ['ok' => false, 'message' => 'Session invalide.']);
  exit;
}

$scope = strtolower(trim((string) ($_GET['scope'] ?? 'global')));
if (!in_array($scope, ['global', 'monthly', 'friends'], true)) {
  json_response(400, ['ok' => false, 'message' => 'Scope invalide.']);
  exit;
}

$page = (int) ($_GET['page'] ?? 1);
$page_size = (int) ($_GET['pageSize'] ?? 20);
if ($page < 1) {
  $page = 1;
}
if ($page_size < 1) {
  $page_size = 20;
}
if ($page_size > 100) {
  $page_size = 100;
}
$offset = ($page - 1) * $page_size;

$where_clauses = [];
$params = [
  'limit' => $page_size,
  'offset' => $offset,
];

$stats_join = '';
$rating_order_tie = '0';
$monthly_score_select = '0';
$rolling_delta_select = '0';
$monthly_games_select = '0';

if (leaderboard_stats_available()) {
  $match_time = leaderboard_match_time_expr();
  $stats_join = sprintf(
    "LEFT JOIN (
      SELECT
        m.user_id,
        COALESCE(SUM(
          CASE WHEN (%s) >= date_trunc('month', now()) THEN m.elo_delta ELSE 0 END
        ), 0) AS monthly_delta,
        COALESCE(SUM(
          CASE WHEN (%s) >= now() - interval '30 days' THEN m.elo_delta ELSE 0 END
        ), 0) AS rolling_delta,
        COALESCE(SUM(
          CASE WHEN (%s) >= date_trunc('month', now()) THEN 1 ELSE 0 END
        ), 0) AS monthly_games
      FROM matches m
      GROUP BY m.user_id
    ) ms ON ms.user_id = u.id",
    $match_time,
    $match_time,
    $match_time
  );
  $rating_order_tie = 'COALESCE(ms.monthly_delta, 0)';
  $monthly_score_select = 'COALESCE(ms.monthly_delta, 0)';
  $rolling_delta_select = 'COALESCE(ms.rolling_delta, 0)';
  $monthly_games_select = 'COALESCE(ms.monthly_games, 0)';
}

if ($scope === 'friends') {
  $ids = [$user_id];
  if (friend_requests_available()) {
    $rows = db_fetch_all(
      'SELECT requester_id, recipient_id
       FROM friend_requests
       WHERE status = :status
         AND (requester_id = :user_id OR recipient_id = :user_id)',
      [
        'status' => 'accepted',
        'user_id' => $user_id,
      ]
    );

    foreach ($rows as $row) {
      $requester = (string) ($row['requester_id'] ?? '');
      $recipient = (string) ($row['recipient_id'] ?? '');
      if ($requester && $requester !== $user_id) {
        $ids[] = $requester;
      }
      if ($recipient && $recipient !== $user_id) {
        $ids[] = $recipient;
      }
    }
  }

  $ids = array_values(array_unique(array_filter($ids)));
  if (!$ids) {
    json_response(200, ['ok' => true, 'players' => []]);
    exit;
  }

  $placeholders = [];
  foreach ($ids as $index => $id) {
    $key = 'id_' . $index;
    $placeholders[] = ':' . $key;
    $params[$key] = $id;
  }
  $where_clauses[] = 'u.id IN (' . implode(', ', $placeholders) . ')';
}

if ($scope === 'monthly') {
  if (leaderboard_stats_available()) {
    $where_clauses[] = $monthly_games_select . ' > 0';
  } elseif (table_exists('match_rooms')) {
    $where_clauses[] = "u.id IN (
      SELECT white_id FROM match_rooms WHERE created_at >= date_trunc('month', now())
      UNION
      SELECT black_id FROM match_rooms WHERE created_at >= date_trunc('month', now())
    )";
  }
}

$where = $where_clauses ? ('WHERE ' . implode(' AND ', $where_clauses)) : '';

$order_clause = $scope === 'monthly'
  ? sprintf(
      '%s DESC, COALESCE(p.rating, 1200) DESC, COALESCE(NULLIF(TRIM(p.name), \'\'), u.display_name) ASC, u.id ASC',
      $monthly_score_select
    )
  : sprintf(
      'COALESCE(p.rating, 1200) DESC, %s DESC, COALESCE(NULLIF(TRIM(p.name), \'\'), u.display_name) ASC, u.id ASC',
      $rating_order_tie
    );

$sql = sprintf(
  "WITH ranked AS (
     SELECT
       u.id AS id,
       COALESCE(NULLIF(TRIM(p.name), ''), u.display_name) AS name,
       COALESCE(p.rating, 1200) AS rating,
       %s AS monthly_score,
       %s AS rolling_delta,
       %s AS monthly_games,
       ROW_NUMBER() OVER (
         ORDER BY %s
       ) AS rank
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.id
     %s
     %s
   )
   SELECT id, name, rating, rank, monthly_score, rolling_delta, monthly_games
   FROM ranked
   ORDER BY rank ASC
   LIMIT :limit OFFSET :offset",
  $monthly_score_select,
  $rolling_delta_select,
  $monthly_games_select,
  $order_clause,
  $stats_join,
  $where
);

$rows = db_fetch_all($sql, $params);

$players = array_map(static function (array $row) use ($scope): array {
  $delta = $scope === 'monthly'
    ? (int) ($row['monthly_score'] ?? 0)
    : (int) ($row['rolling_delta'] ?? 0);

  return [
    'id' => (string) ($row['id'] ?? ''),
    'rank' => isset($row['rank']) ? (int) $row['rank'] : 0,
    'name' => (string) ($row['name'] ?? ''),
    'rating' => isset($row['rating']) ? (int) $row['rating'] : 1200,
    'delta' => $delta,
  ];
}, $rows);

json_response(200, [
  'ok' => true,
  'scope' => $scope,
  'page' => $page,
  'pageSize' => $page_size,
  'players' => $players,
]);
