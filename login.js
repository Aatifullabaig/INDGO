// login.js (Updated for Universal Redirection, Animation, and Remember Me)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // --- NEW: Animated Greeting with Internationalization (i18n) ---
    
    // 1. Define translations
    // The text is split to style "IN" separately
    const translations = {
        'en': ["Let's fly higher ", "IN"], // English (Default)
        'es': ["Volemos más alto ", "IN"], // Spanish
        'fr': ["Volons plus haut ", "IN"], // French
        'de': ["Fliegen wir höher ", "IN"]  // German
    };

    // 2. Get browser language
    // 'en-US' becomes 'en'
    const userLang = navigator.language.split('-')[0]; 
    
    // 3. Select translation (default to 'en' if lang not found)
    const greeting = translations[userLang] || translations['en'];

    // 4. Set the HTML
    const greetingElement = document.getElementById('animated-greeting');
    if (greetingElement) {
        // We use innerHTML to add the <span> for styling
        greetingElement.innerHTML = `${greeting[0]}<span class="highlight">${greeting[1]}</span>`;
    }

    // --- Login Form Submission Logic ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            // UPDATED: Get the "Remember Me" checkbox status
            const rememberMe = document.getElementById('remember-me').checked;
            
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
                    
                    // --- UPDATED: "Remember Me" Logic ---
                    if (rememberMe) {
                        // localStorage persists after the browser is closed
                        localStorage.setItem('authToken', data.token); 
                    } else {
                        // sessionStorage is cleared when the browser is closed
                        sessionStorage.setItem('authToken', data.token);
                    }
                    
                    showNotification('Login successful! Redirecting...', 'success');
                    
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

    // --- Password Visibility Toggle Logic (Unchanged) ---
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