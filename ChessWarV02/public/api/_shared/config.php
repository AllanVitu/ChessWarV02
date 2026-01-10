<?php

return [
  'db_host' => getenv('DB_HOST') ?: 'localhost',
  'db_port' => getenv('DB_PORT') ?: '5432',
  'db_name' => getenv('DB_NAME') ?: 'CHANGE_ME',
  'db_user' => getenv('DB_USER') ?: 'CHANGE_ME',
  'db_pass' => getenv('DB_PASSWORD') ?: 'CHANGE_ME',
  'db_sslmode' => getenv('DB_SSLMODE') ?: '',
];
