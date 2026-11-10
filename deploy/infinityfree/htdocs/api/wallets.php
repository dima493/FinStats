<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/helpers.php';

try {
    requireAuth();
    $connection = database();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        respond(200, ['wallets' => walletsPayload($connection)]);
    }

    if ($method === 'POST') {
        $input = readJsonBody();
        $name = validateWalletName($input['name'] ?? null);

        try {
            $statement = $connection->prepare('INSERT INTO wallets (name, balance_cents) VALUES (?, 0)');
            $statement->execute([$name]);
        } catch (PDOException $error) {
            if (isDuplicateKey($error)) {
                respond(422, ['error' => 'A wallet with that name already exists.']);
            }
            throw $error;
        }

        respond(201, [
            'wallet' => [
                'id' => (int) $connection->lastInsertId(),
                'name' => $name,
                'balanceCents' => 0,
            ],
            'wallets' => walletsPayload($connection),
        ]);
    }

    if ($method === 'PATCH') {
        $input = readJsonBody();
        $walletId = readWalletId($input['id'] ?? $_GET['id'] ?? null);
        $name = validateWalletName($input['name'] ?? null);
        $wallet = fetchWallet($connection, $walletId);

        try {
            $statement = $connection->prepare('UPDATE wallets SET name = ? WHERE id = ?');
            $statement->execute([$name, $walletId]);
        } catch (PDOException $error) {
            if (isDuplicateKey($error)) {
                respond(422, ['error' => 'A wallet with that name already exists.']);
            }
            throw $error;
        }

        respond(200, [
            'wallet' => [
                'id' => $walletId,
                'name' => $name,
                'balanceCents' => (int) $wallet['balance_cents'],
            ],
            'wallets' => walletsPayload($connection),
        ]);
    }

    if ($method === 'DELETE') {
        $walletId = readWalletId($_GET['id'] ?? null);
        fetchWallet($connection, $walletId);

        $walletCount = (int) $connection->query('SELECT COUNT(*) FROM wallets')->fetchColumn();
        if ($walletCount <= 1) {
            respond(409, ['error' => 'At least one wallet must remain.']);
        }

        $statement = $connection->prepare('DELETE FROM wallets WHERE id = ?');
        $statement->execute([$walletId]);

        respond(200, ['wallets' => walletsPayload($connection)]);
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
