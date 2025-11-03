// login.js (Updated with 2-Stage "Expand" Animation)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // --- Animated Greeting with Language Cycling (Unchanged) ---
    const translations = {
        'en': ["Let's fly higher ", "IN"], 'es': ["Volemos más alto ", "IN"],
        'fr': ["Volons plus haut ", "IN"], 'de': ["Fliegen wir höher ", "IN"]
    };
    const languages = Object.keys(translations);
    let currentLangIndex = 0;
    const greetingElement = document.getElementById('animated-greeting');

    function changeGreeting() {
        const langKey = languages[currentLangIndex];
        const greeting = translations[langKey];
        if (greetingElement) {
            greetingElement.style.opacity = '0';
            setTimeout(() => {
                greetingElement.innerHTML = `${greeting[0]}<span class="highlight">${greeting[1]}</span>`;
                greetingElement.style.opacity = '1';
                currentLangIndex = (currentLangIndex + 1) % languages.length;
            }, 400); 
        }
    }
    changeGreeting();
    setInterval(changeGreeting, 3500); 

    // --- Login Form Submission Logic ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('remember-me').checked;
            
            try {
                const response = await fetch('https://site--indgo-backend--6dmjph8ltlhv.code.run/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                });

                const data = await response.json();

                if (response.ok) {
                    // "Remember Me" Logic
                    if (rememberMe) {
                        localStorage.setItem('authToken', data.token); 
                    } else {
                        sessionStorage.setItem('authToken', data.token);
                    }
                    
                    showNotification('Login successful! Redirecting...', 'success');
                    
                    // --- UPDATED: 2-Stage Success Animation ---
                    const loginContainer = document.querySelector('.login-container');
                    
                    if (loginContainer) {
                        // Stage 1: Fade out form, expand branding side
                        loginContainer.classList.add('success-anim-start');
                        
                        // Stage 2: Wait for Stage 1, then fade out the whole card
                        setTimeout(() => {
                            loginContainer.classList.add('success-anim-end');
                        }, 800); // 800ms delay for Stage 1 to play
                    }
                    
                    // Set final timeout for redirect (must be > total animation time)
                    setTimeout(() => {
                        window.location.href = 'crew-center.html';
                    }, 1500); // 1.5s total delay
                
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