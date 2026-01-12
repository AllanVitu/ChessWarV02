<?php

function db(): PDO
{
  static $pdo = null;
  if ($pdo instanceof PDO) {
    return $pdo;
  }

  $config = require __DIR__ . '/config.php';
  $host = $config['db_host'] ?? '';
  $port = $config['db_port'] ?? '';
  $name = $config['db_name'] ?? '';
  $user = $config['db_user'] ?? '';
  $pass = $config['db_pass'] ?? '';
  $sslmode = $config['db_sslmode'] ?? '';

  if (!$host || !$name || !$user || $name === 'CHANGE_ME' || $user === 'CHANGE_ME') {
    throw new RuntimeException('Database config is missing.');
  }

  $dsn = getenv('DB_DSN');
  if (!$dsn) {
    $dsn = sprintf('pgsql:host=%s;port=%s;dbname=%s', $host, $port ?: '5432', $name);
    if ($sslmode) {
      $dsn .= sprintf(';sslmode=%s', $sslmode);
    }
  }

  $pdo = new PDO($dsn, $user, $pass, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);

  return $pdo;
}

function db_query(string $sql, array $params = []): PDOStatement
{
  $stmt = db()->prepare($sql);
  $stmt->execute($params);
  return $stmt;
}

function db_fetch_all(string $sql, array $params = []): array
{
  return db_query($sql, $params)->fetchAll();
}

function db_fetch_one(string $sql, array $params = []): ?array
{
  $row = db_query($sql, $params)->fetch();
  return $row === false ? null : $row;
}

function db_fetch_value(string $sql, array $params = [])
{
  $stmt = db_query($sql, $params);
  $value = $stmt->fetchColumn();
  return $value === false ? null : $value;
}
