document.addEventListener('DOMContentLoaded', () => {
    // --- Configuration ---
    const API_BASE_URL = 'https://site--indgo-backend--6dmjph8ltlhv.code.run';
    const defaultAvatar = '/images/indgo.png';
    const ROWS_PER_PAGE = 15;

    // --- Rank Data (from curriculum.html) ---
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

    // --- Main Function (Unchanged) ---
    async function loadPilotRoster() {
        try {
            const response = await fetch(`${API_BASE_URL}/api/pilots/public-roster`);
            if (!response.ok) {
                throw new Error(`Failed to fetch roster: ${response.statusText}`);
            }
            let pilots = await response.json();

            pilots.sort((a, b) => (b.flightHours || 0) - (a.flightHours || 0));

            const topFlyers = pilots.slice(0, 3);
            allRegularPilots = pilots.slice(3); 

            if (loadingEl) {
                loadingEl.remove();
            }

            displayTopFlyers(topFlyers); // Call the updated function
            
            if (allRegularPilots.length > 0) {
                setupPagination();
                displayPage(currentPage);
            } else if (topFlyers.length === 0) {
                 rosterContainer.innerHTML = '<p>No pilots found.</p>';
                 document.getElementById('pagination-controls').style.display = 'none';
            } else {
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

    // --- NEW: Redesigned Display Top 3 Flyers ---
    function displayTopFlyers(pilots) {
        if (!topFlyersContainer) return;
        topFlyersContainer.innerHTML = ''; 
        
        pilots.forEach((pilot, index) => {
            const card = document.createElement('div');
            card.className = 'top-pilot-card';
            // Set data-rank for the CSS to apply the correct --pilot-rank-color
            if (pilot.rank) {
                card.setAttribute('data-rank', pilot.rank);
            }

            const avatarUrl = pilot.imageUrl || defaultAvatar;
            const flightHours = pilot.flightHours ? pilot.flightHours.toFixed(1) : '0.0';
            const pilotRank = pilot.rank || 'N/A';
            const rankInfo = RANK_DATA[pilot.rank] || RANK_DATA["default"];

            // Building the new card structure
            card.innerHTML = `
                <div class="top-pilot-avatar-container">
                    <img src="${avatarUrl}" alt="${pilot.name}'s avatar" class="top-pilot-avatar" onerror="this.src='${defaultAvatar}'">
                    <div class="top-pilot-rank-badge">#${index + 1}</div>
                </div>
                <div class="top-pilot-info">
                    <h3>${pilot.name}</h3>
                    <span class="callsign">${pilot.callsign || 'N/A'}</span>
                </div>
                <div class="top-pilot-stats">
                    <div class="stat-bar hours-bar">
                        <span>Flight Duration</span>
                        <span>${flightHours}</span>
                    </div>
                    <div class="stat-bar rank-bar">
                        <span>Rank</span>
                        <span>${pilotRank}</span>
                    </div>
                </div>
            `;
            topFlyersContainer.appendChild(card);
        });
    }

    // --- Setup Pagination Logic (Unchanged) ---
    function setupPagination() {
        totalPages = Math.ceil(allRegularPilots.length / ROWS_PER_PAGE);
        prevPageBtn.addEventListener('click', () => { /* ... */ });
        nextPageBtn.addEventListener('click', () => { /* ... */ });
    }

    // --- Display a Specific Page (Unchanged) ---
    // This function is still correct. It builds the main roster cards.
    function displayPage(page) {
        rosterContainer.innerHTML = '';
        currentPage = page;

        const start = (page - 1) * ROWS_PER_PAGE;
        const end = start + ROWS_PER_PAGE;
        const paginatedPilots = allRegularPilots.slice(start, end);

        paginatedPilots.forEach(pilot => {
            const pilotCard = document.createElement('div');
            pilotCard.className = 'pilot-card';
            
            if (pilot.rank) {
                pilotCard.setAttribute('data-rank', pilot.rank);
            }

            const avatarUrl = pilot.imageUrl || defaultAvatar;
            const flightHours = pilot.flightHours ? pilot.flightHours.toFixed(1) : '0';
            const rankInfo = RANK_DATA[pilot.rank] || RANK_DATA["default"];

            pilotCard.innerHTML = `
                <img src="${rankInfo.badge}" alt="${pilot.rank}" class="pilot-card-badge" title="${pilot.rank}">
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

        // Update pagination UI
        pageInfoEl.textContent = `Page ${currentPage} of ${totalPages}`;
        prevPageBtn.disabled = currentPage === 1;
        nextPageBtn.disabled = currentPage === totalPages;
    }

    // --- Run the function ---
    loadPilotRoster();
});