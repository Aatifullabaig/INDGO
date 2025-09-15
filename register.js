// register.js

document.addEventListener('DOMContentLoaded', () => {
    const registerForm = document.getElementById('register-form');
    const registerButton = document.getElementById('register-button');

    if (registerForm) {
        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();

            // Disable button to prevent multiple submissions
            registerButton.disabled = true;
            registerButton.textContent = 'Processing...';

            // Get form values
            const name = document.getElementById('name').value;
            const callsign = document.getElementById('callsign').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            const inviteCode = document.getElementById('invite-code').value;
            const agreement = document.getElementById('agreement').checked;

            // --- Client-Side Validation ---
            if (password !== confirmPassword) {
                showNotification('Passwords do not match.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Create Account';
                return;
            }

            if (!agreement) {
                showNotification('You must agree to the Terms of Service and Privacy Policy.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Create Account';
                return;
            }
            
            try {
                const response = await fetch('https://indgo-backend.onrender.com/api/register', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ 
                        name, 
                        callsign, 
                        email, 
                        password, 
                        inviteCode 
                    }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('authToken', data.token); 
                    
                    showNotification('Registration successful! Welcome aboard. Redirecting...', 'success');
                    
                    // Redirect to the crew center after successful registration
                    setTimeout(() => {
                        window.location.href = 'crew-center.html';
                    }, 2000); 
                } else {
                    showNotification(`Registration Failed: ${data.message}`, 'error');
                    registerButton.disabled = false;
                    registerButton.textContent = 'Create Account';
                }
            } catch (error) {
                console.error('Registration error:', error);
                showNotification('An error occurred. Please try again later.', 'error');
                registerButton.disabled = false;
                registerButton.textContent = 'Create Account';
            }
        });
    }
});