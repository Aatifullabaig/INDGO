// login.js (Updated with Success Animation)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // --- Animated Greeting with Language Cycling (Unchanged) ---
    
    // 1. Define translations
    const translations = {
        'en': ["Let's fly higher ", "IN"], // English
        'es': ["Volemos más alto ", "IN"], // Spanish
        'fr': ["Volons plus haut ", "IN"], // French
        'de': ["Fliegen wir höher ", "IN"]  // German
    };

    const languages = Object.keys(translations); // ['en', 'es', 'fr', 'de']
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

    // 1. Set the initial greeting immediately
    changeGreeting();
    
    // 2. Set an interval to change it every 3.5 seconds
    setInterval(changeGreeting, 3500); 

    // --- Login Form Submission Logic (Includes "Remember Me") ---
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
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
                    
                    // "Remember Me" Logic
                    if (rememberMe) {
                        localStorage.setItem('authToken', data.token); 
                    } else {
                        sessionStorage.setItem('authToken', data.token);
                    }
                    
                    showNotification('Login successful! Redirecting...', 'success');
                    
                    // --- UPDATED: Trigger Success Animation ---
                    // 1. Find the main login card
                    const loginContainer = document.querySelector('.login-container');
                    if (loginContainer) {
                        // 2. Add the animation class (defined in login.html)
                        loginContainer.classList.add('success-animation');
                    }
                    
                    // 3. Set timeout for redirect (gives animation time to play)
                    setTimeout(() => {
                        window.location.href = 'crew-center.html';
                    }, 1500); // 1.5s total delay. Animation takes 0.8s.
                
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