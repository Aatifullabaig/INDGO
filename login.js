// login.js (Updated with Global Routes from VA Map)

document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.getElementById('login-form');

    // --- Animated Greeting with Language Cycling (UPDATED) ---
    const translations = {
        'en': ["Let's fly higher ", "IN"],
        'ar': ["لنحلق أعلى ", "IN"],
        'he': ["בואו נטוס גבוה יותר ", "IN"],
        'hi': ["चलो ऊंची उड़ान भरें ", "IN"],
        'bn': ["चলো আরও উঁচুতে উড়ি ", "IN"],
        'mr': ["चला आणखी उंच उडूया ", "IN"],        // FIXED
        'te': ["మనం మరింత ఎత్తుకు ఎగురుదాం ", "IN"],     // FIXED
        'ta': ["நாம் இன்னும் உயரமாக பறப்போம் ", "IN"], // FIXED
        'zh': ["让我们飞得更高 ", "IN"],
        'ja': ["より高く飛びましょう ", "IN"],
        'ko': ["더 높이 날자 ", "IN"],
        'th': ["เรามาบินให้สูงขึ้นกันเถอะ ", "IN"],   // FIXED
        'vi': ["Chúng ta hãy bay cao hơn nữa ", "IN"], // FIXED
        'id': ["Mari terbang lebih tinggi ", "IN"],
        'tr': ["Daha yükseğe uçalım ", "IN"],
        'sw': ["Tupae juu zaidi ", "IN"],
        'ru': ["Полетим выше ", "IN"]
    };
    const languages = Object.keys(translations);
    let currentLangIndex = 0;
    const greetingElement = document.getElementById('animated-greeting');
    
    // --- NEW (1/2): Variable to store the interval ID ---
    let greetingInterval;

    function changeGreeting() {
        const langKey = languages[currentLangIndex];
        const greeting = translations[langKey];
        
        if (greetingElement) {
            greetingElement.style.opacity = '0';

            // --- RTL/LTR Direction Handling (Unchanged) ---
            // Sets direction based on the language key
            if (langKey === 'ar' || langKey === 'he') {
                greetingElement.setAttribute('dir', 'rtl');
            } else {
                greetingElement.setAttribute('dir', 'ltr');
            }

            setTimeout(() => {
                greetingElement.innerHTML = `${greeting[0]}<span class="highlight">${greeting[1]}</span>`;
                greetingElement.style.opacity = '1';
                currentLangIndex = (currentLangIndex + 1) % languages.length;
            }, 400); 
        }
    }
    // Initial call
    changeGreeting();
    // --- NEW (2/2): Store the interval ID when it's created ---
    greetingInterval = setInterval(changeGreeting, 3500); 

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

                    // --- NEW: Stop the greeting cycler immediately on success ---
                    clearInterval(greetingInterval);
                    
                    // 2-Stage Success Animation ("Cover")
                    const loginContainer = document.querySelector('.login-container');
                    
                    if (loginContainer) {
                        // Stage 1: Fade out form, expand branding side
                        loginContainer.classList.add('success-anim-start');
                        
                        // Stage 2: Wait for Stage 1, then fade out the whole card
                        setTimeout(() => {
                            loginContainer.classList.add('success-anim-end');
                        }, 800); // 800ms delay
                    }
                    
                    // Set final timeout for redirect
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