(() => {
    "use strict";

    const STORAGE_KEY = "finstats.wallet.v1";
    const MYSQL_MIGRATION_KEY = "finstats.mysqlMigrated.v1";
    const WALLET_API_URL = "api/wallet.php";
    const WALLETS_API_URL = "api/wallets.php";
    const AUTH_API_URL = "api/auth.php";
    const ACTIVE_WALLET_STORAGE_KEY = "finstats.activeWalletId";
    const THEME_STORAGE_KEY = "finstats.theme";
    const CURRENCY_STORAGE_KEY = "finstats.currency";
    const RATES_STORAGE_KEY = "finstats.exchangeRates.v1";
    const RATES_API_URL = "https://open.er-api.com/v6/latest/USD";
    const SUPPORTED_CURRENCIES = Object.freeze(["USD", "EUR", "UAH"]);
    const CURRENCY_SYMBOLS = Object.freeze({
        USD: "$",
        EUR: "€",
        UAH: "₴"
    });

    restoreTheme();

    function restoreTheme() {
        const allowedThemes = ["white", "black", "blue"];
        let theme = "white";

        try {
            const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            if (allowedThemes.includes(savedTheme)) theme = savedTheme;
        } catch (error) {
            // The default theme remains available when browser storage is blocked.
        }

        document.documentElement.dataset.theme = theme;
    }

    function getSavedCurrency() {
        try {
            const savedCurrency = localStorage.getItem(CURRENCY_STORAGE_KEY);
            return SUPPORTED_CURRENCIES.includes(savedCurrency) ? savedCurrency : "USD";
        } catch (error) {
            return "USD";
        }
    }

    function getSavedWalletId() {
        try {
            const savedWalletId = Number.parseInt(localStorage.getItem(ACTIVE_WALLET_STORAGE_KEY) || "", 10);
            return Number.isSafeInteger(savedWalletId) && savedWalletId > 0 ? savedWalletId : null;
        } catch (error) {
            return null;
        }
    }

    function savePreference(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (error) {
            return false;
        }
    }

    function initializeApp() {
        const currencyFormatters = Object.fromEntries(
            SUPPORTED_CURRENCIES.map((currency) => [
                currency,
                new Intl.NumberFormat("en-US", { style: "currency", currency })
            ])
        );
        const rateFormatter = new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 6
        });
        const dateFormatter = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit"
        });
        const rateDateFormatter = new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
            hour: "numeric",
            minute: "2-digit",
            timeZoneName: "short"
        });

        const elements = {
            form: document.getElementById("transaction-form"),
            operationButtons: document.querySelectorAll("[name='operation']"),
            storageStatus: document.getElementById("storage-status"),
            amount: document.getElementById("amount"),
            amountError: document.getElementById("amount-error"),
            note: document.getElementById("note"),
            balance: document.getElementById("balance"),
            totalAdded: document.getElementById("total-added"),
            totalWithdrawn: document.getElementById("total-withdrawn"),
            transactionCount: document.getElementById("transaction-count"),
            transactionList: document.getElementById("transaction-list"),
            emptyState: document.getElementById("empty-state"),
            clearButton: document.getElementById("clear-button"),
            themeSelect: document.getElementById("theme-select"),
            walletCurrency: document.getElementById("wallet-currency"),
            walletSelect: document.getElementById("wallet-select"),
            newWalletButton: document.getElementById("new-wallet-button"),
            walletSettingsButton: document.getElementById("wallet-settings-button"),
            balanceWalletName: document.getElementById("balance-wallet-name"),
            currencySymbol: document.getElementById("currency-symbol"),
            emptyCurrencySymbol: document.getElementById("empty-currency-symbol"),
            exportButton: document.getElementById("export-button"),
            importButton: document.getElementById("import-button"),
            importFile: document.getElementById("import-file"),
            converterAmount: document.getElementById("converter-amount"),
            converterFrom: document.getElementById("converter-from"),
            converterTo: document.getElementById("converter-to"),
            converterResult: document.getElementById("converter-result"),
            converterRate: document.getElementById("converter-rate"),
            converterError: document.getElementById("converter-error"),
            ratesStatus: document.getElementById("rate-status"),
            refreshRates: document.getElementById("refresh-rates"),
            swapCurrencies: document.getElementById("swap-currencies"),
            currentDate: document.getElementById("current-date"),
            walletDialog: document.getElementById("wallet-dialog"),
            walletForm: document.getElementById("wallet-form"),
            walletDialogTitle: document.getElementById("wallet-dialog-title"),
            walletDialogSubtitle: document.getElementById("wallet-dialog-subtitle"),
            walletName: document.getElementById("wallet-name"),
            walletNameError: document.getElementById("wallet-name-error"),
            walletSaveButton: document.getElementById("wallet-save-button"),
            walletCancelButton: document.getElementById("wallet-cancel-button"),
            walletDeleteButton: document.getElementById("wallet-delete-button"),
            operationDialog: document.getElementById("operation-dialog"),
            operationForm: document.getElementById("operation-form"),
            operationDialogSubtitle: document.getElementById("operation-dialog-subtitle"),
            operationType: document.getElementById("operation-type"),
            operationAmount: document.getElementById("operation-amount"),
            operationAmountError: document.getElementById("operation-error"),
            operationNote: document.getElementById("operation-note"),
            operationCurrencyLabel: document.getElementById("operation-currency-label"),
            operationCurrencySymbol: document.getElementById("operation-currency-symbol"),
            operationSaveButton: document.getElementById("operation-save-button"),
            operationCancelButton: document.getElementById("operation-cancel-button"),
            authOverlay: document.getElementById("auth-overlay"),
            authForm: document.getElementById("auth-form"),
            authTitle: document.getElementById("auth-title"),
            authSubtitle: document.getElementById("auth-subtitle"),
            authUsername: document.getElementById("auth-username"),
            authPassword: document.getElementById("auth-password"),
            authConfirmField: document.getElementById("auth-confirm-field"),
            authConfirm: document.getElementById("auth-confirm"),
            authError: document.getElementById("auth-error"),
            authSubmit: document.getElementById("auth-submit"),
            authRecoveryField: document.getElementById("auth-recovery-field"),
            authRecovery: document.getElementById("auth-recovery"),
            authPasswordLabel: document.getElementById("auth-password-label"),
            authForgotLink: document.getElementById("auth-forgot-link"),
            authSwitchLink: document.getElementById("auth-switch-link"),
            accountButton: document.getElementById("account-button"),
            accountDialog: document.getElementById("account-dialog"),
            accountSubtitle: document.getElementById("account-subtitle"),
            accountCurrent: document.getElementById("account-current"),
            accountNew: document.getElementById("account-new"),
            accountConfirm: document.getElementById("account-confirm"),
            accountError: document.getElementById("account-error"),
            accountCloseButton: document.getElementById("account-close-button"),
            accountPasswordButton: document.getElementById("account-password-button"),
            accountRecoveryStatus: document.getElementById("account-recovery-status"),
            accountRecoveryButton: document.getElementById("account-recovery-button"),
            accountRecoveryCode: document.getElementById("account-recovery-code"),
            accountRecoveryNote: document.getElementById("account-recovery-note"),
            accountDeleteButton: document.getElementById("account-delete-button"),
            logoutButton: document.getElementById("logout-button"),
            toast: document.getElementById("toast")
        };

        let transactions = [];
        let walletTotals = { balanceCents: 0, addedCents: 0, withdrawnCents: 0 };
        let wallets = [];
        let activeWalletId = getSavedWalletId();
        let activeWalletName = "";
        let walletDialogMode = "create";
        let editingOperationId = null;
        let authMode = "login";
        let currentUsername = "";
        let currentHasRecovery = false;
        let isWalletReady = false;
        let isWalletBusy = true;
        let displayCurrency = getSavedCurrency();
        let exchangeRates = { USD: 1 };
        let ratesUpdatedAt = null;
        let ratesFromCache = false;
        let ratesRequestFailed = false;
        let isRefreshingRates = false;
        let toastTimer;

        elements.walletCurrency.value = displayCurrency;
        elements.themeSelect.value = document.documentElement.dataset.theme;
        loadCachedRates();

        function isValidTransaction(transaction) {
            return transaction &&
                typeof transaction.id === "string" &&
                (transaction.type === "deposit" || transaction.type === "withdrawal") &&
                Number.isSafeInteger(transaction.amountCents) &&
                transaction.amountCents > 0 &&
                typeof transaction.note === "string" &&
                typeof transaction.date === "string" &&
                !Number.isNaN(Date.parse(transaction.date));
        }

        function isValidWallet(wallet) {
            return wallet &&
                Number.isSafeInteger(wallet.id) &&
                wallet.id > 0 &&
                typeof wallet.name === "string" &&
                wallet.name.trim().length > 0 &&
                Number.isSafeInteger(wallet.balanceCents) &&
                wallet.balanceCents >= 0;
        }

        function loadLocalTransactions() {
            try {
                const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
                return Array.isArray(savedData) ? savedData.filter(isValidTransaction) : [];
            } catch (error) {
                return [];
            }
        }

        function hasMigratedLocalTransactions() {
            try {
                return localStorage.getItem(MYSQL_MIGRATION_KEY) === "1";
            } catch (error) {
                return false;
            }
        }

        function markLocalTransactionsMigrated() {
            savePreference(MYSQL_MIGRATION_KEY, "1");
        }

        async function requestJson(url, method, body) {
            const options = {
                method,
                cache: "no-store",
                headers: { Accept: "application/json" }
            };
            if (body !== undefined) {
                options.headers["Content-Type"] = "application/json";
                options.body = JSON.stringify(body);
            }

            const response = await fetch(url, options);
            let data;
            try {
                data = await response.json();
            } catch (error) {
                throw new Error("The server returned an invalid response. Open the app through XAMPP, not as a file.");
            }
            if (!response.ok) {
                if (response.status === 401 && url !== AUTH_API_URL) {
                    showAuthOverlay("login");
                }
                throw new Error(data?.error || `Wallet request failed with status ${response.status}.`);
            }
            return data;
        }

        function walletApiUrl(walletId) {
            return `${WALLET_API_URL}?walletId=${encodeURIComponent(String(walletId))}`;
        }

        function apiRequest(method, body) {
            return requestJson(walletApiUrl(activeWalletId), method, body);
        }

        function setWalletStatus(message, isError = false) {
            elements.storageStatus.textContent = message;
            elements.storageStatus.classList.toggle("error", isError);
        }

        function updateWalletControls() {
            elements.operationButtons.forEach((button) => {
                button.disabled = isWalletBusy || !isWalletReady;
            });
            elements.clearButton.disabled = isWalletBusy || !isWalletReady || transactions.length === 0;
            elements.walletSelect.disabled = isWalletBusy || !isWalletReady || wallets.length === 0;
            elements.newWalletButton.disabled = isWalletBusy || !isWalletReady;
            elements.importButton.disabled = isWalletBusy || !isWalletReady;
            elements.walletSettingsButton.disabled = isWalletBusy || !isWalletReady;
            elements.transactionList.querySelectorAll(".transaction-action-button").forEach((button) => {
                button.disabled = isWalletBusy || !isWalletReady;
            });
        }

        function applyWallet(data) {
            if (!data || !Number.isSafeInteger(data.wallet?.id) || typeof data.wallet?.name !== "string") {
                throw new Error("The server returned invalid wallet details.");
            }
            if (!Array.isArray(data.operations) || !data.operations.every(isValidTransaction)) {
                throw new Error("The server returned invalid wallet operations.");
            }

            const totals = [data.balanceCents, data.totalAddedCents, data.totalWithdrawnCents];
            if (!totals.every((value) => Number.isSafeInteger(value) && value >= 0)) {
                throw new Error("The server returned an invalid wallet balance.");
            }

            activeWalletId = data.wallet.id;
            activeWalletName = data.wallet.name;
            savePreference(ACTIVE_WALLET_STORAGE_KEY, String(activeWalletId));

            transactions = data.operations;
            walletTotals = {
                balanceCents: data.balanceCents,
                addedCents: data.totalAddedCents,
                withdrawnCents: data.totalWithdrawnCents
            };

            const walletSummary = {
                id: activeWalletId,
                name: activeWalletName,
                balanceCents: data.balanceCents
            };
            const walletIndex = wallets.findIndex((wallet) => wallet.id === activeWalletId);
            if (walletIndex === -1) {
                wallets.push(walletSummary);
            } else {
                wallets[walletIndex] = walletSummary;
            }

            renderWalletSelect();
            render();
        }

        function renderWalletSelect() {
            const activeValue = activeWalletId === null ? "" : String(activeWalletId);
            const fragment = document.createDocumentFragment();

            wallets.forEach((wallet) => {
                const option = document.createElement("option");
                option.value = String(wallet.id);
                option.textContent = wallet.name;
                fragment.appendChild(option);
            });

            elements.walletSelect.replaceChildren(fragment);
            if (activeValue) elements.walletSelect.value = activeValue;
        }

        async function refreshWalletList(preferredWalletId = activeWalletId) {
            const data = await requestJson(WALLETS_API_URL, "GET");
            const loadedWallets = Array.isArray(data?.wallets) ? data.wallets.filter(isValidWallet) : [];
            if (loadedWallets.length === 0) {
                throw new Error("No wallets are available. Import database.sql first.");
            }

            wallets = loadedWallets;
            const activeWallet = wallets.find((wallet) => wallet.id === preferredWalletId) || wallets[0];
            activeWalletId = activeWallet.id;
            activeWalletName = activeWallet.name;
            savePreference(ACTIVE_WALLET_STORAGE_KEY, String(activeWalletId));
            renderWalletSelect();
        }

        async function loadWallet() {
            isWalletBusy = true;
            isWalletReady = false;
            updateWalletControls();
            setWalletStatus(`Loading "${activeWalletName || "wallet"}"…`);

            try {
                let data = await apiRequest("GET");
                const localTransactions = loadLocalTransactions();
                if (Array.isArray(data.operations) && data.operations.length === 0 &&
                    localTransactions.length > 0 && !hasMigratedLocalTransactions()) {
                    setWalletStatus("Moving existing browser transactions to MySQL…");
                    data = await apiRequest("POST", {
                        action: "import",
                        walletId: activeWalletId,
                        operations: [...localTransactions].reverse()
                    });
                }

                applyWallet(data);
                markLocalTransactionsMigrated();
                isWalletReady = true;
                setWalletStatus(`Connected to MySQL. "${activeWalletName}" is saved on this server.`);
            } catch (error) {
                transactions = [];
                walletTotals = { balanceCents: 0, addedCents: 0, withdrawnCents: 0 };
                setWalletStatus(error.message, true);
                showToast("Wallet data could not be loaded from MySQL.");
            } finally {
                isWalletBusy = false;
                updateWalletControls();
                render();
            }
        }

        async function initializeWallets() {
            isWalletBusy = true;
            isWalletReady = false;
            updateWalletControls();
            setWalletStatus("Connecting to MySQL…");

            try {
                await refreshWalletList();
                await loadWallet();
            } catch (error) {
                wallets = [];
                activeWalletId = null;
                activeWalletName = "";
                transactions = [];
                walletTotals = { balanceCents: 0, addedCents: 0, withdrawnCents: 0 };
                isWalletReady = false;
                isWalletBusy = false;
                renderWalletSelect();
                updateWalletControls();
                setWalletStatus(error.message, true);
                showToast("Wallets could not be loaded from MySQL.");
                render();
            }
        }

        function isValidRate(rate) {
            return typeof rate === "number" && Number.isFinite(rate) && rate > 0;
        }

        function hasRate(currency) {
            return isValidRate(exchangeRates[currency]);
        }

        function loadCachedRates() {
            try {
                const cachedRates = JSON.parse(localStorage.getItem(RATES_STORAGE_KEY) || "null");
                if (!cachedRates || cachedRates.baseCurrency !== "USD" || !cachedRates.rates) return;
                if (!isValidRate(cachedRates.rates.EUR) || !isValidRate(cachedRates.rates.UAH)) return;
                if (Number.isNaN(Date.parse(cachedRates.updatedAt))) return;

                exchangeRates = {
                    USD: 1,
                    EUR: cachedRates.rates.EUR,
                    UAH: cachedRates.rates.UAH
                };
                ratesUpdatedAt = new Date(cachedRates.updatedAt).toISOString();
                ratesFromCache = true;
            } catch (error) {
                // Live rates can still be requested when cached data is unavailable.
            }
        }

        function saveCachedRates() {
            try {
                localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify({
                    baseCurrency: "USD",
                    rates: exchangeRates,
                    updatedAt: ratesUpdatedAt
                }));
            } catch (error) {
                // Rates remain usable for this page view when storage is blocked.
            }
        }

        function getApiTimestamp(data) {
            const parsedUtc = Date.parse(data.time_last_update_utc);
            const unixTimestamp = Number(data.time_last_update_unix) * 1000;
            const timestamp = Number.isNaN(parsedUtc) ? unixTimestamp : parsedUtc;
            const updatedAt = new Date(timestamp || Date.now());
            return Number.isNaN(updatedAt.getTime()) ? new Date().toISOString() : updatedAt.toISOString();
        }

        function updateRatesUI() {
            const currencySelects = [
                elements.walletCurrency,
                elements.converterFrom,
                elements.converterTo
            ];
            currencySelects.forEach((select) => {
                Array.from(select.options).forEach((option) => {
                    option.disabled = !hasRate(option.value);
                });
            });

            elements.refreshRates.disabled = isRefreshingRates;
            elements.refreshRates.textContent = isRefreshingRates ? "Refreshing…" : "Refresh rates";
            elements.ratesStatus.classList.toggle("error", ratesRequestFailed);

            const updatedText = ratesUpdatedAt ? rateDateFormatter.format(new Date(ratesUpdatedAt)) : "";
            if (isRefreshingRates) {
                elements.ratesStatus.textContent = ratesUpdatedAt
                    ? `Refreshing live rates… Last updated ${updatedText}.`
                    : "Loading live exchange rates…";
            } else if (ratesRequestFailed && ratesUpdatedAt) {
                elements.ratesStatus.textContent = `Refresh failed. Using last successful rates · Last updated ${updatedText}.`;
            } else if (ratesRequestFailed) {
                elements.ratesStatus.textContent = "Live rates are unavailable. Check your connection and select Refresh rates.";
            } else if (ratesUpdatedAt) {
                const rateType = ratesFromCache ? "Cached rates" : "Live rates";
                elements.ratesStatus.textContent = `${rateType} · Last updated ${updatedText}.`;
            } else {
                elements.ratesStatus.textContent = "Loading live exchange rates…";
            }
        }

        async function refreshLiveRates(showConfirmation = false) {
            if (isRefreshingRates) return;

            isRefreshingRates = true;
            ratesRequestFailed = false;
            updateRatesUI();
            updateConverter();

            const controller = new AbortController();
            const timeoutId = window.setTimeout(() => controller.abort(), 10000);

            try {
                const response = await fetch(RATES_API_URL, {
                    signal: controller.signal,
                    cache: "no-store"
                });
                if (!response.ok) throw new Error(`Rate request failed with status ${response.status}.`);

                const data = await response.json();
                if (data.result !== "success" || data.base_code !== "USD" ||
                    !isValidRate(data.rates?.EUR) || !isValidRate(data.rates?.UAH)) {
                    throw new Error("The rate response is incomplete or invalid.");
                }

                exchangeRates = {
                    USD: 1,
                    EUR: data.rates.EUR,
                    UAH: data.rates.UAH
                };
                ratesUpdatedAt = getApiTimestamp(data);
                ratesFromCache = false;
                saveCachedRates();
                if (showConfirmation) showToast("Live exchange rates updated.");
            } catch (error) {
                ratesRequestFailed = true;
                if (showConfirmation) {
                    showToast(ratesUpdatedAt
                        ? "Could not refresh rates. The last successful rates are still in use."
                        : "Could not load live exchange rates.");
                }
            } finally {
                window.clearTimeout(timeoutId);
                isRefreshingRates = false;
                updateRatesUI();
                updateConverter();
                render();
            }
        }

        function calculateTotals() {
            return walletTotals;
        }

        function fromUsdCents(amountCents, targetCurrency) {
            if (!hasRate(targetCurrency)) return null;
            return Math.round(amountCents * exchangeRates[targetCurrency]);
        }

        function toUsdCents(amountCents, sourceCurrency) {
            if (!hasRate(sourceCurrency)) return null;
            return Math.round(amountCents / exchangeRates[sourceCurrency]);
        }

        function toMajorUnits(minorUnits) {
            return minorUnits === null ? null : minorUnits / 100;
        }

        function formatCurrency(usdCents, currency = displayCurrency) {
            const convertedCents = fromUsdCents(usdCents, currency);
            if (convertedCents === null) return "—";
            return currencyFormatters[currency].format(convertedCents / 100);
        }

        function parseAmount(value) {
            const normalizedValue = value.trim().replace(",", ".");
            if (!/^(?:\d+|\d*\.\d{1,2})$/.test(normalizedValue)) {
                return { error: "Enter a valid amount with up to two decimal places." };
            }

            const amountCents = Math.round(Number(normalizedValue) * 100);
            if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
                return { error: "Enter an amount greater than zero." };
            }

            return { amountCents };
        }

        function createTransactionItem(transaction) {
            const item = document.createElement("li");
            item.className = "transaction-item";

            const icon = document.createElement("span");
            const isDeposit = transaction.type === "deposit";
            icon.className = `transaction-icon${isDeposit ? "" : " withdrawal"}`;
            icon.setAttribute("aria-hidden", "true");
            icon.textContent = isDeposit ? "↗" : "↙";

            const details = document.createElement("div");
            details.className = "transaction-details";

            const note = document.createElement("p");
            note.className = "transaction-note";
            note.textContent = transaction.note || (isDeposit ? "Wallet deposit" : "Wallet withdrawal");
            note.title = note.textContent;

            const date = document.createElement("time");
            date.className = "transaction-date";
            date.dateTime = transaction.date;
            date.textContent = dateFormatter.format(new Date(transaction.date));

            const amount = document.createElement("strong");
            amount.className = `transaction-amount${isDeposit ? "" : " withdrawal"}`;
            amount.textContent = `${isDeposit ? "+" : "−"}${formatCurrency(transaction.amountCents)}`;

            const actions = document.createElement("div");
            actions.className = "transaction-actions-row";

            const editButton = document.createElement("button");
            editButton.type = "button";
            editButton.className = "transaction-action-button";
            editButton.dataset.action = "edit";
            editButton.dataset.id = transaction.id;
            editButton.title = "Edit this transaction";
            editButton.setAttribute("aria-label", `Edit ${isDeposit ? "deposit" : "withdrawal"} of ${formatCurrency(transaction.amountCents)}`);
            editButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

            const deleteButton = document.createElement("button");
            deleteButton.type = "button";
            deleteButton.className = "transaction-action-button danger";
            deleteButton.dataset.action = "delete";
            deleteButton.dataset.id = transaction.id;
            deleteButton.title = "Delete this transaction";
            deleteButton.setAttribute("aria-label", `Delete ${isDeposit ? "deposit" : "withdrawal"} of ${formatCurrency(transaction.amountCents)}`);
            deleteButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>';

            actions.append(editButton, deleteButton);
            details.append(note, date);
            item.append(icon, details, amount, actions);
            return item;
        }

        function render() {
            const totals = calculateTotals();
            elements.balance.textContent = formatCurrency(totals.balanceCents);
            elements.balanceWalletName.textContent = activeWalletName || "Wallet";
            elements.totalAdded.textContent = formatCurrency(totals.addedCents);
            elements.totalWithdrawn.textContent = formatCurrency(totals.withdrawnCents);
            elements.transactionCount.textContent = String(transactions.length);
            updateWalletControls();
            elements.emptyState.hidden = transactions.length > 0;
            elements.currencySymbol.textContent = CURRENCY_SYMBOLS[displayCurrency];
            elements.emptyCurrencySymbol.textContent = CURRENCY_SYMBOLS[displayCurrency];

            const fragment = document.createDocumentFragment();
            transactions.forEach((transaction) => {
                fragment.appendChild(createTransactionItem(transaction));
            });
            elements.transactionList.replaceChildren(fragment);
        }

        function showToast(message) {
            window.clearTimeout(toastTimer);
            elements.toast.textContent = message;
            elements.toast.classList.add("visible");
            toastTimer = window.setTimeout(() => {
                elements.toast.classList.remove("visible");
            }, 3200);
        }

        function showAmountError(message) {
            elements.amountError.textContent = message;
            elements.amount.setAttribute("aria-invalid", "true");
            elements.amount.focus();
        }

        function clearAmountError() {
            elements.amountError.textContent = "";
            elements.amount.removeAttribute("aria-invalid");
        }

        function updateConverter() {
            const sourceCurrency = elements.converterFrom.value;
            const targetCurrency = elements.converterTo.value;

            if (!hasRate(sourceCurrency) || !hasRate(targetCurrency)) {
                elements.converterResult.textContent = "—";
                elements.converterRate.textContent = isRefreshingRates
                    ? "Loading live exchange rates…"
                    : "Live exchange rates are unavailable.";
                elements.converterError.textContent = isRefreshingRates
                    ? ""
                    : "Refresh live rates to enable this conversion.";
                elements.converterAmount.removeAttribute("aria-invalid");
                return;
            }

            const conversionRate = exchangeRates[targetCurrency] / exchangeRates[sourceCurrency];
            const parsedAmount = parseAmount(elements.converterAmount.value);
            elements.converterRate.textContent = `1 ${sourceCurrency} = ${rateFormatter.format(conversionRate)} ${targetCurrency}`;

            if (parsedAmount.error) {
                elements.converterResult.textContent = "—";
                elements.converterError.textContent = parsedAmount.error;
                elements.converterAmount.setAttribute("aria-invalid", "true");
                return;
            }

            const convertedAmount = (parsedAmount.amountCents / 100) * conversionRate;
            elements.converterResult.textContent = currencyFormatters[targetCurrency].format(convertedAmount);
            elements.converterError.textContent = "";
            elements.converterAmount.removeAttribute("aria-invalid");
        }

        function exportJson() {
            const totals = calculateTotals();
            const result = {
                application: "FinStats",
                wallet: {
                    id: activeWalletId,
                    name: activeWalletName
                },
                currency: displayCurrency,
                baseCurrency: "USD",
                exchangeRates,
                ratesUpdatedAt,
                ratesSource: RATES_API_URL,
                ratesFromCache,
                exportedAt: new Date().toISOString(),
                summary: {
                    currentBalance: toMajorUnits(fromUsdCents(totals.balanceCents, displayCurrency)),
                    totalAdded: toMajorUnits(fromUsdCents(totals.addedCents, displayCurrency)),
                    totalWithdrawn: toMajorUnits(fromUsdCents(totals.withdrawnCents, displayCurrency)),
                    currentBalanceUsd: totals.balanceCents / 100,
                    totalAddedUsd: totals.addedCents / 100,
                    totalWithdrawnUsd: totals.withdrawnCents / 100,
                    transactionCount: transactions.length
                },
                transactions: transactions.map((transaction) => ({
                    id: transaction.id,
                    type: transaction.type,
                    amount: toMajorUnits(fromUsdCents(transaction.amountCents, displayCurrency)),
                    currency: displayCurrency,
                    amountUsd: transaction.amountCents / 100,
                    note: transaction.note,
                    date: transaction.date
                }))
            };

            const jsonFile = new Blob([JSON.stringify(result, null, 2)], { type: "application/json" });
            const downloadUrl = URL.createObjectURL(jsonFile);
            const downloadLink = document.createElement("a");
            downloadLink.href = downloadUrl;
            downloadLink.download = "wallet-result.json";
            document.body.appendChild(downloadLink);
            downloadLink.click();
            downloadLink.remove();
            window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
            showToast("Wallet result exported as wallet-result.json");
        }

        function importedAmountCents(entry, data) {
            if (Number.isFinite(entry.amountUsd) && entry.amountUsd > 0) {
                return Math.round(entry.amountUsd * 100);
            }
            if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
                throw new Error("Each imported transaction needs a positive amount.");
            }

            const currency = entry.currency || data.currency || "USD";
            const amountCents = Math.round(entry.amount * 100);
            if (currency === "USD") return amountCents;

            const rate = isValidRate(data.exchangeRates?.[currency])
                ? data.exchangeRates[currency]
                : (hasRate(currency) ? exchangeRates[currency] : null);
            if (rate === null) {
                throw new Error(`No exchange rate available to import ${currency} amounts.`);
            }
            return Math.round(amountCents / rate);
        }

        function parseImportedTransactions(data) {
            if (!data || typeof data !== "object" || !Array.isArray(data.transactions)) {
                throw new Error("This file is not a FinStats export: missing transactions list.");
            }
            if (data.transactions.length === 0) {
                throw new Error("The file contains no transactions.");
            }
            if (data.transactions.length > 5000) {
                throw new Error("The file contains more than 5000 transactions.");
            }

            const transactionKey = (type, amountCents, note, date) =>
                `${type}|${amountCents}|${note}|${Date.parse(date)}`;
            const existing = new Set(transactions.map((transaction) =>
                transactionKey(transaction.type, transaction.amountCents, transaction.note, transaction.date)));
            const operations = [];
            let skipped = 0;

            data.transactions.forEach((entry, index) => {
                if (!entry || (entry.type !== "deposit" && entry.type !== "withdrawal")) {
                    throw new Error(`Transaction ${index + 1} has an invalid type.`);
                }
                const amountCents = importedAmountCents(entry, data);
                if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
                    throw new Error(`Transaction ${index + 1} has an invalid amount.`);
                }
                if (typeof entry.date !== "string" || Number.isNaN(Date.parse(entry.date))) {
                    throw new Error(`Transaction ${index + 1} has an invalid date.`);
                }
                const note = typeof entry.note === "string" ? entry.note : "";
                if (existing.has(transactionKey(entry.type, amountCents, note, entry.date))) {
                    skipped += 1;
                    return;
                }
                operations.push({ type: entry.type, amountCents, note, date: entry.date });
            });

            return { operations, skipped };
        }

        async function importJsonFile(file) {
            let data;
            try {
                data = JSON.parse(await file.text());
            } catch (error) {
                showToast("The selected file is not valid JSON.");
                return;
            }

            let parsed;
            try {
                parsed = parseImportedTransactions(data);
            } catch (error) {
                showToast(error.message);
                return;
            }

            const { operations, skipped } = parsed;
            if (operations.length === 0) {
                showToast("All transactions from this file are already in this wallet.");
                return;
            }

            const netCents = operations.reduce(
                (sum, operation) => sum + (operation.type === "deposit" ? operation.amountCents : -operation.amountCents),
                0
            );
            const confirmed = window.confirm(
                `Import ${operations.length} transaction${operations.length === 1 ? "" : "s"} into "${activeWalletName}"? ` +
                `Balance change: ${netCents < 0 ? "−" : "+"}${formatCurrency(Math.abs(netCents))}.` +
                (skipped > 0 ? ` ${skipped} duplicate${skipped === 1 ? "" : "s"} skipped.` : "")
            );
            if (!confirmed) return;

            isWalletBusy = true;
            updateWalletControls();
            setWalletStatus("Importing transactions to MySQL…");

            try {
                const payload = await apiRequest("POST", {
                    action: "import",
                    walletId: activeWalletId,
                    operations: [...operations].reverse()
                });
                applyWallet(payload);
                setWalletStatus(`Connected to MySQL. "${activeWalletName}" is saved on this server.`);
                showToast(`Imported ${operations.length} transaction${operations.length === 1 ? "" : "s"} into "${activeWalletName}".`);
            } catch (error) {
                setWalletStatus("The import was not saved. " + error.message, true);
                showToast(error.message);
            } finally {
                isWalletBusy = false;
                updateWalletControls();
            }
        }

        function showAuthOverlay(mode) {
            authMode = mode;
            const signup = mode === "signup";
            const forgot = mode === "forgot";
            elements.authTitle.textContent = signup ? "Create your account" : (forgot ? "Reset password" : "Sign in");
            elements.authSubtitle.textContent = signup
                ? "Pick a username and password. Your wallets stay private to your account."
                : (forgot
                    ? "Enter your username, recovery code, and a new password."
                    : "Enter your credentials to access your wallets.");
            elements.authConfirmField.hidden = !(signup || forgot);
            elements.authRecoveryField.hidden = !forgot;
            elements.authPasswordLabel.textContent = (signup || forgot) ? "New password" : "Password";
            elements.authPassword.autocomplete = (signup || forgot) ? "new-password" : "current-password";
            elements.authSubmit.textContent = signup ? "Create account" : (forgot ? "Set new password" : "Sign in");
            elements.authSwitchLink.textContent = signup ? "Sign in instead" : (forgot ? "Back to sign in" : "Create an account");
            elements.authForgotLink.hidden = mode !== "login";
            elements.authError.textContent = "";
            elements.authSubmit.disabled = false;
            elements.authOverlay.hidden = false;
            elements.logoutButton.hidden = true;
            elements.accountButton.hidden = true;
            elements.authUsername.focus();
        }

        function hideAuthOverlay() {
            elements.authOverlay.hidden = true;
            elements.logoutButton.hidden = false;
            elements.accountButton.hidden = false;
        }

        async function startAuthenticatedApp() {
            hideAuthOverlay();
            await initializeWallets();
            refreshLiveRates();
        }

        async function checkAuth() {
            try {
                const data = await requestJson(AUTH_API_URL, "GET");
                currentUsername = data.username || "";
                currentHasRecovery = Boolean(data.hasRecoveryCode);
                if (!data.authenticated && data.needsSetup) {
                    showAuthOverlay("signup");
                } else if (!data.authenticated) {
                    showAuthOverlay("login");
                } else {
                    await startAuthenticatedApp();
                }
            } catch (error) {
                showAuthOverlay("login");
                elements.authError.textContent = error.message;
            }
        }

        elements.authForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            elements.authError.textContent = "";

            const username = elements.authUsername.value.trim();
            const password = elements.authPassword.value;
            if (!username) {
                elements.authError.textContent = "Enter your username.";
                elements.authUsername.focus();
                return;
            }
            if (!password) {
                elements.authError.textContent = "Enter your password.";
                elements.authPassword.focus();
                return;
            }
            if (authMode === "signup" || authMode === "forgot") {
                if (password.length < 8) {
                    elements.authError.textContent = "Password must be at least 8 characters.";
                    elements.authPassword.focus();
                    return;
                }
                if (password !== elements.authConfirm.value) {
                    elements.authError.textContent = "Passwords do not match.";
                    elements.authConfirm.focus();
                    return;
                }
            }
            if (authMode === "forgot") {
                const recoveryCode = elements.authRecovery.value.trim();
                if (!recoveryCode) {
                    elements.authError.textContent = "Enter your recovery code.";
                    elements.authRecovery.focus();
                    return;
                }

                elements.authSubmit.disabled = true;
                try {
                    await requestJson(AUTH_API_URL, "POST", {
                        action: "forgot_password",
                        username,
                        newPassword: password,
                        recoveryCode
                    });
                    elements.authForm.reset();
                    showAuthOverlay("login");
                    elements.authUsername.value = username;
                    showToast("Password updated. Sign in with your new password.");
                } catch (error) {
                    elements.authError.textContent = error.message;
                } finally {
                    elements.authSubmit.disabled = false;
                }
                return;
            }

            elements.authSubmit.disabled = true;
            try {
                const data = await requestJson(AUTH_API_URL, "POST", {
                    action: authMode,
                    username,
                    password
                });
                currentUsername = data.username || username;
                currentHasRecovery = Boolean(data.hasRecoveryCode);
                elements.authForm.reset();
                await startAuthenticatedApp();
                showToast(authMode === "signup"
                    ? "Account created. Your wallets are private to your account."
                    : `Signed in as ${data.username}.`);
            } catch (error) {
                elements.authError.textContent = error.message;
            } finally {
                elements.authSubmit.disabled = false;
            }
        });

        elements.authForgotLink.addEventListener("click", () => showAuthOverlay("forgot"));
        elements.authSwitchLink.addEventListener("click", () => {
            showAuthOverlay(authMode === "login" ? "signup" : "login");
        });

        function resetSignedOutState() {
            transactions = [];
            walletTotals = { balanceCents: 0, addedCents: 0, withdrawnCents: 0 };
            wallets = [];
            activeWalletId = null;
            activeWalletName = "";
            currentUsername = "";
            currentHasRecovery = false;
            isWalletReady = false;
            renderWalletSelect();
            render();
        }

        elements.logoutButton.addEventListener("click", async () => {
            try {
                await requestJson(AUTH_API_URL, "POST", { action: "logout" });
            } catch (error) {
                // The local session is cleared below even when the server is unreachable.
            }
            resetSignedOutState();
            setWalletStatus("Signed out.");
            showAuthOverlay("login");
            showToast("Signed out.");
        });

        function openAccountDialog() {
            elements.accountSubtitle.textContent =
                `Signed in as ${currentUsername}. Manage your password and account security.`;
            elements.accountCurrent.value = "";
            elements.accountNew.value = "";
            elements.accountConfirm.value = "";
            elements.accountError.textContent = "";
            elements.accountRecoveryCode.hidden = true;
            elements.accountRecoveryNote.hidden = true;
            elements.accountRecoveryStatus.textContent = currentHasRecovery
                ? "A recovery code is active. Generating a new one replaces it."
                : "No recovery code yet. Generate one to reset your password if you forget it.";
            elements.accountDialog.showModal();
            elements.accountCurrent.focus();
        }

        elements.accountButton.addEventListener("click", openAccountDialog);
        elements.accountCloseButton.addEventListener("click", () => elements.accountDialog.close());
        elements.accountDialog.addEventListener("click", (event) => {
            if (event.target === elements.accountDialog) elements.accountDialog.close();
        });

        elements.accountPasswordButton.addEventListener("click", async () => {
            elements.accountError.textContent = "";
            const currentPassword = elements.accountCurrent.value;
            const newPassword = elements.accountNew.value;
            if (!currentPassword) {
                elements.accountError.textContent = "Enter your current password.";
                elements.accountCurrent.focus();
                return;
            }
            if (newPassword.length < 8) {
                elements.accountError.textContent = "New password must be at least 8 characters.";
                elements.accountNew.focus();
                return;
            }
            if (newPassword !== elements.accountConfirm.value) {
                elements.accountError.textContent = "New passwords do not match.";
                elements.accountConfirm.focus();
                return;
            }

            elements.accountPasswordButton.disabled = true;
            try {
                await requestJson(AUTH_API_URL, "POST", {
                    action: "change_password",
                    currentPassword,
                    newPassword
                });
                elements.accountCurrent.value = "";
                elements.accountNew.value = "";
                elements.accountConfirm.value = "";
                showToast("Password changed.");
            } catch (error) {
                elements.accountError.textContent = error.message;
            } finally {
                elements.accountPasswordButton.disabled = false;
            }
        });

        elements.accountRecoveryButton.addEventListener("click", async () => {
            elements.accountError.textContent = "";
            const password = elements.accountCurrent.value;
            if (!password) {
                elements.accountError.textContent = "Enter your current password to generate a recovery code.";
                elements.accountCurrent.focus();
                return;
            }

            elements.accountRecoveryButton.disabled = true;
            try {
                const data = await requestJson(AUTH_API_URL, "POST", { action: "recovery_code", password });
                currentHasRecovery = true;
                elements.accountRecoveryCode.textContent = data.recoveryCode;
                elements.accountRecoveryCode.hidden = false;
                elements.accountRecoveryNote.hidden = false;
                elements.accountRecoveryStatus.textContent =
                    "A recovery code is active. Generating a new one replaces it.";
                showToast("Recovery code generated. Save it now — it is shown only once.");
            } catch (error) {
                elements.accountError.textContent = error.message;
            } finally {
                elements.accountRecoveryButton.disabled = false;
            }
        });

        elements.accountDeleteButton.addEventListener("click", async () => {
            elements.accountError.textContent = "";
            const password = elements.accountCurrent.value;
            if (!password) {
                elements.accountError.textContent = "Enter your current password to delete your account.";
                elements.accountCurrent.focus();
                return;
            }
            const confirmed = window.confirm(
                `Delete the account "${currentUsername}"? All of its wallets and transactions will be permanently removed. This cannot be undone.`
            );
            if (!confirmed) return;

            elements.accountDeleteButton.disabled = true;
            try {
                await requestJson(AUTH_API_URL, "POST", { action: "delete_account", password });
                elements.accountDialog.close();
                resetSignedOutState();
                setWalletStatus("Account deleted.");
                showAuthOverlay("login");
                showToast("Account deleted.");
            } catch (error) {
                elements.accountError.textContent = error.message;
            } finally {
                elements.accountDeleteButton.disabled = false;
            }
        });

        elements.form.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearAmountError();
            if (isWalletBusy || !isWalletReady) return;

            const operation = event.submitter ? event.submitter.value : "";
            if (operation !== "deposit" && operation !== "withdrawal") return;

            const parsedAmount = parseAmount(elements.amount.value);
            if (parsedAmount.error) {
                showAmountError(parsedAmount.error);
                return;
            }

            if (!hasRate(displayCurrency)) {
                showAmountError(isRefreshingRates
                    ? "Please wait for the live exchange rates to load."
                    : "Live rates are unavailable. Refresh rates before using this currency.");
                return;
            }

            const amountUsdCents = toUsdCents(parsedAmount.amountCents, displayCurrency);
            if (!Number.isSafeInteger(amountUsdCents) || amountUsdCents <= 0) {
                showAmountError("The amount is too small or too large for the selected currency.");
                return;
            }

            const totals = calculateTotals();
            if (operation === "withdrawal" && amountUsdCents > totals.balanceCents) {
                showAmountError(`Insufficient funds. Available balance: ${formatCurrency(totals.balanceCents)}.`);
                return;
            }

            isWalletBusy = true;
            updateWalletControls();
            setWalletStatus("Saving operation to MySQL…");

            try {
                const data = await apiRequest("POST", {
                    walletId: activeWalletId,
                    type: operation,
                    amountCents: amountUsdCents,
                    note: elements.note.value.trim()
                });
                applyWallet(data);
                markLocalTransactionsMigrated();
                elements.form.reset();
                elements.amount.focus();
                setWalletStatus(`Connected to MySQL. "${activeWalletName}" is saved on this server.`);
                showToast(`${operation === "deposit" ? "Funds added to" : "Funds withdrawn from"} "${activeWalletName}" and saved to MySQL.`);
            } catch (error) {
                setWalletStatus("The operation was not saved. " + error.message, true);
                showAmountError(error.message);
            } finally {
                isWalletBusy = false;
                updateWalletControls();
            }
        });

        elements.amount.addEventListener("input", clearAmountError);

        elements.walletCurrency.addEventListener("change", () => {
            const previousCurrency = displayCurrency;
            const parsedAmount = parseAmount(elements.amount.value);
            displayCurrency = elements.walletCurrency.value;

            if (!parsedAmount.error && hasRate(previousCurrency) && hasRate(displayCurrency)) {
                const convertedAmount = (parsedAmount.amountCents / 100) *
                    (exchangeRates[displayCurrency] / exchangeRates[previousCurrency]);
                elements.amount.value = convertedAmount.toFixed(2);
            }

            savePreference(CURRENCY_STORAGE_KEY, displayCurrency);
            clearAmountError();
            render();
            showToast(`Wallet currency set to ${displayCurrency}.`);
        });

        elements.clearButton.addEventListener("click", async () => {
            if (!transactions.length || isWalletBusy || !isWalletReady) return;
            const confirmed = window.confirm(
                `Clear all transactions in "${activeWalletName}"? This will reset this wallet's balance to zero.`
            );
            if (!confirmed) return;

            isWalletBusy = true;
            updateWalletControls();
            setWalletStatus("Clearing operations in MySQL…");

            try {
                const data = await apiRequest("DELETE");
                applyWallet(data);
                markLocalTransactionsMigrated();
                setWalletStatus(`Connected to MySQL. "${activeWalletName}" is saved on this server.`);
                showToast(`History cleared for "${activeWalletName}".`);
            } catch (error) {
                setWalletStatus("The history was not cleared. " + error.message, true);
                showToast("Could not clear the wallet in MySQL.");
            } finally {
                isWalletBusy = false;
                updateWalletControls();
            }
        });

        function showOperationError(message) {
            elements.operationAmountError.textContent = message;
            elements.operationAmount.setAttribute("aria-invalid", "true");
            elements.operationAmount.focus();
        }

        function clearOperationError() {
            elements.operationAmountError.textContent = "";
            elements.operationAmount.removeAttribute("aria-invalid");
        }

        function openOperationDialog(transaction) {
            if (isWalletBusy || !isWalletReady) return;

            editingOperationId = transaction.id;
            clearOperationError();
            elements.operationType.value = transaction.type;
            elements.operationNote.value = transaction.note;
            elements.operationCurrencyLabel.textContent = `(${displayCurrency})`;
            elements.operationCurrencySymbol.textContent = CURRENCY_SYMBOLS[displayCurrency];
            elements.operationDialogSubtitle.textContent =
                `${dateFormatter.format(new Date(transaction.date))} · The balance updates automatically when you save.`;
            elements.operationSaveButton.disabled = false;

            const displayCents = fromUsdCents(transaction.amountCents, displayCurrency);
            elements.operationAmount.value = displayCents === null ? "" : (displayCents / 100).toFixed(2);
            elements.operationDialog.showModal();
            elements.operationAmount.select();
        }

        elements.operationAmount.addEventListener("input", clearOperationError);
        elements.operationCancelButton.addEventListener("click", () => elements.operationDialog.close());
        elements.operationDialog.addEventListener("click", (event) => {
            if (event.target === elements.operationDialog) elements.operationDialog.close();
        });

        elements.operationForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearOperationError();

            const transaction = transactions.find((entry) => entry.id === editingOperationId);
            if (!transaction) {
                elements.operationDialog.close();
                showToast("This transaction is no longer in the list.");
                return;
            }

            const parsedAmount = parseAmount(elements.operationAmount.value);
            if (parsedAmount.error) {
                showOperationError(parsedAmount.error);
                return;
            }
            if (!hasRate(displayCurrency)) {
                showOperationError(isRefreshingRates
                    ? "Please wait for the live exchange rates to load."
                    : "Live rates are unavailable. Refresh rates before using this currency.");
                return;
            }

            const amountUsdCents = toUsdCents(parsedAmount.amountCents, displayCurrency);
            if (!Number.isSafeInteger(amountUsdCents) || amountUsdCents <= 0) {
                showOperationError("The amount is too small or too large for the selected currency.");
                return;
            }

            const type = elements.operationType.value;
            const oldEffect = transaction.type === "deposit" ? transaction.amountCents : -transaction.amountCents;
            const newEffect = type === "deposit" ? amountUsdCents : -amountUsdCents;
            const newBalance = walletTotals.balanceCents - oldEffect + newEffect;
            if (newBalance < 0) {
                showOperationError(`This change would make the balance negative. Available balance: ${formatCurrency(walletTotals.balanceCents)}.`);
                return;
            }

            elements.operationSaveButton.disabled = true;
            try {
                const data = await apiRequest("PATCH", {
                    walletId: activeWalletId,
                    operationId: editingOperationId,
                    type,
                    amountCents: amountUsdCents,
                    note: elements.operationNote.value.trim()
                });
                applyWallet(data);
                elements.operationDialog.close();
                setWalletStatus(`Connected to MySQL. "${activeWalletName}" is saved on this server.`);
                showToast("Transaction updated.");
            } catch (error) {
                if (elements.operationDialog.open) {
                    showOperationError(error.message);
                } else {
                    showToast(error.message);
                }
            } finally {
                elements.operationSaveButton.disabled = false;
            }
        });

        elements.transactionList.addEventListener("click", async (event) => {
            const button = event.target.closest(".transaction-action-button");
            if (!button || button.disabled || isWalletBusy || !isWalletReady) return;

            const transaction = transactions.find((entry) => entry.id === button.dataset.id);
            if (!transaction) return;

            if (button.dataset.action === "edit") {
                openOperationDialog(transaction);
                return;
            }

            const isDeposit = transaction.type === "deposit";
            const confirmed = window.confirm(
                `Delete this ${isDeposit ? "deposit" : "withdrawal"} of ${formatCurrency(transaction.amountCents)}? The wallet balance will be updated. This cannot be undone.`
            );
            if (!confirmed) return;

            isWalletBusy = true;
            updateWalletControls();
            setWalletStatus("Deleting transaction in MySQL…");

            try {
                const data = await requestJson(
                    `${walletApiUrl(activeWalletId)}&operationId=${encodeURIComponent(transaction.id)}`,
                    "DELETE"
                );
                applyWallet(data);
                setWalletStatus(`Connected to MySQL. "${activeWalletName}" is saved on this server.`);
                showToast("Transaction deleted.");
            } catch (error) {
                setWalletStatus("The transaction was not deleted. " + error.message, true);
                showToast(error.message);
            } finally {
                isWalletBusy = false;
                updateWalletControls();
            }
        });

        function showWalletNameError(message) {
            elements.walletNameError.textContent = message;
            elements.walletName.setAttribute("aria-invalid", "true");
            elements.walletName.focus();
        }

        function clearWalletNameError() {
            elements.walletNameError.textContent = "";
            elements.walletName.removeAttribute("aria-invalid");
        }

        function openWalletDialog(mode) {
            if (isWalletBusy || !isWalletReady) return;

            walletDialogMode = mode;
            const editing = mode === "edit";
            clearWalletNameError();
            elements.walletDialogTitle.textContent = editing ? "Rename wallet" : "New wallet";
            elements.walletDialogSubtitle.textContent = editing
                ? "Choose a new name for this wallet."
                : "Create another wallet with its own balance and transactions.";
            elements.walletName.value = editing ? activeWalletName : "";
            elements.walletSaveButton.textContent = editing ? "Save name" : "Create wallet";
            elements.walletSaveButton.disabled = false;
            elements.walletDeleteButton.hidden = !editing;
            elements.walletDeleteButton.disabled = wallets.length <= 1;
            elements.walletDeleteButton.title = wallets.length <= 1
                ? "At least one wallet must remain."
                : "Delete this wallet and all of its transactions";
            elements.walletDialog.showModal();
            elements.walletName.select();
        }

        elements.walletSelect.addEventListener("change", async () => {
            if (isWalletBusy) {
                elements.walletSelect.value = activeWalletId === null ? "" : String(activeWalletId);
                return;
            }

            const selectedWallet = wallets.find(
                (wallet) => String(wallet.id) === elements.walletSelect.value
            );
            if (!selectedWallet || selectedWallet.id === activeWalletId) return;

            activeWalletId = selectedWallet.id;
            activeWalletName = selectedWallet.name;
            savePreference(ACTIVE_WALLET_STORAGE_KEY, String(activeWalletId));
            await loadWallet();
            if (isWalletReady) showToast(`Switched to "${selectedWallet.name}".`);
        });

        elements.newWalletButton.addEventListener("click", () => openWalletDialog("create"));
        elements.walletSettingsButton.addEventListener("click", () => openWalletDialog("edit"));
        elements.walletCancelButton.addEventListener("click", () => elements.walletDialog.close());
        elements.walletName.addEventListener("input", clearWalletNameError);
        elements.walletDialog.addEventListener("click", (event) => {
            if (event.target === elements.walletDialog) elements.walletDialog.close();
        });

        elements.walletForm.addEventListener("submit", async (event) => {
            event.preventDefault();
            clearWalletNameError();

            const name = elements.walletName.value.trim().replace(/\s+/g, " ");
            if (!name) {
                showWalletNameError("Enter a wallet name.");
                return;
            }
            if (name.length > 60) {
                showWalletNameError("Wallet name cannot exceed 60 characters.");
                return;
            }

            const editing = walletDialogMode === "edit";
            elements.walletSaveButton.disabled = true;

            try {
                const response = editing
                    ? await requestJson(
                        `${WALLETS_API_URL}?id=${encodeURIComponent(String(activeWalletId))}`,
                        "PATCH",
                        { name }
                    )
                    : await requestJson(WALLETS_API_URL, "POST", { name });
                const targetWalletId = editing ? activeWalletId : response?.wallet?.id;
                if (!Number.isSafeInteger(targetWalletId)) {
                    throw new Error("The server returned an invalid wallet.");
                }

                await refreshWalletList(targetWalletId);
                elements.walletDialog.close();
                await loadWallet();
                if (isWalletReady) {
                    showToast(editing ? `Wallet renamed to "${name}".` : `Wallet "${name}" created.`);
                }
            } catch (error) {
                if (elements.walletDialog.open) {
                    showWalletNameError(error.message);
                } else {
                    showToast(error.message);
                }
            } finally {
                elements.walletSaveButton.disabled = false;
            }
        });

        elements.walletDeleteButton.addEventListener("click", async () => {
            if (wallets.length <= 1) return;

            const confirmed = window.confirm(
                `Delete "${activeWalletName}" and all of its transactions? This cannot be undone.`
            );
            if (!confirmed) return;

            elements.walletDeleteButton.disabled = true;
            try {
                await requestJson(
                    `${WALLETS_API_URL}?id=${encodeURIComponent(String(activeWalletId))}`,
                    "DELETE"
                );
                elements.walletDialog.close();
                await refreshWalletList();
                await loadWallet();
                if (isWalletReady) showToast("Wallet deleted.");
            } catch (error) {
                if (elements.walletDialog.open) {
                    showWalletNameError(error.message);
                } else {
                    showToast(error.message);
                }
                elements.walletDeleteButton.disabled = false;
            }
        });

        elements.themeSelect.addEventListener("change", () => {
            const selectedTheme = elements.themeSelect.value;
            document.documentElement.dataset.theme = selectedTheme;
            savePreference(THEME_STORAGE_KEY, selectedTheme);
            showToast(`${elements.themeSelect.selectedOptions[0].textContent} theme applied.`);
        });

        elements.converterAmount.addEventListener("input", updateConverter);
        elements.converterFrom.addEventListener("change", updateConverter);
        elements.converterTo.addEventListener("change", updateConverter);
        elements.swapCurrencies.addEventListener("click", () => {
            const sourceCurrency = elements.converterFrom.value;
            elements.converterFrom.value = elements.converterTo.value;
            elements.converterTo.value = sourceCurrency;
            updateConverter();
        });
        elements.refreshRates.addEventListener("click", () => refreshLiveRates(true));
        elements.exportButton.addEventListener("click", exportJson);
        elements.importButton.addEventListener("click", () => {
            if (isWalletBusy || !isWalletReady) return;
            elements.importFile.click();
        });
        elements.importFile.addEventListener("change", () => {
            const file = elements.importFile.files[0];
            elements.importFile.value = "";
            if (file) importJsonFile(file);
        });

        elements.currentDate.textContent = new Intl.DateTimeFormat("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            year: "numeric"
        }).format(new Date());

        updateRatesUI();
        updateConverter();
        render();
        checkAuth();
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeApp, { once: true });
    } else {
        initializeApp();
    }
})();
