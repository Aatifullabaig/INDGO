document.addEventListener('DOMContentLoaded', () => {
    const rosterContainer = document.getElementById('pilot-roster-container');
    const loadingEl = document.getElementById('roster-loading');

    // This is the default image to use if a pilot has no profile picture
    const defaultAvatar = '/images/indgo.png'; // Or any default placeholder image you have

    // --- FIX: Define the absolute URL of your backend server ---
    // This must match the port your server.js is running on
    const API_BASE_URL = 'https://site--indgo-backend--6dmjph8ltlhv.code.run';

    // Function to fetch and display pilots
    async function loadPilotRoster() {
        try {
            // --- FIX: Use the full, absolute URL to fetch ---
            const response = await fetch(`${API_BASE_URL}/api/pilots/public-roster`);

            if (!response.ok) {
                // Log the server's response text for more detail
                const errorText = await response.text();
                console.error('Server responded with:', errorText);
                throw new Error(`Failed to fetch roster: ${response.statusText}`);
            }

            const pilots = await response.json();

            // Clear the loading message
            if (loadingEl) {
                loadingEl.remove();
            }

            if (pilots.length === 0) {
                rosterContainer.innerHTML = '<p>No pilots found.</p>';
                return;
            }

            // Loop through each pilot and create a card
            pilots.forEach(pilot => {
                const pilotCard = document.createElement('div');
                pilotCard.className = 'pilot-card';

                const avatarUrl = pilot.imageUrl ? pilot.imageUrl : defaultAvatar;
                const flightHours = pilot.flightHours ? pilot.flightHours.toFixed(1) : '0';

                pilotCard.innerHTML = `
                    <img src="${avatarUrl}" alt="${pilot.name}'s avatar" class="pilot-card-avatar" onerror="this.src='${defaultAvatar}'">
                    <div class="pilot-card-info">
                        <h3>${pilot.name}</h3>
                        <span class="callsign">${pilot.callsign || 'N/A'}</span>
                        <span class="rank">${pilot.rank}</span>
                        <span class="hours"><strong>${flightHours}</strong> hours</span>
                    </div>
                `;

                rosterContainer.appendChild(pilotCard);
            });

        } catch (error) {
            console.error('Error loading pilot roster:', error);
            if (loadingEl) {
                loadingEl.textContent = 'Failed to load pilot roster. Please try again later.';
                loadingEl.style.color = 'red';
            }
        }
    }

    // Run the function
    loadPilotRoster();
});