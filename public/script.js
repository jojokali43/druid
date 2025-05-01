// This script.js is browser-safe (no require())
document.addEventListener('DOMContentLoaded', () => {
    const addMonitorBtn = document.getElementById('addMonitorBtn');
    const withdrawNowBtn = document.getElementById('withdrawNowBtn');
    const stopMonitorBtn = document.getElementById('stopMonitorBtn');
    const outputDiv = document.getElementById('output');
    let monitoring = false;
    let monitoringInterval;

    if (addMonitorBtn) {
        addMonitorBtn.addEventListener('click', async () => {
            const senderSecret = document.getElementById('senderSecret').value.trim();
            const recipient = document.getElementById('recipient').value.trim();
            const customAmount = document.getElementById('customAmount').value.trim() || null;

            if (!senderSecret || !recipient) {
                appendOutput('❌ Please fill in both secret key and recipient address.', 'error');
                return;
            }

            try {
                const response = await fetch('/start-monitoring', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senderSecret, recipient, customAmount })
                });

                const result = await response.json();
                appendOutput(result.message, result.status);

                if (!monitoring) {
                    startMonitoring();
                }
            } catch (error) {
                console.error(error);
                appendOutput('❌ Failed to start monitoring.', 'error');
            }
        });
    }

    if (withdrawNowBtn) {
        withdrawNowBtn.addEventListener('click', async () => {
            const senderSecret = document.getElementById('senderSecret').value.trim();
            const recipient = document.getElementById('recipient').value.trim();
            const customAmount = document.getElementById('customAmount').value.trim() || null;

            if (!senderSecret || !recipient) {
                appendOutput('❌ Please fill in both secret key and recipient address.', 'error');
                return;
            }

            try {
                const response = await fetch('/withdraw-now', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ senderSecret, recipient, customAmount })
                });

                const result = await response.json();
                appendOutput(result.message, result.status);
            } catch (error) {
                console.error(error);
                appendOutput('❌ Immediate withdrawal failed.', 'error');
            }
        });
    }

    if (stopMonitorBtn) {
        stopMonitorBtn.addEventListener('click', async () => {
            try {
                const response = await fetch('/stop-monitoring', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });

                const result = await response.json();
                appendOutput(result.message, result.status);
                stopMonitoring();
            } catch (error) {
                console.error(error);
                appendOutput('❌ Failed to stop monitoring.', 'error');
            }
        });
    }

    function startMonitoring() {
        monitoring = true;
        monitoringInterval = setInterval(async () => {
            try {
                const res = await fetch('/monitor-status');
                const data = await res.json();
                if (data.newTransfer) {
                    appendOutput(data.newTransfer.message, data.newTransfer.status);
                }
            } catch (error) {
                console.error('Monitoring error:', error);
            }
        }, 2000);
    }

    function stopMonitoring() {
        monitoring = false;
        if (monitoringInterval) {
            clearInterval(monitoringInterval);
        }
    }

    function appendOutput(message, type = 'info') {
        const p = document.createElement('p');
        p.innerHTML = `[${new Date().toLocaleTimeString()}] ${message}`;
        p.className = type;
        outputDiv.appendChild(p);
        outputDiv.scrollTop = outputDiv.scrollHeight;
    }
});
