// login.js (Updated for Universal Redirection)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // --- Login Form Submission Logic ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            try {
                const response = await fetch('https://site--indgo-backend--6dmjph8ltlhv.code.run/api/login', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    localStorage.setItem('authToken', data.token); 
                    
                    showNotification('Login successful! Redirecting...', 'success');
                    
                    // ALL users are now redirected to the crew center
                    setTimeout(() => {
                        window.location.href = 'crew-center.html';
                    }, 1500); 
                } else {
                    showNotification(`Login Failed: ${data.message}`, 'error');
                }
            } catch (error) {
                console.error('Login error:', error);
                showNotification('An error occurred. Please try again later.', 'error');
            }
        });
    }

    // --- Password Visibility Toggle Logic ---
    const togglePassword = document.getElementById('togglePassword');
    const passwordInput = document.getElementById('password');
    const eyeOpen = document.getElementById('eye-open');
    const eyeClosed = document.getElementById('eye-closed');

    if (togglePassword && passwordInput && eyeOpen && eyeClosed) {
        togglePassword.addEventListener('click', () => {
            const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
            passwordInput.setAttribute('type', type);

            if (type === 'password') {
                eyeOpen.style.display = 'block';
                eyeClosed.style.display = 'none';
            } else {
                eyeOpen.style.display = 'none';
                eyeClosed.style.display = 'block';
            }
        });
    }
});