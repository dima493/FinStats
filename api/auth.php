<?php

declare(strict_types=1);

require_once __DIR__ . '/database.php';
require_once __DIR__ . '/helpers.php';

function userCount(PDO $connection): int
{
    return (int) $connection->query('SELECT COUNT(*) FROM users')->fetchColumn();
}

function validateCredentials(array $input): array
{
    $username = $input['username'] ?? null;
    $password = $input['password'] ?? null;

    if (!is_string($username) || !is_string($password)) {
        throw new InvalidArgumentException('Username and password are required.');
    }

    $username = trim($username);
    if (strlen($username) < 3 || strlen($username) > 60) {
        throw new InvalidArgumentException('Username must be between 3 and 60 characters.');
    }
    if (strlen($password) < 8) {
        throw new InvalidArgumentException('Password must be at least 8 characters.');
    }
    if (strlen($password) > 72) {
        throw new InvalidArgumentException('Password cannot exceed 72 characters.');
    }

    return [$username, $password];
}

function signIn(array $user): void
{
    session_regenerate_id(true);
    $_SESSION['user_id'] = (int) $user['id'];
    $_SESSION['username'] = $user['username'];
}

function authStatus(PDO $connection): array
{
    $needsSetup = userCount($connection) === 0;

    if (isset($_SESSION['user_id'])) {
        $statement = $connection->prepare('SELECT username FROM users WHERE id = ?');
        $statement->execute([$_SESSION['user_id']]);
        $username = $statement->fetchColumn();
        if ($username === false) {
            $_SESSION = [];
            session_destroy();
            startAuthSession();
        } else {
            return ['authenticated' => true, 'needsSetup' => $needsSetup, 'username' => $username];
        }
    }

    return ['authenticated' => false, 'needsSetup' => $needsSetup, 'username' => null];
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

        if ($action === 'setup') {
            if (userCount($connection) > 0) {
                respond(409, ['error' => 'An account already exists. Sign in instead.']);
            }
            [$username, $password] = validateCredentials($input);
            $statement = $connection->prepare(
                'INSERT INTO users (username, password_hash) VALUES (?, ?)'
            );
            $statement->execute([$username, password_hash($password, PASSWORD_DEFAULT)]);
            signIn(['id' => (int) $connection->lastInsertId(), 'username' => $username]);
            respond(200, ['authenticated' => true, 'username' => $username]);
        }
        if ($action === 'login') {
            [$username, $password] = validateCredentials($input);
            $statement = $connection->prepare(
                'SELECT id, username, password_hash FROM users WHERE username = ?'
            );
            $statement->execute([$username]);
            $user = $statement->fetch();
            if (!$user || !password_verify($password, $user['password_hash'])) {
                sleep(1);
                respond(401, ['error' => 'Invalid username or password.']);
            }
            signIn($user);
            respond(200, ['authenticated' => true, 'username' => $user['username']]);
        }
        if ($action === 'logout') {
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