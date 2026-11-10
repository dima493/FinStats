<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/helpers.php';

const MAX_AMOUNT_CENTS = 9007199254740991;

function validateOperation(array $operation): array
{
    $type = $operation['type'] ?? null;
    $amountCents = $operation['amountCents'] ?? null;
    $note = $operation['note'] ?? '';

    if (!in_array($type, ['deposit', 'withdrawal'], true)) {
        throw new InvalidArgumentException('Operation type must be deposit or withdrawal.');
    }
    if (!is_int($amountCents) || $amountCents <= 0 || $amountCents > MAX_AMOUNT_CENTS) {
        throw new InvalidArgumentException('Amount must be a positive integer number of cents.');
    }
    if (!is_string($note)) {
        throw new InvalidArgumentException('Note must be a string.');
    }

    $note = trim($note);
    $noteLength = function_exists('mb_strlen') ? mb_strlen($note) : strlen($note);
    if ($noteLength > 80) {
        throw new InvalidArgumentException('Note cannot exceed 80 characters.');
    }

    return [$type, $amountCents, $note];
}

function formatDate(string $date): string
{
    return (new DateTimeImmutable($date, new DateTimeZone('UTC')))
        ->format('Y-m-d\TH:i:s.u\Z');
}

function walletPayload(PDO $connection, int $walletId): array
{
    $wallet = fetchWallet($connection, $walletId);

    $statement = $connection->prepare(
        "SELECT
            COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount_cents ELSE 0 END), 0) AS added,
            COALESCE(SUM(CASE WHEN type = 'withdrawal' THEN amount_cents ELSE 0 END), 0) AS withdrawn
         FROM operations WHERE wallet_id = ?"
    );
    $statement->execute([$walletId]);
    $totals = $statement->fetch();

    $statement = $connection->prepare(
        'SELECT id, type, amount_cents, note, created_at
         FROM operations WHERE wallet_id = ? ORDER BY created_at DESC, id DESC'
    );
    $statement->execute([$walletId]);

    $operations = array_map(static function (array $row): array {
        return [
            'id' => (string) $row['id'],
            'type' => $row['type'],
            'amountCents' => (int) $row['amount_cents'],
            'note' => $row['note'],
            'date' => formatDate($row['created_at']),
        ];
    }, $statement->fetchAll());

    return [
        'wallet' => [
            'id' => (int) $wallet['id'],
            'name' => $wallet['name'],
        ],
        'balanceCents' => (int) $wallet['balance_cents'],
        'totalAddedCents' => (int) $totals['added'],
        'totalWithdrawnCents' => (int) $totals['withdrawn'],
        'operations' => $operations,
    ];
}

function createOperation(PDO $connection, int $walletId, array $input): void
{
    [$type, $amountCents, $note] = validateOperation($input);

    $connection->beginTransaction();
    try {
        $wallet = fetchWallet($connection, $walletId, true);
        $balance = (int) $wallet['balance_cents'];

        if ($type === 'withdrawal' && $amountCents > $balance) {
            $connection->rollBack();
            respond(409, [
                'error' => 'Insufficient funds for this withdrawal.',
                'balanceCents' => $balance,
            ]);
        }

        $newBalance = $type === 'deposit'
            ? $balance + $amountCents
            : $balance - $amountCents;

        $statement = $connection->prepare(
            'INSERT INTO operations (wallet_id, type, amount_cents, note) VALUES (?, ?, ?, ?)'
        );
        $statement->execute([$walletId, $type, $amountCents, $note]);

        $statement = $connection->prepare('UPDATE wallets SET balance_cents = ? WHERE id = ?');
        $statement->execute([$newBalance, $walletId]);
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }
        throw $error;
    }

    respond(201, walletPayload($connection, $walletId));
}

function operationEffect(string $type, int $amountCents): int
{
    return $type === 'deposit' ? $amountCents : -$amountCents;
}

function lockOperation(PDO $connection, int $walletId, int $operationId): array
{
    $statement = $connection->prepare(
        'SELECT id, type, amount_cents FROM operations WHERE id = ? AND wallet_id = ? FOR UPDATE'
    );
    $statement->execute([$operationId, $walletId]);
    $operation = $statement->fetch();

    if (!$operation) {
        $connection->rollBack();
        respond(404, ['error' => 'Transaction not found in this wallet.']);
    }

    return $operation;
}

function updateOperation(PDO $connection, int $walletId, array $input): void
{
    $operationId = readOperationId($input['operationId'] ?? $_GET['operationId'] ?? null);
    [$type, $amountCents, $note] = validateOperation($input);

    $connection->beginTransaction();
    try {
        $wallet = fetchWallet($connection, $walletId, true);
        $operation = lockOperation($connection, $walletId, $operationId);

        $newBalance = (int) $wallet['balance_cents']
            - operationEffect($operation['type'], (int) $operation['amount_cents'])
            + operationEffect($type, $amountCents);

        if ($newBalance < 0) {
            $connection->rollBack();
            respond(409, [
                'error' => 'This change would make the wallet balance negative.',
                'balanceCents' => (int) $wallet['balance_cents'],
            ]);
        }

        $statement = $connection->prepare(
            'UPDATE operations SET type = ?, amount_cents = ?, note = ? WHERE id = ? AND wallet_id = ?'
        );
        $statement->execute([$type, $amountCents, $note, $operationId, $walletId]);

        $statement = $connection->prepare('UPDATE wallets SET balance_cents = ? WHERE id = ?');
        $statement->execute([$newBalance, $walletId]);
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }
        throw $error;
    }

    respond(200, walletPayload($connection, $walletId));
}

function deleteOperation(PDO $connection, int $walletId, int $operationId): void
{
    $connection->beginTransaction();
    try {
        $wallet = fetchWallet($connection, $walletId, true);
        $operation = lockOperation($connection, $walletId, $operationId);

        $newBalance = (int) $wallet['balance_cents']
            - operationEffect($operation['type'], (int) $operation['amount_cents']);

        if ($newBalance < 0) {
            $connection->rollBack();
            respond(409, [
                'error' => 'This transaction cannot be deleted because the balance would become negative.',
                'balanceCents' => (int) $wallet['balance_cents'],
            ]);
        }

        $statement = $connection->prepare('DELETE FROM operations WHERE id = ? AND wallet_id = ?');
        $statement->execute([$operationId, $walletId]);

        $statement = $connection->prepare('UPDATE wallets SET balance_cents = ? WHERE id = ?');
        $statement->execute([$newBalance, $walletId]);
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }
        throw $error;
    }

    respond(200, walletPayload($connection, $walletId));
}

function importOperations(PDO $connection, int $walletId, array $input): void
{
    $operations = $input['operations'] ?? null;
    if (!is_array($operations) || count($operations) === 0 || count($operations) > 5000) {
        throw new InvalidArgumentException('Provide between 1 and 5000 operations to import.');
    }

    $validated = [];
    foreach ($operations as $operation) {
        if (!is_array($operation)) {
            throw new InvalidArgumentException('Each imported operation must be an object.');
        }

        [$type, $amountCents, $note] = validateOperation($operation);
        if (!isset($operation['date']) || !is_string($operation['date'])) {
            throw new InvalidArgumentException('Each imported operation must have a valid date.');
        }
        try {
            $createdAt = new DateTimeImmutable($operation['date']);
        } catch (Exception $error) {
            throw new InvalidArgumentException('Each imported operation must have a valid date.');
        }
        $validated[] = [
            $type,
            $amountCents,
            $note,
            $createdAt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d H:i:s.u'),
        ];
    }

    $connection->beginTransaction();
    try {
        $wallet = fetchWallet($connection, $walletId, true);
        $balance = (int) $wallet['balance_cents'];
        $insert = $connection->prepare(
            'INSERT INTO operations (wallet_id, type, amount_cents, note, created_at)
             VALUES (?, ?, ?, ?, ?)'
        );
        foreach ($validated as [$type, $amountCents, $note, $createdAt]) {
            if ($type === 'withdrawal' && $amountCents > $balance) {
                throw new InvalidArgumentException('Imported operations contain a withdrawal exceeding the balance.');
            }
            $balance = $type === 'deposit'
                ? $balance + $amountCents
                : $balance - $amountCents;
            $insert->execute([$walletId, $type, $amountCents, $note, $createdAt]);
        }

        $statement = $connection->prepare('UPDATE wallets SET balance_cents = ? WHERE id = ?');
        $statement->execute([$balance, $walletId]);
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }
        throw $error;
    }

    respond(200, walletPayload($connection, $walletId));
}

function clearOperations(PDO $connection, int $walletId): void
{
    $connection->beginTransaction();
    try {
        fetchWallet($connection, $walletId, true);

        $statement = $connection->prepare('DELETE FROM operations WHERE wallet_id = ?');
        $statement->execute([$walletId]);
        $statement = $connection->prepare('UPDATE wallets SET balance_cents = 0 WHERE id = ?');
        $statement->execute([$walletId]);
        $connection->commit();
    } catch (Throwable $error) {
        if ($connection->inTransaction()) {
            $connection->rollBack();
        }
        throw $error;
    }

    respond(200, walletPayload($connection, $walletId));
}

try {
    requireAuth();
    $connection = database();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        $walletId = readWalletId($_GET['walletId'] ?? null, true) ?? defaultWalletId($connection);
        respond(200, walletPayload($connection, $walletId));
    }
    if ($method === 'POST') {
        $input = readJsonBody();
        $walletId = readWalletId($input['walletId'] ?? $_GET['walletId'] ?? null, true)
            ?? defaultWalletId($connection);
        if (($input['action'] ?? 'create') === 'import') {
            importOperations($connection, $walletId, $input);
        }
        createOperation($connection, $walletId, $input);
    }
    if ($method === 'PATCH') {
        $input = readJsonBody();
        $walletId = readWalletId($input['walletId'] ?? $_GET['walletId'] ?? null, true)
            ?? defaultWalletId($connection);
        updateOperation($connection, $walletId, $input);
    }
    if ($method === 'DELETE') {
        $walletId = readWalletId($_GET['walletId'] ?? null, true) ?? defaultWalletId($connection);
        if (($_GET['operationId'] ?? null) !== null) {
            deleteOperation($connection, $walletId, readOperationId($_GET['operationId']));
        }
        clearOperations($connection, $walletId);
    }

    header('Allow: GET, POST, PATCH, DELETE');
    respond(405, ['error' => 'Method not allowed.']);
} catch (JsonException $error) {
    respond(400, ['error' => 'The request contains invalid JSON.']);
} catch (InvalidArgumentException $error) {
    respond(422, ['error' => $error->getMessage()]);
} catch (PDOException $error) {
    respondDatabaseError($error);
} catch (Throwable $error) {
    error_log('FinStats API error: ' . $error->getMessage());
    respond(500, ['error' => 'The wallet request could not be completed.']);
}
