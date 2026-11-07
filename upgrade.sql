-- Upgrades an existing single-wallet FinStats database to multiple wallets.
-- Run this once in phpMyAdmin (or the MySQL CLI) before using the new version.
-- Existing balance and operations are kept and become the "Main wallet".

USE finstats;

ALTER TABLE operations DROP FOREIGN KEY fk_operations_wallet;

ALTER TABLE wallets
    MODIFY id INT UNSIGNED NOT NULL AUTO_INCREMENT,
    ADD COLUMN name VARCHAR(60) NOT NULL DEFAULT '' AFTER id,
    ADD COLUMN created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP AFTER balance_cents;

UPDATE wallets SET name = 'Main wallet' WHERE name = '';

ALTER TABLE wallets
    ADD UNIQUE KEY uq_wallets_name (name);

ALTER TABLE operations
    MODIFY wallet_id INT UNSIGNED NOT NULL;

ALTER TABLE operations
    ADD CONSTRAINT fk_operations_wallet
        FOREIGN KEY (wallet_id) REFERENCES wallets (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;
