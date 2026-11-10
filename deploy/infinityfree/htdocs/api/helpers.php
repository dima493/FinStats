<?php

declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

function respond(int $status, array $payload): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function readJsonBody(): array
{
    $body = file_get_contents('php://input');
    if ($body === false || trim($body) === '') {
        throw new InvalidArgumentException('A JSON request body is required.');
    }

    $data = json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    if (!is_array($data)) {
        throw new InvalidArgumentException('The JSON request body must be an object.');
    }

    return $data;
}

function startAuthSession(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }

    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'httponly' => true,
        'samesite' => 'Lax',
        'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off',
    ]);
    session_name('finstats_session');
    session_start();
}

function requireAuth(): int
{
    startAuthSession();
    if (!isset($_SESSION['user_id'])) {
        respond(401, ['error' => 'Authentication required. Sign in to continue.']);
    }

    return (int) $_SESSION['user_id'];
}

function readWalletId(mixed $value, bool $optional = false): ?int
{
    if ($value === null || $value === '') {
        if ($optional) {
            return null;
        }
        throw new InvalidArgumentException('A wallet id is required.');
    }

    if (is_int($value)) {
        $walletId = $value;
    } elseif (is_string($value) && preg_match('/^\d+$/', $value) === 1) {
        $walletId = (int) $value;
    } else {
        throw new InvalidArgumentException('Wallet id must be a positive integer.');
    }

    if ($walletId < 1) {
        throw new InvalidArgumentException('Wallet id must be a positive integer.');
    }

    return $walletId;
}

function readOperationId(mixed $value): int
{
    if (is_int($value)) {
        $operationId = $value;
    } elseif (is_string($value) && preg_match('/^\d+$/', $value) === 1) {
        $operationId = (int) $value;
    } else {
        throw new InvalidArgumentException('A transaction id is required.');
    }

    if ($operationId < 1) {
        throw new InvalidArgumentException('Transaction id must be a positive integer.');
    }

    return $operationId;
}

function validateWalletName(mixed $value): string
{
    if (!is_string($value)) {
        throw new InvalidArgumentException('Wallet name is required.');
    }

    $name = trim(preg_replace('/\s+/u', ' ', $value) ?? '');
    if ($name === '') {
        throw new InvalidArgumentException('Wallet name cannot be empty.');
    }

    $length = function_exists('mb_strlen') ? mb_strlen($name) : strlen($name);
    if ($length > 60) {
        throw new InvalidArgumentException('Wallet name cannot exceed 60 characters.');
    }

    return $name;
}

function fetchWallet(PDO $connection, int $walletId, int $userId, bool $forUpdate = false): array
{
    $statement = $connection->prepare(
        'SELECT id, name, balance_cents FROM wallets WHERE id = ? AND user_id = ?' . ($forUpdate ? ' FOR UPDATE' : '')
    );
    $statement->execute([$walletId, $userId]);
    $wallet = $statement->fetch();

    if ($wallet === false) {
        respond(404, ['error' => 'Wallet not found.']);
    }

    return $wallet;
}

function defaultWalletId(PDO $connection, int $userId): int
{
    $statement = $connection->prepare('SELECT id FROM wallets WHERE user_id = ? ORDER BY id LIMIT 1');
    $statement->execute([$userId]);
    $walletId = $statement->fetchColumn();
    if ($walletId === false) {
        respond(409, ['error' => 'No wallets exist for this account.']);
    }

    return (int) $walletId;
}

function walletsPayload(PDO $connection, int $userId): array
{
    $statement = $connection->prepare('SELECT id, name, balance_cents FROM wallets WHERE user_id = ? ORDER BY id');
    $statement->execute([$userId]);
    $rows = $statement->fetchAll();

    return array_map(static function (array $row): array {
        return [
            'id' => (int) $row['id'],
            'name' => $row['name'],
            'balanceCents' => (int) $row['balance_cents'],
        ];
    }, $rows);
}

function isDuplicateKey(PDOException $error): bool
{
    return ($error->errorInfo[1] ?? null) === 1062;
}

function respondDatabaseError(PDOException $error): void
{
    error_log('FinStats database error: ' . $error->getMessage());

    $code = $error->errorInfo[1] ?? null;
    if ($code === 1054) {
        respond(503, ['error' => 'The database schema is outdated. Run upgrade.sql in phpMyAdmin and reload.']);
    }
    if ($code === 1146) {
        respond(503, ['error' => 'The database tables are missing. Import database.sql in phpMyAdmin and reload.']);
    }

    respond(503, ['error' => 'Cannot connect to MySQL. Start MySQL in XAMPP and import database.sql.']);
}
