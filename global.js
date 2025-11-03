// global.js (Revised with Notification Helper)

/**
 * Displays a toast notification using Toastify.js.
 * @param {string} message The message to display.
 * @param {string} type The type of notification ('success' or 'error').
 */
function showNotification(message, type = 'success') {
    const backgroundColor = type === 'success' 
        ? 'linear-gradient(to right, #00b09b, #96c93d)' 
        : 'linear-gradient(to right, #ff5f6d, #ffc371)';

    Toastify({
        text: message,
        duration: 3000,
        close: true,
        gravity: "top", // `top` or `bottom`
        position: "right", // `left`, `center` or `right`
        stopOnFocus: true, // Prevents dismissing of toast on hover
        style: {
            background: backgroundColor,
        },
    }).showToast();
}

document.addEventListener('DOMContentLoaded', () => {
    const token = localStorage.getItem('authToken') || sessionStorage.getItem('authToken'); // <-- FIX
    const navMenu = document.querySelector('.nav-menu');
    
    const showLoggedOutButtons = () => {
        const authLinks = document.querySelectorAll('.auth-link');
        authLinks.forEach(link => {
            if (link) {
                // Change visibility to 'visible' to make them appear
                link.style.visibility = 'visible'; 
            }
        });
    };

    if (token) {
        fetchUserData(token);
    } else {
        // This now reveals the hidden buttons
        showLoggedOutButtons(); 
    }

    async function fetchUserData(token) {
        try {
            const response = await fetch('https://site--indgo-backend--6dmjph8ltlhv.code.run/api/me', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!response.ok) {
                localStorage.removeItem('authToken');
                showLoggedOutButtons();
                return;
            }

            const user = await response.json();
            updateNavbarForLoggedInUser(user);

        } catch (error) {
            console.error('Error fetching user data for navbar:', error);
            showLoggedOutButtons();
        }
    }

    function updateNavbarForLoggedInUser(user) {
    const navMenu = document.querySelector('.nav-menu');
    if (!navMenu) return; // Exit if the nav menu doesn't exist

    // 1. Find and remove the old auth links IF they exist.
    // This makes the function work on any page, regardless of its initial HTML.
    const existingAuthLinks = navMenu.querySelectorAll('li.auth-link');
    existingAuthLinks.forEach(link => link.remove());

    // 2. Create the new "Welcome" and "Logout" elements.
    const welcomeLi = document.createElement('li');
    welcomeLi.className = 'nav-item';
    // Use an ID to prevent creating duplicates if the function runs multiple times
    welcomeLi.id = 'nav-welcome-message'; 
    welcomeLi.innerHTML = `<a href="dashboard.html" class="nav-link">Hello, ${user.name}</a>`;

    const logoutLi = document.createElement('li');
    logoutLi.className = 'nav-item';
    logoutLi.id = 'nav-logout-button';
    const logoutButton = document.createElement('a');
    logoutButton.href = '#';
    logoutButton.className = 'nav-link nav-button';
    logoutButton.textContent = 'Logout';
    logoutButton.onclick = () => {
        localStorage.removeItem('authToken');
        // Redirect to home and force a reload to clear state
        window.location.href = 'index.html'; 
    };
    logoutLi.appendChild(logoutButton);

    // 3. Add the new elements to the navbar, but only if they aren't already there.
    if (!document.getElementById('nav-welcome-message')) {
        navMenu.appendChild(welcomeLi);
    }
    if (!document.getElementById('nav-logout-button')) {
        navMenu.appendChild(logoutLi);
    }
}
});