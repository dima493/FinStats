-- FinStats schema for InfinityFree (fresh start, no data).
-- Import into the database you created in the control panel.
-- Do NOT use database.sql from the project root: its CREATE DATABASE/USE
-- statements are not allowed on shared hosting.
-- Wallets are created automatically when each account signs up.

CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(60) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    recovery_code_hash VARCHAR(255) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_username (username)
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS wallets (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    name VARCHAR(60) NOT NULL,
    balance_cents BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wallets_user_name (user_id, name),
    CONSTRAINT fk_wallets_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB;

CREATE TABLE IF NOT EXISTS operations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    wallet_id INT UNSIGNED NOT NULL,
    type ENUM('deposit', 'withdrawal') NOT NULL,
    amount_cents BIGINT UNSIGNED NOT NULL,
    note VARCHAR(80) NOT NULL DEFAULT '',
    created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
    INDEX idx_operations_wallet_created (wallet_id, created_at),
    CONSTRAINT fk_operations_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
) ENGINE = InnoDB;