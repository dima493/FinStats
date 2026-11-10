<?php

declare(strict_types=1);

// Secret-free template. Copy this file to config.php and fill in the
// exact values shown in Control Panel → MySQL Databases.
$env = static function (string $name, string $default = ''): string {
    $value = getenv($name);
    return $value === false ? $default : $value;
};

return [
    'host' => $env('FINSTATS_DB_HOST', 'sqlXXX.infinityfree.com'),
    'port' => (int) $env('FINSTATS_DB_PORT', '3306'),
    'database' => $env('FINSTATS_DB_NAME', 'if0_XXXXXXXX_finstats'),
    'username' => $env('FINSTATS_DB_USER', 'if0_XXXXXXXX'),
    'password' => $env('FINSTATS_DB_PASSWORD', 'YOUR_HOSTING_PASSWORD'),
    'charset' => 'utf8mb4',
];