# Deploy FinStats to InfinityFree

Package contents:

| File | Purpose |
| --- | --- |
| `finstats-htdocs.zip` | Website files, ready to upload (same content as `htdocs/`). Local-only — contains your real `config.php`; do not commit it. |
| `htdocs/` | Unzipped website files, if you prefer uploading folder by folder |
| `htdocs/api/config.sample.php` | Secret-free connection template — copy to `config.php` and fill in your values |
| `finstats-schema.sql` | Database tables only — fresh start, no data |
| `finstats-full.sql` | Full export of your local database: tables + your real wallets, transactions and account. **Private file — do not share or commit it.** |

Both SQL files were test-imported successfully. Choose **one** of them in step 3.

## 1. Create the hosting account

1. Sign up at https://www.infinityfree.com and verify your email.
2. In the client area, click **Create Account**.
3. Choose a free subdomain (e.g. `finstats.ct.ws`) or your own domain, set a password, and create the account.
4. Wait for activation, then open the **Control Panel** for that account.
5. Note the account details shown in the client area: **MySQL hostname**, **MySQL username**, **MySQL database name** (after step 2), and the **password** (your hosting account password).

## 2. Create the database

1. In the Control Panel, open **MySQL Databases**.
2. Enter a name (e.g. `finstats`) and click **Create Database**.
3. The page now shows the exact values you need later:
   - MySQL hostname — looks like `sqlXXX.infinityfree.com` (NOT `localhost`)
   - MySQL username — looks like `if0_XXXXXXXX`
   - Full database name — looks like `if0_XXXXXXXX_finstats`
   - Password — your hosting account password

## 3. Import the database

1. In the Control Panel, open **phpMyAdmin** (or click **Admin** next to your database).
2. Select your database (`if0_XXXXXXXX_finstats`) in the left sidebar.
3. Open the **Import** tab, click **Choose File**, and pick ONE file:
   - `finstats-full.sql` — keeps your existing wallets, transactions and login. Recommended if you want your current data on the hosted site.
   - `finstats-schema.sql` — empty tables with one default wallet; you create your account on first visit.
4. Click **Go**. You should see the `users`, `wallets` and `operations` tables afterwards.

Do not import the project root's `database.sql` — its `CREATE DATABASE` statement is not allowed on shared hosting.

## 4. Configure the database connection

1. Open `htdocs/api/config.php` in a text editor. On a fresh clone the file is absent (it is git-ignored): copy `config.sample.php` to `config.php` first.
2. Replace the four placeholder values with the exact details from step 2:
   - `sqlXXX.infinityfree.com` → your MySQL hostname
   - `if0_XXXXXXXX_finstats` → your full database name
   - `if0_XXXXXXXX` → your MySQL username
   - `YOUR_HOSTING_PASSWORD` → your hosting account password
3. Leave the port as `3306`.

If you upload the zip instead, you can edit the file after uploading: File Manager → `htdocs/api/config.php` → Edit.

## 5. Upload the website files

**Option A — File Manager (easiest):**
1. Control Panel → **File Manager** (or "Online File Manager").
2. Open the `htdocs` folder and delete the default files inside it (e.g. `index2.html`, `default.php`).
3. Upload `finstats-htdocs.zip` into `htdocs`, then use the file manager's **Extract** option.
4. Make sure `index.html`, `assets/` and `api/` sit directly inside `htdocs` (not inside a nested subfolder). Delete the zip afterwards.

**Option B — FTP:**
1. Use an FTP client (e.g. FileZilla) with the FTP hostname, username and password shown in the client area (hostname is typically `ftpupload.net`).
2. Upload the *contents* of `htdocs/` into the server's `htdocs` folder.

Do not upload the `.sql` files to the server — they are only for the phpMyAdmin import.

## 6. Enable HTTPS and PHP version

1. Control Panel → **SSL/TLS**: install the free SSL certificate for your domain and enable force HTTPS (may take a little while to activate).
2. Control Panel → **Select PHP Version**: choose PHP 8.2 or newer (the app requires PHP 8.0+; `pdo_mysql` and `mbstring` are enabled by default).

## 7. Verify

1. Visit your domain, e.g. `https://finstats.ct.ws`.
2. If you imported `finstats-full.sql`: sign in with your existing account — your wallets and history should be there.
3. If you imported `finstats-schema.sql`: the setup screen appears; create your account.
4. Make a small deposit in a temporary wallet, check the balance and history, then delete the temporary wallet.

## Troubleshooting

- **"Cannot connect to MySQL"** — recheck all four values in `api/config.php`; the host must be the `sqlXXX.infinityfree.com` name, not `localhost`. The error message text mentions XAMPP (shared codebase) — on InfinityFree it means the credentials are wrong.
- **"The database tables are missing"** — the import in step 3 didn't run on the right database; select `if0_XXXXXXXX_finstats` in phpMyAdmin and import again.
- **403 / blank page on first visit** — InfinityFree blocks some automated requests and new accounts can take a few minutes to activate; use a normal browser and wait a bit.
- **Changes not visible** — clear browser cache; file uploads can take a minute to propagate.
- Free accounts sleep when inactive; the first visit after inactivity may be slow.