CREATE DATABASE IF NOT EXISTS finstats
    CHARACTER SET utf8mb4
    COLLATE utf8mb4_unicode_ci;

USE finstats;

CREATE TABLE IF NOT EXISTS wallets (
    id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(60) NOT NULL,
    balance_cents BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_wallets_name (name)
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

INSERT IGNORE INTO wallets (id, name, balance_cents) VALUES (1, 'Main wallet', 0);
