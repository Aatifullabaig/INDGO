// staff.js (Corrected and Improved)

document.addEventListener('DOMContentLoaded', () => {
    const staffGrid = document.getElementById('staff-grid');
    const API_BASE_URL = 'https://site--indgo-backend--6dmjph8ltlhv.code.run';

    // NEW: Helper function to copy text to the clipboard and provide user feedback.
    function copyToClipboard(text, element) {
        navigator.clipboard.writeText(text).then(() => {
            const originalHtml = element.innerHTML;
            element.innerHTML = '<div><i class="fas fa-check"></i> Copied!</div>';
            setTimeout(() => {
                element.innerHTML = originalHtml;
            }, 2000); // Revert the text back after 2 seconds
        }).catch(err => {
            console.error('Failed to copy text: ', err);
            // Fallback for browsers that might not support the Clipboard API
            alert(`Could not copy. Username is: ${text}`); 
        });
    }

    async function fetchAndDisplayStaff() {
        if (!staffGrid) {
            console.error('Staff grid element not found!');
            return;
        }

        staffGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">Loading team members...</p>';

        try {
            const response = await fetch(`${API_BASE_URL}/api/staff`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const staffMembers = await response.json();

            staffGrid.innerHTML = ''; 

            if (staffMembers.length === 0) {
                staffGrid.innerHTML = '<p style="text-align: center; grid-column: 1 / -1;">No staff members found.</p>';
                return;
            }

            // FIX: The sort logic now correctly checks for the full role title.
            staffMembers.sort((a, b) => {
                if (a.role.toLowerCase() === 'chief executive officer (ceo)') return -1;
                if (b.role.toLowerCase() === 'chief executive officer (ceo)') return 1;
                return new Date(a.createdAt) - new Date(b.createdAt);
            });

            staffMembers.forEach(member => {
                const card = document.createElement('div');
                card.className = 'staff-profile-card'; 

                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                const isNew = new Date(member.createdAt) > sevenDaysAgo;
                const newStickerHtml = isNew ? '<span class="new-sticker">NEW</span>' : '';

                // FIX: Use the full S3 URL from member.imageUrl directly.
                const imageUrl = member.imageUrl 
                    ? member.imageUrl
                    : `https://ui-avatars.com/api/?name=${encodeURIComponent(member.name)}&background=0D8ABC&color=fff&size=150`;

                let linksHtml = '';
                const preferred = member.preferredContact;

                // IMPROVEMENT: Use the copyToClipboard function for a better user experience.
                if (member.discord) {
                    const isPreferred = preferred === 'discord' ? '<span class="preferred-badge">Preferred</span>' : '';
                    linksHtml += `
                        <a href="#" onclick="copyToClipboard('${member.discord}', this); return false;" class="social-link-btn discord" title="Copy Discord Username">
                            <div><i class="fab fa-discord"></i> Discord</div>
                            ${isPreferred}
                        </a>`;
                }

                if (member.ifc) {
                    const isPreferred = preferred === 'ifc' ? '<span class="preferred-badge">Preferred</span>' : '';
                    linksHtml += `
                        <a href="${member.ifc}" target="_blank" rel="noopener noreferrer" class="social-link-btn ifc">
                            <div><i class="fas fa-plane"></i> IFC</div>
                            ${isPreferred}
                        </a>`;
                }

                if (member.youtube) {
                    const isPreferred = preferred === 'youtube' ? '<span class="preferred-badge">Preferred</span>' : '';
                    linksHtml += `
                        <a href="${member.youtube}" target="_blank" rel="noopener noreferrer" class="social-link-btn youtube">
                            <div><i class="fab fa-youtube"></i> YouTube</div>
                            ${isPreferred}
                        </a>`;
                }
                
                card.innerHTML = `
                    <div class="staff-card-header"></div>
                    <div class="staff-image-container">
                        <img src="${imageUrl}" alt="Profile picture of ${member.name}" class="staff-image">
                        ${newStickerHtml}
                    </div>
                    <div class="staff-details">
                        <h3>${member.name}</h3>
                        <div class="staff-role">${member.role}</div>
                        <p class="staff-bio">${member.bio || 'This staff member has not added a bio yet.'}</p>
                    </div>
                    <div class="staff-card-footer">
                        <div class="staff-social-links">
                            ${linksHtml.length > 0 ? linksHtml : '<p>No contact information provided.</p>'}
                        </div>
                    </div>
                `;
                staffGrid.appendChild(card);
            });

        } catch (error) {
            console.error('Failed to fetch staff data:', error);
            staffGrid.innerHTML = '<p style="text-align: center; color: #ffcccc; grid-column: 1 / -1;">Could not load staff information. Please try again later.</p>';
        }
    }

    fetchAndDisplayStaff();
});