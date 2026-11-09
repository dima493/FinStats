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

        function showAuthOverlay(mode) {
            authMode = mode;
            const setup = mode === "setup";
            elements.authTitle.textContent = setup ? "Create your account" : "Sign in";
            elements.authSubtitle.textContent = setup
                ? "Set a username and password to protect your wallets."
                : "Enter your credentials to access your wallets.";
            elements.authConfirmField.hidden = !setup;
            elements.authPassword.autocomplete = setup ? "new-password" : "current-password";
            elements.authSubmit.textContent = setup ? "Create account" : "Sign in";
            elements.authError.textContent = "";
            elements.authSubmit.disabled = false;
            elements.authOverlay.hidden = false;
            elements.logoutButton.hidden = true;
            elements.authUsername.focus();
        }

        function hideAuthOverlay() {
            elements.authOverlay.hidden = true;
            elements.logoutButton.hidden = false;
        }

        async function startAuthenticatedApp() {
            hideAuthOverlay();
            await initializeWallets();
            refreshLiveRates();
        }

        async function checkAuth() {
            try {
                const data = await requestJson(AUTH_API_URL, "GET");
                if (data.needsSetup) {
                    showAuthOverlay("setup");
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
            if (authMode === "setup") {
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

            elements.authSubmit.disabled = true;
            try {
                const data = await requestJson(AUTH_API_URL, "POST", {
                    action: authMode,
                    username,
                    password
                });
                elements.authForm.reset();
                await startAuthenticatedApp();
                showToast(authMode === "setup"
                    ? "Account created. Your wallets are now protected."
                    : `Signed in as ${data.username}.`);
            } catch (error) {
                elements.authError.textContent = error.message;
            } finally {
                elements.authSubmit.disabled = false;
            }
        });

        elements.logoutButton.addEventListener("click", async () => {
            try {
                await requestJson(AUTH_API_URL, "POST", { action: "logout" });
            } catch (error) {
                // The local session is cleared below even when the server is unreachable.
            }
            transactions = [];
            walletTotals = { balanceCents: 0, addedCents: 0, withdrawnCents: 0 };
            wallets = [];
            isWalletReady = false;
            renderWalletSelect();
            render();
            setWalletStatus("Signed out.");
            showAuthOverlay("login");
            showToast("Signed out.");
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
