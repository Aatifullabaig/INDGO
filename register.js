document.addEventListener('DOMContentLoaded', () => {
    // --- START: Existing code to handle invite links ---
    const urlParams = new URLSearchParams(window.location.search);
    const inviteCodeFromUrl = urlParams.get('invite');
    const inviteInput = document.getElementById('invite-code');

    if (inviteCodeFromUrl && inviteInput) {
        inviteInput.value = inviteCodeFromUrl;
        inviteInput.setAttribute('readonly', true);
    }
    
    // --- START: Form Navigation Logic ---
    const registerForm = document.getElementById('register-form');
    const nextButtons = document.querySelectorAll('.next-btn');
    const backButtons = document.querySelectorAll('.back-btn');
    const formSteps = document.querySelectorAll('.form-step');
    const stepIndicators = document.querySelectorAll('.step-indicator');
    const progressBarFill = document.querySelector('.progress-bar-fill');

    let currentStep = 1;

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

    function updateFormUI() {
        formSteps.forEach(step => {
            step.classList.remove('active');
            if (parseInt(step.dataset.step) === currentStep) {
                step.classList.add('active');
            }
        });

        stepIndicators.forEach((indicator, index) => {
            indicator.classList.remove('active');
            if (index < currentStep) {
                indicator.classList.add('active');
            }
        });
        
        const progressPercentage = ((currentStep - 1) / (formSteps.length - 1)) * 100;
        progressBarFill.style.width = `${progressPercentage}%`;
    }

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
        
        if (step === 4) {
             const agreement = document.getElementById('agreement').checked;
             if (!agreement) {
                 showNotification('You must agree to the Terms of Service and Privacy Policy.', 'error');
                 isValid = false;
             }
        }

        return isValid;
    }

    // --- START: Form Submission Logic ---
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        if (!validateStep(4)) return;

        const registerButton = document.getElementById('register-button');
        registerButton.disabled = true;
        registerButton.textContent = 'Processing...';

        const name = document.getElementById('name').value;
        const ifcUsername = document.getElementById('ifc-username').value;
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        const callsign = document.getElementById('callsign').value;
        const inviteCode = document.getElementById('invite-code').value;

        try {
            const response = await fetch('https://indgo-backend.onrender.com/api/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name,
                    ifcUsername,
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

    // --- START: NEW function to load legal text into the form ---
    const loadTermsIntoBox = async () => {
        const container = document.getElementById('terms-container');
        if (!container) return;

        try {
            const response = await fetch('terms.html');
            if (!response.ok) throw new Error('Network response was not ok');
            
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const content = doc.querySelector('.content-card').innerHTML;
            
            container.innerHTML = content;
        } catch (error) {
            console.error('Failed to load terms into box:', error);
            container.innerHTML = '<p>Could not load the Terms of Service. Please try refreshing the page.</p>';
        }
    };
    loadTermsIntoBox(); // Call the function on page load
    
    // --- START: Modal Logic ---
    const modal = document.getElementById('legal-modal');
    const modalTitle = document.getElementById('modal-title');
    const modalBody = document.getElementById('modal-body');
    const closeModalBtn = document.getElementById('modal-close');
    // MODIFIED: Removed the 'show-terms' link selector as it's no longer used
    const showPrivacyLink = document.getElementById('show-privacy');

    const openModal = async (type) => {
        // MODIFIED: Simplified to only handle privacy.html
        const url = 'privacy.html';
        const title = 'Privacy Policy';
        
        modalTitle.textContent = 'Loading...';
        modalBody.innerHTML = '<p>Please wait...</p>';
        modal.classList.add('show');

        try {
            const response = await fetch(url);
            const text = await response.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(text, 'text/html');
            const content = doc.querySelector('.content-card').innerHTML;
            
            modalTitle.textContent = title;
            modalBody.innerHTML = content;
        } catch (error) {
            console.error('Failed to load content:', error);
            modalTitle.textContent = 'Error';
            modalBody.innerHTML = '<p>Could not load the document. Please try again later.</p>';
        }
    };

    const closeModal = () => {
        modal.classList.remove('show');
    };

    // MODIFIED: Removed the event listener for the terms link
    showPrivacyLink.addEventListener('click', (e) => {
        e.preventDefault();
        openModal('privacy');
    });

    closeModalBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    // --- START: Notification Function ---
    function showNotification(message, type) {
        Toastify({
            text: message,
            duration: 3000,
            close: true,
            gravity: "top", 
            position: "right", 
            backgroundColor: type === 'success' ? "linear-gradient(to right, #00b09b, #96c93d)" : "linear-gradient(to right, #ff5f6d, #ffc371)",
        }).showToast();
    }
});