document.addEventListener('DOMContentLoaded', () => {
    async function fetchMonitoringData() {
        try {
            const res = await fetch('/monitor-status');
            const data = await res.json();

            const monitoringList = document.getElementById('monitoringList');
            const logsDiv = document.getElementById('logs');

            monitoringList.innerHTML = '<h2>Currently Monitoring Wallets:</h2>';
            if (data.wallets.length === 0) {
                monitoringList.innerHTML += '<p>No wallets are being monitored currently.</p>';
            } else {
                const ul = document.createElement('ul');
                data.wallets.forEach(wallet => {
                    const li = document.createElement('li');
                    li.textContent = `Wallet: ${wallet.publicKey} | Balance: ${wallet.balance} Pi`;
                    ul.appendChild(li);
                });
                monitoringList.appendChild(ul);
            }

            logsDiv.innerHTML = '';
            data.logs.forEach(log => {
                const p = document.createElement('p');
                p.textContent = `[${new Date(log.timestamp).toLocaleTimeString()}] ${log.message}`;
                p.className = log.status;
                logsDiv.appendChild(p);
            });

        } catch (error) {
            console.error('Failed to fetch monitoring data', error);
        }
    }

    // Poll monitoring data every 5 seconds
    setInterval(fetchMonitoringData, 5000);
    fetchMonitoringData();
});
