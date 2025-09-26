document.addEventListener('DOMContentLoaded', () => {
    // --- START: Existing code to handle invite links ---
    // This logic remains useful and runs once at the start.
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCodeFromUrl = urlParams.get('invite');
    const inviteInput = document.getElementById('invite-code');

    if (inviteCodeFromUrl && inviteInput) {
        inviteInput.value = inviteCodeFromUrl;
        inviteInput.setAttribute('readonly', true);
    }
    // --- END: Invite link code ---

    const registerForm = document.getElementById('register-form');
    const nextButtons = document.querySelectorAll('.next-btn');
    const backButtons = document.querySelectorAll('.back-btn');
    const formSteps = document.querySelectorAll('.form-step');
    const stepIndicators = document.querySelectorAll('.step-indicator');
    const progressBarFill = document.querySelector('.progress-bar-line-fill');

    let currentStep = 1;

    // --- Navigation Logic ---
    nextButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (validateStep(currentStep)) {
                currentStep++;
                updateFormUI();
            }
        });
    });

    backButtons.forEach(button => {
        button.addEventListener('click', () => {
            currentStep--;
            updateFormUI();
        });
    });

    // --- UI Update Function ---
    function updateFormUI() {
        // Update form step visibility
        formSteps.forEach(step => {
            step.classList.remove('active');
            if (parseInt(step.dataset.step) === currentStep) {
                step.classList.add('active');
            }
        });

        // Update progress bar
        stepIndicators.forEach((indicator, index) => {
            if (index + 1 < currentStep) {
                indicator.classList.add('active');
            } else if (index + 1 === currentStep) {
                indicator.classList.add('active');
            } else {
                indicator.classList.remove('active');
            }
        });
        
        // Update progress bar line
        const progressPercentage = ((currentStep - 1) / (formSteps.length - 1)) * 100;
        progressBarFill.style.width = `${progressPercentage}%`;
    }

    // --- Validation Logic ---
    function validateStep(step) {
        let isValid = true;
        const inputs = formSteps[step - 1].querySelectorAll('input[required]');

        inputs.forEach(input => {
            if (!input.value.trim()) {
                showNotification(`Please fill out the ${input.previousElementSibling.textContent} field.`, 'error');
                isValid = false;
            } else if (input.type === 'email' && !/\S+@\S+\.\S+/.test(input.value)) {
                showNotification('Please enter a valid email address.', 'error');
                isValid = false;
            }
        });
        
        // Special validation for step 2 (passwords)
        if (step === 2) {
            const password = document.getElementById('password').value;
            const confirmPassword = document.getElementById('confirm-password').value;
            if (password.length < 6) {
                showNotification('Password must be at least 6 characters.', 'error');
                isValid = false;
            } else if (password !== confirmPassword) {
                showNotification('Passwords do not match.', 'error');
                isValid = false;
            }
        }
        
        // Special validation for step 4 (agreement)
        if (step === 4) {
             const agreement = document.getElementById('agreement').checked;
             if (!agreement) {
                 showNotification('You must agree to the Terms of Service and Privacy Policy.', 'error');
                 isValid = false;
             }
        }

        return isValid;
    }

    // --- Form Submission Logic ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        // Final validation check
        if (!validateStep(4)) return;

        const registerButton = document.getElementById('register-button');
        registerButton.disabled = true;
        registerButton.textContent = 'Processing...';

        // Collect all data from the form
        const name = document.getElementById('name').value;
        const ifcUsername = document.getElementById('ifc-username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const callsign = document.getElementById('callsign').value;
        const inviteCode = document.getElementById('invite-code').value;

        try {
            // IMPORTANT: You may need to update your backend to accept the 'ifcUsername' field.
            const response = await fetch('https://indgo-backend.onrender.com/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    ifcUsername, // New field added
                    email,
                    password,
                    callsign,
                    inviteCode
                }),
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('authToken', data.token);
                showNotification('Registration successful! Welcome aboard. Redirecting...', 'success');
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
    
    // Assume showNotification is a global function or defined elsewhere
    // If not, here is a sample implementation using Toastify.js
    function showNotification(message, type) {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top", // `top` or `bottom`
            position: "right", // `left`, `center` or `right`
            backgroundColor: type === 'success' ? "linear-gradient(to right, #00b09b, #96c93d)" : "linear-gradient(to right, #ff5f6d, #ffc371)",
        }).showToast();
    }
});