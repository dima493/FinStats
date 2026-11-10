-- Upgrades FinStats to per-user accounts (sign up, password recovery,
-- account deletion). Run once with the finstats database selected:
-- phpMyAdmin: select the database first, then import this file.
-- CLI: mysql finstats < upgrade-auth.sql
-- Existing wallets and transactions become the first account's data.

ALTER TABLE users
    ADD COLUMN recovery_code_hash VARCHAR(255) DEFAULT NULL;

ALTER TABLE wallets
    ADD COLUMN user_id INT UNSIGNED NOT NULL DEFAULT 1 AFTER id;

ALTER TABLE wallets
    DROP INDEX uq_wallets_name,
    ADD UNIQUE KEY uq_wallets_user_name (user_id, name);

ALTER TABLE wallets
    ADD CONSTRAINT fk_wallets_user
        FOREIGN KEY (user_id) REFERENCES users (id)
        ON UPDATE CASCADE
        ON DELETE CASCADE;

ALTER TABLE wallets
    ALTER COLUMN user_id DROP DEFAULT;