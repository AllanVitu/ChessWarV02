<?php

function random_hex(int $bytes): string
{
  return bin2hex(random_bytes($bytes));
}

function generate_uuid(): string
{
  $data = random_bytes(16);
  $data[6] = chr((ord($data[6]) & 0x0f) | 0x40);
  $data[8] = chr((ord($data[8]) & 0x3f) | 0x80);
  $hex = bin2hex($data);
  return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split($hex, 4));
}

function hash_password(string $password, string $salt): string
{
  $hash = hash_pbkdf2('sha256', $password, $salt, 120000, 32, true);
  return bin2hex($hash);
}

function verify_password(string $password, string $salt, string $expected): bool
{
  $computed = hash_password($password, $salt);
  return hash_equals($expected, $computed);
}
