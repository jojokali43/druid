document.addEventListener('DOMContentLoaded', function() {
    // Theme toggle functionality
    const themeToggle = document.getElementById('themeToggle');
    themeToggle.addEventListener('click', () => {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
    });

    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    // Form submission
    document.getElementById('walletForm').addEventListener('submit', async function(e) {
        e.preventDefault();
        
        // Check if terms are agreed
        if (!document.getElementById('agreeTerms').checked) {
            alert('You must acknowledge the security warning before generating keys');
            return;
        }
        
        const mnemonic = document.getElementById('mnemonic').value.trim();
        
        try {
            // Disable button during processing
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = true;
            submitBtn.textContent = 'Generating...';
            
            // Call the backend to generate the wallet
            const response = await fetch('/generate-wallet', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ mnemonic })
            });
            
            if (!response.ok) {
                throw new Error(await response.text());
            }
            
            const { publicKey, secretKey } = await response.json();
            
            // Display results
            document.getElementById('publicKey').value = publicKey;
            document.getElementById('secretKey').value = secretKey;
            document.getElementById('result').classList.remove('hidden');
            
            // Scroll to results
            document.getElementById('result').scrollIntoView({ behavior: 'smooth' });
        } catch (error) {
            alert('Error: ' + error.message);
            console.error('Error:', error);
        } finally {
            // Re-enable button
            const submitBtn = document.getElementById('submitBtn');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Generate Wallet';
        }
    });
});

function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    element.select();
    document.execCommand('copy');
    
    // Show temporary feedback
    const copyBtn = event.target;
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.style.backgroundColor = '#28a745';
    
    setTimeout(() => {
        copyBtn.textContent = originalText;
        copyBtn.style.backgroundColor = '';
    }, 2000);
}