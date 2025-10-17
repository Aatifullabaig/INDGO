// community.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Page element containers ---
    const eventsContainer = document.getElementById('events-container');
    const highlightsContainer = document.getElementById('highlights-container');
    const API_BASE_URL = 'https://site--indgo-backend--6dmjph8ltlhv.code.run';

    /**
     * NEW: Sets up the Intersection Observer for fade-in animations.
     * This function should be called after new content is added to the DOM.
     */
    function initializeFadeInObserver() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target); // Optional: stop observing once visible
                }
            });
        }, { threshold: 0.1 });

        // Find all elements with .fade-in that are not yet visible
        document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
    }

    /**
     * Creates an HTML card for a community post (event or highlight).
     * @param {object} post - The post data (event or highlight object).
     * @param {string} type - The type of post ('event' or 'highlight').
     * @returns {string} - The HTML string for the card.
     */
    function createCommunityCard(post, type) {
            const imageUrl = post.imageUrl 
        ? post.imageUrl 
        : 'images/default-event-image.png'; // A default placeholder image

    let metaInfo = '';
    if (type === 'event') {
        const eventDate = new Date(post.date).toLocaleString('en-US', {
            dateStyle: 'full',
            timeStyle: 'short',
        });
        metaInfo = `<p class="meta-info"><i class="fas fa-calendar-alt"></i> ${eventDate}</p>`;
    } else if (type === 'highlight') {
        metaInfo = `<p class="meta-info"><i class="fas fa-trophy"></i> Winner: <strong>${post.winnerName || 'N/A'}</strong></p>`;
    }


        return `
            <div class="community-card fade-in">
                <div class="community-card-image-container">
                    <img src="${imageUrl}" alt="${post.title}">
                </div>
                <div class="community-card-content">
                    <h3>${post.title}</h3>
                    ${metaInfo}
                    <p>${post.description || ''}</p>
                </div>
            </div>
        `;
    }

    /**
     * Fetches events from the API and displays them on the page.
     */
    async function fetchAndDisplayEvents() {
        if (!eventsContainer) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/events`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const events = await response.json();

            if (events.length === 0) {
                eventsContainer.innerHTML = '<p>No upcoming events have been posted yet. Check back soon!</p>';
                return;
            }

            const eventsHtml = events.map(event => createCommunityCard(event, 'event')).join('');
            eventsContainer.innerHTML = eventsHtml;

            // ADD THIS LINE
            initializeFadeInObserver(); 

        } catch (error) {
            console.error('Failed to fetch events:', error);
            eventsContainer.innerHTML = '<p style="color: red;">Could not load events at this time.</p>';
        }
    }

    /**
     * Fetches weekly highlights from the API and displays them on the page.
     */
    async function fetchAndDisplayHighlights() {
        if (!highlightsContainer) return;

        try {
            const response = await fetch(`${API_BASE_URL}/api/highlights`);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const highlights = await response.json();

            if (highlights.length === 0) {
                highlightsContainer.innerHTML = '<p>No highlights have been posted this week. Stay tuned!</p>';
                return;
            }

            const highlightsHtml = highlights.map(highlight => createCommunityCard(highlight, 'highlight')).join('');
            highlightsContainer.innerHTML = highlightsHtml;

            // ADD THIS LINE
            initializeFadeInObserver();

        } catch (error) {
            console.error('Failed to fetch highlights:', error);
            highlightsContainer.innerHTML = '<p style="color: red;">Could not load highlights at this time.</p>';
        }
    }

    // --- Initial data fetch ---
    fetchAndDisplayEvents();
    fetchAndDisplayHighlights();
});