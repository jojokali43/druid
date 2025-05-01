const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const session = require('express-session');
const bcrypt = require('bcrypt');
const StellarSdk = require('stellar-sdk');
const axios = require('axios');
const bip39 = require('bip39');
const ed25519 = require('ed25519-hd-key');

const app = express();

// Credentials: admin / admin123 (hashed below)
const loginUser = 'admin';
const loginPasswordHash = '$2b$10$SbVQ.ggOnK4FYkgqxcAQJOAsHF3ksi7tZCqIfaVRJzbpiCjXh76xy'; // admin123


// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(session({
    secret: 'yourSuperSecretKeyHere',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 30 * 60 * 1000 // 30 mins
    }
}));

// Auth Middleware (before static files)
app.use((req, res, next) => {
    const publicPaths = ['/login', '/logout', '/login.html'];
    if (publicPaths.includes(req.path) || req.path.startsWith('/assets')) return next();
    if (req.session.loggedIn) return next();
    if (req.path === '/' || req.path === '/index.html') return res.redirect('/login.html');
    return res.redirect('/login.html');
});

// Serve static files
app.use(express.static('public'));

// Stellar setup
const server = new StellarSdk.Server('https://api.mainnet.minepi.com');
let monitoredWallets = [];
let monitoringInterval = null;
let transferLogs = [];

// Generate Wallet
async function generateWalletFromMnemonic(mnemonic) {
    if (!mnemonic) throw new Error('Mnemonic is required');
    if (!bip39.validateMnemonic(mnemonic)) throw new Error('Invalid mnemonic');
    const seed = await bip39.mnemonicToSeed(mnemonic);
    const { key } = ed25519.derivePath("m/44'/314159'/0'", seed.toString('hex'));
    const keypair = StellarSdk.Keypair.fromRawEd25519Seed(key);
    return { publicKey: keypair.publicKey(), secretKey: keypair.secret() };
}

// Execute Transfer
async function executeTransfer(senderSecret, recipient, customAmount = null) {
    try {
        const senderKeypair = StellarSdk.Keypair.fromSecret(senderSecret);
        const senderPublic = senderKeypair.publicKey();
        const account = await server.loadAccount(senderPublic);
        const fee = (await server.fetchBaseFee()).toString();
        const res = await axios.get(`https://api.mainnet.minepi.com/accounts/${senderPublic}`);
        const nativeBalance = res.data.balances.find(b => b.asset_type === 'native').balance;
        const availableBalance = Number(nativeBalance) - 2;

        const amountToSend = customAmount ? Math.min(Number(customAmount), availableBalance) : availableBalance;
        if (amountToSend <= 0) throw new Error('Insufficient balance to transfer.');

        const tx = new StellarSdk.TransactionBuilder(account, { fee, networkPassphrase: 'Pi Network' })
            .addOperation(StellarSdk.Operation.payment({
                destination: recipient,
                asset: StellarSdk.Asset.native(),
                amount: amountToSend.toFixed(7)
            }))
            .setTimeout(30)
            .build();

        tx.sign(senderKeypair);
        const result = await server.submitTransaction(tx);
        return { status: 'success', message: `✅ Sent ${amountToSend.toFixed(7)} Pi successfully!`, hash: result.hash };
    } catch (error) {
        console.error('Transfer error:', error.message);
        return { status: 'error', message: `❌ Transfer failed: ${error.message}` };
    }
}

// Monitor Functions
function startMonitoring() {
    if (monitoringInterval) return;
    monitoringInterval = setInterval(async () => {
        for (let wallet of monitoredWallets) {
            try {
                const res = await axios.get(`https://api.mainnet.minepi.com/accounts/${wallet.publicKey}`);
                const nativeBalance = res.data.balances.find(b => b.asset_type === 'native').balance;
                const currentBalance = parseFloat(nativeBalance);
                if (currentBalance > wallet.lastBalance) {
                    const result = await executeTransfer(wallet.senderSecret, wallet.recipient, wallet.customAmount);
                    wallet.lastBalance = currentBalance;
                    transferLogs.push({ timestamp: new Date(), message: `[${wallet.publicKey}] → ${wallet.recipient}: ${result.message}`, status: result.status });
                } else {
                    wallet.lastBalance = currentBalance;
                }
            } catch (err) {
                console.error('Monitoring error:', err.message);
            }
        }
    }, 2000);
}

function stopMonitoring() {
    if (monitoringInterval) {
        clearInterval(monitoringInterval);
        monitoringInterval = null;
        monitoredWallets = [];
    }
}

// ========================== API ROUTES ==========================

app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    if (username === loginUser && await bcrypt.compare(password, loginPasswordHash)) {
        req.session.loggedIn = true;
        return res.json({ success: true });
    }
    res.json({ success: false });
});

app.post('/logout', (req, res) => {
    req.session.destroy(err => {
        if (err) return res.status(500).json({ success: false });
        res.clearCookie('connect.sid');
        res.json({ success: true });
    });
});

app.post('/generate-wallet', async (req, res) => {
    try {
        const { mnemonic } = req.body;
        const wallet = await generateWalletFromMnemonic(mnemonic);
        res.json(wallet);
    } catch (err) {
        res.status(400).json({ error: err.message });
    }
});

app.post('/start-monitoring', async (req, res) => {
    const { senderSecret, recipient, customAmount } = req.body;
    try {
        const keypair = StellarSdk.Keypair.fromSecret(senderSecret);
        const senderPublic = keypair.publicKey();
        const resBalance = await axios.get(`https://api.mainnet.minepi.com/accounts/${senderPublic}`);
        const nativeBalance = resBalance.data.balances.find(b => b.asset_type === 'native').balance;
        monitoredWallets.push({ senderSecret, publicKey: senderPublic, recipient, customAmount, lastBalance: parseFloat(nativeBalance) });
        startMonitoring();
        res.json({ status: 'success', message: `📡 Started monitoring wallet ${senderPublic}` });
    } catch (err) {
        res.status(400).json({ status: 'error', message: '❌ Invalid Secret or cannot load wallet.' });
    }
});

app.post('/withdraw-now', async (req, res) => {
    const { senderSecret, recipient, customAmount } = req.body;
    const result = await executeTransfer(senderSecret, recipient, customAmount);
    res.json(result);
});

app.post('/stop-monitoring', (req, res) => {
    stopMonitoring();
    res.json({ status: 'success', message: '🛑 Monitoring stopped for all wallets' });
});

app.get('/monitor-status', (req, res) => {
    res.json({
        wallets: monitoredWallets.map(w => ({ publicKey: w.publicKey, balance: w.lastBalance })),
        logs: transferLogs
    });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
