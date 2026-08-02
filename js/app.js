/* ==========================================================================
   AeroSwim SPA Router & Bootstrap Entrypoint (Async Sheets Integration)
   ========================================================================== */

import { initializeStorage, getProfile, saveProfile, syncFromSheets } from './storage.js';
import { initDashboardView } from './dashboard.js';
import { initTimesView, setupTimeModalListeners } from './times.js';
import { initStandardsView } from './standards.js';
import { initAnalyticsView } from './analytics.js';
import { initForecastView } from './forecast.js';
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
async function handleRouting() {
    const hash = window.location.hash || '#dashboard';
    const route = ROUTES[hash] || ROUTES['#dashboard'];
    
    // 1. Update active class in sidebar navigation
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('href') === hash) {
            item.classList.add('active');
        }
    });
    
    // 2. Set Top Bar title
    const viewTitleEl = document.getElementById('view-title');
    if (viewTitleEl) {
        viewTitleEl.innerText = route.title;
    }
    
    // 3. Initialize target view content (Async support)
    if (typeof route.init === 'function') {
        await route.init();
    }
    
    // 4. Close mobile sidebar menu drawer if open
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar) {
        sidebar.classList.remove('open');
    }
}

// --- Swimmer Profile Modal Handling ---

function openProfileModal() {
    const modal = document.getElementById('profile-modal');
    const profile = getProfile();
    
    document.getElementById('input-swimmer-name').value = profile.name || '';
    document.getElementById('input-swimmer-age').value = profile.age || '';
    document.getElementById('input-swimmer-gender').value = profile.gender || 'Boys';
    document.getElementById('input-swimmer-team').value = profile.team || '';
    document.getElementById('input-sheets-url').value = profile.sheetsUrl || '';
    document.getElementById('input-sheets-key').value = profile.sheetsKey || '';
    
    modal.classList.add('active');
}

function closeProfileModal() {
    document.getElementById('profile-modal').classList.remove('active');
}

function setupProfileModalListeners() {
    const form = document.getElementById('profile-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const name = document.getElementById('input-swimmer-name').value.trim();
        const age = parseInt(document.getElementById('input-swimmer-age').value) || 0;
        const gender = document.getElementById('input-swimmer-gender').value;
        const team = document.getElementById('input-swimmer-team').value.trim();
        const sheetsUrl = document.getElementById('input-sheets-url').value.trim();
        const sheetsKey = document.getElementById('input-sheets-key').value.trim();
        
        const oldProfile = getProfile();
        
        // Save profile
        await saveProfile({ name, age, gender, team, sheetsUrl, sheetsKey });
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
    
    document.getElementById('open-profile-settings').addEventListener('click', openProfileModal);
    document.getElementById('close-profile-modal').addEventListener('click', closeProfileModal);
    document.getElementById('cancel-profile-btn').addEventListener('click', closeProfileModal);
}

// --- Application Core Entrypoint ---

document.addEventListener('DOMContentLoaded', async () => {
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
    
    // 5. Wire mobile sidebar sliding drawer
    const mobileToggle = document.getElementById('mobile-sidebar-toggle');
    const sidebar = document.getElementById('app-sidebar');
    
    if (mobileToggle && sidebar) {
        mobileToggle.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });
    }

    // 5b. Global sync button click listener (Force update from Google Sheets)
    const syncBtn = document.getElementById('global-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            const icon = syncBtn.querySelector('[data-lucide="refresh-cw"]') || syncBtn.querySelector('i');
            if (icon) icon.classList.add('spinning');
            syncBtn.disabled = true;
            
            // Force fetch remote data
            await syncFromSheets(true);
            
            // Re-render active view to show newly downloaded data
            await handleRouting();
            
            setTimeout(() => {
                if (icon) icon.classList.remove('spinning');
                syncBtn.disabled = false;
            }, 800);
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
    await handleRouting();
    
    // Initialize initial icons
    lucide.createIcons();
});
