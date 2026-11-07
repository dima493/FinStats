<?php

declare(strict_types=1);

// XAMPP defaults. Environment variables can override these values.
$env = static function (string $name, string $default = ''): string {
    $value = getenv($name);
    return $value === false ? $default : $value;
};

return [
    'host' => $env('FINSTATS_DB_HOST', '127.0.0.1'),
    'port' => (int) $env('FINSTATS_DB_PORT', '3307'),
    'database' => $env('FINSTATS_DB_NAME', 'finstats'),
    'username' => $env('FINSTATS_DB_USER', 'root'),
    'password' => $env('FINSTATS_DB_PASSWORD'),
    'charset' => 'utf8mb4',
];
