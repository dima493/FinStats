<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/helpers.php';

function userCount(PDO $connection): int
{
    return (int) $connection->query('SELECT COUNT(*) FROM users')->fetchColumn();
}

function validateUsername(mixed $value): string
{
    if (!is_string($value)) {
        throw new InvalidArgumentException('Username is required.');
    }

    $username = trim($value);
    if (strlen($username) < 3 || strlen($username) > 60) {
        throw new InvalidArgumentException('Username must be between 3 and 60 characters.');
    }

    return $username;
}

function validatePassword(mixed $value): string
{
    if (!is_string($value)) {
        throw new InvalidArgumentException('Password is required.');
    }
    if (strlen($value) < 8) {
        throw new InvalidArgumentException('Password must be at least 8 characters.');
    }
    if (strlen($value) > 72) {
        throw new InvalidArgumentException('Password cannot exceed 72 characters.');
    }

    return $value;
}

function validateCredentials(array $input): array
{
    return [
        validateUsername($input['username'] ?? null),
        validatePassword($input['password'] ?? null),
    ];
}

function normalizeRecoveryCode(string $code): string
{
    return strtoupper(preg_replace('/[^a-zA-Z0-9]/', '', $code) ?? '');
}

function signIn(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['username'] = $user['username'];
}

function currentUser(PDO $connection): array
{
    requireAuth();
    $statement = $connection->prepare(
        'SELECT id, username, password_hash, recovery_code_hash FROM users WHERE id = ?'
    );
    $statement->execute([$_SESSION['user_id']]);
    $user = $statement->fetch();
    if ($user === false) {
        respond(401, ['error' => 'Authentication required. Sign in to continue.']);
    }

    return $user;
}

function verifyPassword(array $user, mixed $password): void
{
    if (!is_string($password) || !password_verify($password, $user['password_hash'])) {
        sleep(1);
        respond(401, ['error' => 'The password is incorrect.']);
    }
}

function authStatus(PDO $connection): array
{
    $needsSetup = userCount($connection) === 0;

    if (isset($_SESSION['user_id'])) {
        $statement = $connection->prepare(
            'SELECT username, recovery_code_hash FROM users WHERE id = ?'
        );
        $statement->execute([$_SESSION['user_id']]);
        $user = $statement->fetch();
        if ($user === false) {
            $_SESSION = [];
            session_destroy();
            startAuthSession();
        } else {
            return [
                'authenticated' => true,
                'needsSetup' => $needsSetup,
                'username' => $user['username'],
                'hasRecoveryCode' => $user['recovery_code_hash'] !== null,
            ];
        }
    }

    return [
        'authenticated' => false,
        'needsSetup' => $needsSetup,
        'username' => null,
        'hasRecoveryCode' => false,
    ];
}

try {
    startAuthSession();
    $connection = database();
    $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

    if ($method === 'GET') {
        respond(200, authStatus($connection));
    }
    if ($method === 'POST') {
        $input = readJsonBody();
        $action = $input['action'] ?? 'login';

        if ($action === 'signup') {
            [$username, $password] = validateCredentials($input);

            $connection->beginTransaction();
            try {
                $statement = $connection->prepare(
                    'INSERT INTO users (username, password_hash) VALUES (?, ?)'
                );
                $statement->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
                $userId = (int) $connection->lastInsertId();

                $statement = $connection->prepare(
                    "INSERT INTO wallets (user_id, name, balance_cents) VALUES (?, 'Main wallet', 0)"
                );
                $statement->execute([$userId]);
                $connection->commit();
            } catch (PDOException $error) {
                $connection->rollBack();
                if (isDuplicateKey($error)) {
                    respond(409, ['error' => 'That username is already taken.']);
                }
                throw $error;
            } catch (Throwable $error) {
                $connection->rollBack();
                throw $error;
            }

            signIn(['id' => $userId, 'username' => $username]);
            respond(200, ['authenticated' => true, 'username' => $username]);
        }
        if ($action === 'login') {
            [$username, $password] = validateCredentials($input);
            $statement = $connection->prepare(
                'SELECT id, username, password_hash, recovery_code_hash FROM users WHERE username = ?'
            );
            $statement->execute([$username]);
            $user = $statement->fetch();
            if (!$user || !password_verify($password, $user['password_hash'])) {
                sleep(1);
                respond(401, ['error' => 'Invalid username or password.']);
            }
            signIn($user);
            respond(200, [
                'authenticated' => true,
                'username' => $user['username'],
                'hasRecoveryCode' => $user['recovery_code_hash'] !== null,
            ]);
        }
        if ($action === 'logout') {
            $_SESSION = [];
            session_destroy();
            respond(200, ['authenticated' => false]);
        }
        if ($action === 'change_password') {
            $user = currentUser($connection);
            verifyPassword($user, $input['currentPassword'] ?? null);
            $newPassword = validatePassword($input['newPassword'] ?? null);
            $statement = $connection->prepare('UPDATE users SET password_hash = ? WHERE id = ?');
            $statement->execute([password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]);
            respond(200, ['changed' => true]);
        }
        if ($action === 'recovery_code') {
            $user = currentUser($connection);
            verifyPassword($user, $input['password'] ?? null);
            $code = implode('-', str_split(strtoupper(bin2hex(random_bytes(8))), 4));
            $statement = $connection->prepare('UPDATE users SET recovery_code_hash = ? WHERE id = ?');
            $statement->execute([password_hash(normalizeRecoveryCode($code), PASSWORD_DEFAULT), $user['id']]);
            respond(200, ['recoveryCode' => $code]);
        }
        if ($action === 'forgot_password') {
            $username = validateUsername($input['username'] ?? null);
            $newPassword = validatePassword($input['newPassword'] ?? null);
            $code = normalizeRecoveryCode(is_string($input['recoveryCode'] ?? null) ? $input['recoveryCode'] : '');

            $statement = $connection->prepare('SELECT id, recovery_code_hash FROM users WHERE username = ?');
            $statement->execute([$username]);
            $user = $statement->fetch();
            if (
                !$user
                || $user['recovery_code_hash'] === null
                || $code === ''
                || !password_verify($code, $user['recovery_code_hash'])
            ) {
                sleep(1);
                respond(401, ['error' => 'Invalid username or recovery code.']);
            }

            $statement = $connection->prepare(
                'UPDATE users SET password_hash = ?, recovery_code_hash = NULL WHERE id = ?'
            );
            $statement->execute([password_hash($newPassword, PASSWORD_DEFAULT), $user['id']]);
            respond(200, ['reset' => true]);
        }
        if ($action === 'delete_account') {
            $user = currentUser($connection);
            verifyPassword($user, $input['password'] ?? null);
            $statement = $connection->prepare('DELETE FROM users WHERE id = ?');
            $statement->execute([$user['id']]);
            $_SESSION = [];
            session_destroy();
            respond(200, ['authenticated' => false]);
        }

        respond(422, ['error' => 'Unknown auth action.']);
    }

    header('Allow: GET, POST');
    respond(405, ['error' => 'Method not allowed.']);
} catch (JsonException $error) {
    respond(400, ['error' => 'The request contains invalid JSON.']);
} catch (InvalidArgumentException $error) {
    respond(422, ['error' => $error->getMessage()]);
} catch (PDOException $error) {
    respondDatabaseError($error);
} catch (Throwable $error) {
    error_log('FinStats API error: ' . $error->getMessage());
    respond(500, ['error' => 'The auth request could not be completed.']);
}