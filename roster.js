document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_BASE_URL = 'https://site--indgo-backend--6dmjph8ltlhv.code.run';
    const defaultAvatar = '/images/indgo.png';
    const ROWS_PER_PAGE = 15;

    // --- NEW: Rank Data (from curriculum.html) ---
    // This maps rank names to their badges for easy lookup
    const RANK_DATA = {
        "IndGo Cadet": { badge: "images/badges/indgo_cadet_badge.png" },
        "Skyline Observer": { badge: "images/badges/skyline_observer_badge.png" },
        "Route Explorer": { badge: "images/badges/route_explorer_badge.png" },
        "Skyline Officer": { badge: "images/badges/skyline_officer_badge.png" },
        "Command Captain": { badge: "images/badges/command_captain_badge.png" },
        "Elite Captain": { badge: "images/badges/elite_captain_badge.png" },
        "Blue Eagle": { badge: "images/badges/blue_eagle_badge.png" },
        "Line Instructor": { badge: "images/badges/line_instructor_badge.png" },
        "Chief Flight Instructor": { badge: "images/badges/chief_flight_instructor_badge.png" },
        "IndGo SkyMaster": { badge: "images/badges/indgo_skymaster_badge.png" },
        "Blue Legacy Commander": { badge: "images/badges/blue_legacy_commander_badge.png" },
        // Default fallback in case rank name doesn't match
        "default": { badge: "images/badges/indgo_cadet_badge.png" }
    };

    // --- Element Selectors ---
    const topFlyersContainer = document.getElementById('top-flyers-container');
    const rosterContainer = document.getElementById('pilot-roster-container');
    const loadingEl = document.getElementById('roster-loading');
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const pageInfoEl = document.getElementById('page-info');

    let allRegularPilots = [];
    let currentPage = 1;
    let totalPages = 1;

    // --- Main Function: Fetch and Process Roster ---
    async function loadPilotRoster() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/pilots/public-roster`);
            if (!response.ok) {
                throw new Error(`Failed to fetch roster: ${response.statusText}`);
            }
            let pilots = await response.json();

            // Sort pilots by flight hours (highest first)
            pilots.sort((a, b) => (b.flightHours || 0) - (a.flightHours || 0));

            // Split pilots into Top 3 and Regular
            const topFlyers = pilots.slice(0, 3);
            allRegularPilots = pilots.slice(3); // Store regular pilots for pagination

            // Clear loading message
            if (loadingEl) {
                loadingEl.remove();
            }

            // Display the two groups
            displayTopFlyers(topFlyers);
            
            if (allRegularPilots.length > 0) {
                setupPagination();
                displayPage(currentPage);
            } else if (topFlyers.length === 0) {
                 rosterContainer.innerHTML = '<p>No pilots found.</p>';
                 document.getElementById('pagination-controls').style.display = 'none';
            } else {
                // Hide pagination if only Top 3 exist
                document.getElementById('pagination-controls').style.display = 'none';
            }

        } catch (error) {
            console.error('Error loading pilot roster:', error);
            if (loadingEl) {
                loadingEl.textContent = 'Failed to load pilot roster. Please try again later.';
                loadingEl.style.color = 'red';
            }
            document.getElementById('pagination-controls').style.display = 'none';
        }
    }

    // --- NEW: Display Top 3 Flyers (Redesigned) ---
    function displayTopFlyers(pilots) {
        if (!topFlyersContainer) return;
        topFlyersContainer.innerHTML = ''; // Clear any existing
        
        pilots.forEach((pilot, index) => {
            const card = document.createElement('div');
            card.className = 'top-pilot-card';

            const avatarUrl = pilot.imageUrl || defaultAvatar;
            
            // --- Convert decimal hours to HHH:MM format ---
            const totalHours = pilot.flightHours || 0;
            const hours = Math.floor(totalHours);
            const minutes = Math.round((totalHours - hours) * 60);
            
            const formattedHours = hours.toLocaleString('en-US'); // Adds commas
            const formattedMinutes = minutes.toString().padStart(2, '0'); // Ensures "03" instead of "3"
            const displayTime = `${formattedHours}:${formattedMinutes}`;
            
            // --- Get Rank Info (for the badge) ---
            const rankName = pilot.rank || 'N/A';
            const rankInfo = RANK_DATA[rankName] || RANK_DATA["default"];

            // --- Get Podium Info (for the #1/2/3 badge) ---
            const podiumClass = `podium-${index + 1}`;
            const podiumText = `#${index + 1}`;

            // --- Get Pireps (assuming API provides it, like in the inspiration) ---
            // If your API uses a different field name (e.g., 'flights'), change 'pirepsFiled'
            const pireps = pilot.pirepsFiled || 0; // Assuming 'pirepsFiled' is in your API data

            // --- New card structure ---
            card.innerHTML = `
                <div class="top-pilot-avatar-wrapper">
                    <img src="${avatarUrl}" alt="${pilot.name}'s avatar" class="top-pilot-avatar" onerror="this.src='${defaultAvatar}'">
                    <div class="top-pilot-podium-badge ${podiumClass}">${podiumText}</div>
                </div>
                
                <div class="top-pilot-info">
                    <h3>${pilot.name}</h3>
                    <span class="callsign">${pilot.callsign || 'N/A'}</span>
                </div>

                <div class="top-pilot-rank">
                    <img src="${rankInfo.badge}" alt="${rankName}" class="top-pilot-rank-badge-img" title="${rankName}">
                    <span class="top-pilot-rank-name">${rankName}</span>
                </div>

                <div class="top-pilot-stats">
                    <div class="stat-bar">
                        <span class="label">Flight Duration</span>
                        <span class="value">${displayTime}</span>
                    </div>
                    <div class="stat-bar">
                        <span class="label">Pireps Filed</span>
                        <span class="value">${pireps}</span>
                    </div>
                </div>
            `;
            topFlyersContainer.appendChild(card);
        });
    }

    // --- NEW: Setup Pagination Logic ---
    function setupPagination() {
        totalPages = Math.ceil(allRegularPilots.length / ROWS_PER_PAGE);

        prevPageBtn.addEventListener('click', () => {
            if (currentPage > 1) {
                currentPage--;
                displayPage(currentPage);
            }
        });

        nextPageBtn.addEventListener('click', () => {
            if (currentPage < totalPages) {
                currentPage++;
                displayPage(currentPage);
            }
        });
    }

    // --- NEW: Display a Specific Page (with Remade Cards) ---
    function displayPage(page) {
        rosterContainer.innerHTML = ''; // Clear previous page's pilots
        currentPage = page;

        const start = (page - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        const paginatedPilots = allRegularPilots.slice(start, end);

        paginatedPilots.forEach(pilot => {
            const pilotCard = document.createElement('div');
            pilotCard.className = 'pilot-card';
            
            // The 'data-rank' attribute is no longer needed for styling
            // as the badge image is the primary visual.

            const avatarUrl = pilot.imageUrl || defaultAvatar;
            const flightHours = pilot.flightHours ? pilot.flightHours.toFixed(1) : '0';
            const rankName = pilot.rank || 'N/A';
            const rankInfo = RANK_DATA[rankName] || RANK_DATA["default"];

            // --- New Card Structure ---
            pilotCard.innerHTML = `
                <div class="pilot-card-avatar-wrapper">
                    <img src="${avatarUrl}" alt="${pilot.name}'s avatar" class="pilot-card-avatar" onerror="this.src='${defaultAvatar}'">
                    <img src="${rankInfo.badge}" alt="${rankName}" class="pilot-card-badge" title="${rankName}">
                </div>
                <div class="pilot-card-info">
                    <h3>${pilot.name}</h3>
                    <span class="callsign">${pilot.callsign || 'N/A'}</span>
                    <span class="rank">${rankName}</span>
                    <span class="hours"><strong>${flightHours}</strong> hours</span>
                </div>
            `;
            rosterContainer.appendChild(pilotCard);
        });

        // Update pagination UI
        pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    // --- Run the function ---
    loadPilotRoster();
});