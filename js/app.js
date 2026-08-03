/* ==========================================================================
   AeroSwim SPA Router & Bootstrap Entrypoint (Async Sheets Integration)
   ========================================================================== */

import { initializeStorage, getProfile, saveProfile, syncFromSheets } from './storage.js';
import { initDashboardView } from './dashboard.js';
import { initTimesView, setupTimeModalListeners } from './times.js';
import { initStandardsView } from './standards.js';
import { initAnalyticsView } from './analytics.js';
import { initForecastView } from './forecast.js';
import { initHolidayInvitationalView } from './holidayInvitational.js';
import { initWorkoutsView, setupWorkoutModalListeners } from './workouts.js';
import { initNutritionView } from './nutrition.js';
import { initDataManagerView } from './import-export.js';
import { exportAnalyticsPDF } from './pdfReport.js';

// --- Routing Table ---
const ROUTES = {
    '#dashboard': { title: 'Dashboard', init: initDashboardView },
    '#times': { title: 'Times & Meets', init: initTimesView },
    '#standards': { title: 'Time Standards', init: initStandardsView },
    '#analytics': { title: 'Performance Analytics', init: initAnalyticsView },
    '#forecast': { title: 'Season & Course Forecast', init: initForecastView },
    '#holiday-invitational': { title: 'Holiday Invitational Target', init: initHolidayInvitationalView },
    '#workouts': { title: 'Training Log', init: initWorkoutsView },
    '#nutrition': { title: 'Nutrition & Hydration', init: initNutritionView },
    '#data-manager': { title: 'Data Manager', init: initDataManagerView }
};

/**
 * Syncs the sidebar swimmer profile card UI with the database
 */
function updateSidebarProfileUI() {
    const profile = getProfile();
    const nameEl = document.getElementById('swimmer-name');
    const metaEl = document.getElementById('swimmer-meta');
    const avatarEl = document.getElementById('swimmer-avatar');
    
    if (nameEl) nameEl.innerText = profile.name;
    if (metaEl) {
        metaEl.innerText = `Age: ${profile.age} ${profile.gender || 'Boys'} | Team: ${profile.team || 'Unattached'}`;
        if (profile.sheetsUrl) {
            metaEl.innerText += " (Synced)";
        }
    }
    
    if (avatarEl && profile.name) {
        const parts = profile.name.trim().split(/\s+/);
        const initials = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
        avatarEl.innerText = initials || 'SW';
    }
    
    // Toggle global sync button visibility
    const syncBtn = document.getElementById('global-sync-btn');
    if (syncBtn) {
        syncBtn.style.display = profile.sheetsUrl ? 'inline-flex' : 'none';
    }
}

/**
 * Handles browser hash-change routing (Async)
 */
/**
 * Handles browser hash-change routing (Async)
 */
async function handleRouting() {
    const rawHash = (window.location.hash || '#dashboard').split('?')[0];
    const route = ROUTES[rawHash] || ROUTES['#dashboard'];
    
    // 1. Update active class in sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        const href = item.getAttribute('href') || '';
        if (href === rawHash || item.hash === rawHash || href.endsWith(rawHash)) {
            item.classList.add('active');
        }
    });
    
    // 2. Set Top Bar title
    const viewTitleEl = document.getElementById('view-title');
    if (viewTitleEl && route) {
        viewTitleEl.innerText = route.title;
    }
    
    // 3. Initialize target view content (Async support)
    try {
        if (route && typeof route.init === 'function') {
            await route.init();
        }
    } catch (err) {
        console.error(`Error initializing route ${rawHash}:`, err);
    }
    
    // 4. Close mobile sidebar menu drawer if open
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('active');
}

// --- Swimmer Profile Modal Handling ---

function openProfileModal() {
    try {
        const modal = document.getElementById('profile-modal');
        if (!modal) return;
        const profile = getProfile() || {};
        
        const nameEl = document.getElementById('input-swimmer-name');
        const ageEl = document.getElementById('input-swimmer-age');
        const genderEl = document.getElementById('input-swimmer-gender');
        const teamEl = document.getElementById('input-swimmer-team');
        const swimmerUrlEl = document.getElementById('input-swimcloud-swimmer-url');
        const teamUrlEl = document.getElementById('input-swimcloud-team-url');
        const urlEl = document.getElementById('input-sheets-url');
        const keyEl = document.getElementById('input-sheets-key');
        
        if (nameEl) nameEl.value = profile.name || '';
        if (ageEl) ageEl.value = profile.age || '';
        if (genderEl) genderEl.value = profile.gender || 'Boys';
        if (teamEl) teamEl.value = profile.team || '';
        if (swimmerUrlEl) swimmerUrlEl.value = profile.swimcloudSwimmerUrl || '';
        if (teamUrlEl) teamUrlEl.value = profile.swimcloudTeamUrl || '';
        if (urlEl) urlEl.value = profile.sheetsUrl || '';
        if (keyEl) keyEl.value = profile.sheetsKey || '';
        
        modal.classList.add('active');
        modal.style.display = 'flex';
        modal.style.opacity = '1';
        modal.style.pointerEvents = 'auto';
        modal.style.zIndex = '9999';
    } catch (err) {
        console.error("Error opening profile modal:", err);
    }
}

function closeProfileModal() {
    const modal = document.getElementById('profile-modal');
    if (modal) {
        modal.classList.remove('active');
        modal.style.display = 'none';
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
    }
}

function setupProfileModalListeners() {
    const form = document.getElementById('profile-form');
    
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const name = (document.getElementById('input-swimmer-name').value || '').trim();
            const age = parseInt(document.getElementById('input-swimmer-age').value) || 0;
            const gender = document.getElementById('input-swimmer-gender').value;
            const team = (document.getElementById('input-swimmer-team').value || '').trim();
            const swimcloudSwimmerUrl = (document.getElementById('input-swimcloud-swimmer-url').value || '').trim();
            const swimcloudTeamUrl = (document.getElementById('input-swimcloud-team-url').value || '').trim();
            const sheetsUrl = (document.getElementById('input-sheets-url').value || '').trim();
            const sheetsKey = (document.getElementById('input-sheets-key').value || '').trim();
            
            const oldProfile = getProfile();
            
            // Save profile
            await saveProfile({ name, age, gender, team, swimcloudSwimmerUrl, swimcloudTeamUrl, sheetsUrl, sheetsKey });
            closeProfileModal();
            updateSidebarProfileUI();
            
            // If URL or Key changed or added, force refetch from Google Sheets
            if (sheetsUrl && (sheetsUrl !== oldProfile.sheetsUrl || sheetsKey !== oldProfile.sheetsKey)) {
                const viewTitle = document.getElementById('view-title');
                const originalTitle = viewTitle ? viewTitle.innerText : '';
                if (viewTitle) viewTitle.innerText = "⚡ Syncing with Google Sheets...";
                
                const res = await syncFromSheets(true);
                
                if (res && res.success) {
                    if (viewTitle) viewTitle.innerText = `✓ Synced ${res.timesCount || 0} Swims from Sheets!`;
                    setTimeout(() => {
                        if (viewTitle) viewTitle.innerText = originalTitle;
                    }, 2500);
                } else {
                    if (viewTitle) viewTitle.innerText = originalTitle;
                }
            }
            
            // Re-render active view
            await handleRouting();
        });
    }
    
    // Single document click handler for profile triggers and modal close targets
    document.addEventListener('click', (e) => {
        const trigger = e.target.closest('.edit-profile-trigger, #open-profile-settings, #top-bar-profile-btn');
        if (trigger) {
            e.preventDefault();
            openProfileModal();
            return;
        }

        const closeBtn = e.target.closest('#close-profile-modal, #cancel-profile-btn, #profile-modal .modal-overlay');
        if (closeBtn) {
            e.preventDefault();
            closeProfileModal();
            return;
        }
    });
}

// --- Application Core Entrypoint ---

function bootApp() {
    // 1. Initialise localStorage schemas
    initializeStorage();
    
    // 2. Sync profile card UI
    updateSidebarProfileUI();
    
    // 3. Register routing changes listener
    window.addEventListener('hashchange', async () => {
        await handleRouting();
    });
    
    // 4. Wire modal trigger event callbacks
    setupProfileModalListeners();
    setupTimeModalListeners();
    setupWorkoutModalListeners();
    
    // 5. Wire mobile sidebar sliding drawer & backdrop
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            const isOpen = sidebar.classList.toggle('open');
            if (backdrop) backdrop.classList.toggle('active', isOpen);
        });
    }

    if (backdrop && sidebar) {
        backdrop.addEventListener('click', () => {
            sidebar.classList.remove('open');
            backdrop.classList.remove('active');
        });
    }

    // 5b. Global sync button click listener (Force update from Google Sheets)
    const syncBtn = document.getElementById('global-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            const icon = syncBtn.querySelector('[data-lucide="refresh-cw"]') || syncBtn.querySelector('i');
            if (icon) icon.classList.add('spinning');
            syncBtn.disabled = true;
            
            try {
                const res = await syncFromSheets(true);
                if (res && res.error) {
                    alert("Sync Notice: " + res.error);
                }
                await handleRouting();
            } catch (err) {
                console.error("Manual sync failed: ", err);
            } finally {
                setTimeout(() => {
                    if (icon) icon.classList.remove('spinning');
                    syncBtn.disabled = false;
                }, 400);
            }
        });
    }

    // 5c. Global PDF Export Button Click Listener
    const pdfExportBtn = document.getElementById('global-pdf-export-btn');
    if (pdfExportBtn) {
        pdfExportBtn.addEventListener('click', () => {
            exportAnalyticsPDF();
        });
    }

    // 6. Listen to global storage resets or profile updates to refresh UI and active view
    window.addEventListener('profileChanged', async () => {
        updateSidebarProfileUI();
        await handleRouting();
    });

    // 7. Initial download from Google Sheets (if URL exists) on startup in background
    const profile = getProfile();
    if (profile.sheetsUrl) {
        syncFromSheets();
    }

    // 8. Fire initial routing for current load state
    handleRouting();
    
    // Initialize initial icons
    if (window.lucide) lucide.createIcons();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootApp);
} else {
    bootApp();
}
