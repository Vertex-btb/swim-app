/* ==========================================================================
   AeroSwim Dashboard View
   ========================================================================== */

import { getProfile, getTimes, getWorkouts, getNutritionForDate, timeStringToSeconds, secondsToTimeString, safeFormatDate } from './storage.js';

// --- Dashboard Layout Template ---

const DASHBOARD_HTML = `
<!-- Stats Cards Grid -->
<div class="stats-grid">
    <div class="stat-card">
        <div class="stat-icon">
            <i data-lucide="award"></i>
        </div>
        <div class="stat-info">
            <span class="stat-label">Personal Records</span>
            <span class="stat-value" id="stat-pr-count">0</span>
            <span class="stat-trend trend-up"><i data-lucide="sparkles"></i> Golden Bests</span>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-icon">
            <i data-lucide="compass"></i>
        </div>
        <div class="stat-info">
            <span class="stat-label">Total Yards Swum</span>
            <span class="stat-value" id="stat-total-distance">0 yd</span>
            <span class="stat-trend trend-neutral"><i data-lucide="calendar"></i> Training Log</span>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon">
            <i data-lucide="activity"></i>
        </div>
        <div class="stat-info">
            <span class="stat-label">Workouts Logged</span>
            <span class="stat-value" id="stat-workout-count">0</span>
            <span class="stat-trend trend-up" id="stat-workout-duration">-- min</span>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon">
            <i data-lucide="droplet"></i>
        </div>
        <div class="stat-info">
            <span class="stat-label">Hydration Today</span>
            <span class="stat-value" id="stat-water-intake">0 / 8</span>
            <span class="stat-trend trend-down" id="stat-water-percent">0% Goal</span>
        </div>
    </div>
</div>

<!-- Lower Two-Column Grid -->
<div style="display: grid; grid-template-columns: 2fr 1fr; gap: 32px; margin-top: 8px;">
    <!-- Recent Achievements Feed -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">
                <i data-lucide="zap"></i>
                <span>Recent Swim Achievements</span>
            </h2>
            <button class="btn btn-secondary" onclick="window.location.hash='#times'" style="padding: 6px 12px; font-size: 12px;">View All</button>
        </div>
        <div class="achievement-list" id="dashboard-recent-feed">
            <!-- Loaded dynamically -->
        </div>
    </div>

    <!-- Countdown & Goals -->
    <div style="display: flex; flex-direction: column; gap: 32px;">
        <!-- Countdown Card -->
        <div class="card" style="background: linear-gradient(135deg, rgba(138, 43, 226, 0.15) 0%, rgba(0, 240, 255, 0.05) 100%); border-color: rgba(138, 43, 226, 0.2);">
            <div class="card-header">
                <h3 class="card-title" style="font-size: 16px;">
                    <i data-lucide="calendar" style="color: var(--accent-purple);"></i>
                    <span>Next Championship Meet</span>
                </h3>
            </div>
            <div style="text-align: center; padding: 12px 0;">
                <div style="font-size: 48px; font-weight: 800; font-family: 'Outfit', sans-serif; color: var(--accent-cyan); text-shadow: 0 0 15px rgba(0, 240, 255, 0.4);" id="countdown-days">
                    34
                </div>
                <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--text-secondary); margin-bottom: 12px;">
                    Days Remaining
                </div>
                <p style="font-size: 13px; font-weight: 500;" id="countdown-meet-name">State Age Group Championships</p>
                <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">August 22, 2026</p>
            </div>
        </div>

        <!-- Profile Quick view -->
        <div class="card">
            <div class="card-header">
                <h3 class="card-title" style="font-size: 16px;">
                    <i data-lucide="user"></i>
                    <span>Swimmer Profile</span>
                </h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 12px; font-size: 13px;">
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Swimmer Name:</span>
                    <strong style="color: var(--text-primary);" id="dash-prof-name">Leo</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Current Age:</span>
                    <strong style="color: var(--text-primary);" id="dash-prof-age">14</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Club Team:</span>
                    <strong style="color: var(--text-primary);" id="dash-prof-team">Aero Swim Club</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span style="color: var(--text-secondary);">Total Records:</span>
                    <strong style="color: var(--text-primary);" id="dash-prof-count">0 times</strong>
                </div>
                <button class="btn btn-secondary" id="dash-edit-profile-btn" style="margin-top: 8px; width: 100%;">
                    <i data-lucide="settings"></i>
                    <span>Edit Profile Settings</span>
                </button>
            </div>
        </div>
    </div>
</div>
`;

// --- Computations for Dashboard ---

/**
 * Calculates how many distinct Event+Course types exist, and which are the Personal Records.
 * In swim tracking, a PR is the fastest time (minimum seconds) for a given Event and Course.
 */
function calculatePRs(times) {
    const prMap = {}; // Key: "Event-Course", Value: timeEntry
    
    times.forEach(entry => {
        const key = `${entry.event}_${entry.course}`;
        const seconds = timeStringToSeconds(entry.time);
        
        if (seconds === Infinity) return; // Disqualifications are not valid PR times
        
        if (!prMap[key]) {
            prMap[key] = entry;
        } else {
            const currentMinSecs = timeStringToSeconds(prMap[key].time);
            if (seconds < currentMinSecs) {
                prMap[key] = entry;
            }
        }
    });
    
    return prMap;
}

/**
 * Renders the dashboard view
 */
export async function initDashboardView() {
    const container = document.getElementById('main-viewport');
    container.innerHTML = DASHBOARD_HTML;
    
    const times = await getTimes();
    const workouts = await getWorkouts();
    const profile = getProfile();
    
    // Get current date string for hydration check
    const todayStr = new Date().toISOString().slice(0, 10);
    const nutrition = getNutritionForDate(todayStr);

    // 1. Calculate PR Count
    const prMap = calculatePRs(times);
    const prCount = Object.keys(prMap).length;
    document.getElementById('stat-pr-count').innerText = prCount;

    // 2. Calculate Total Workout Yardage & Session Count
    let totalYards = 0;
    let totalMinutes = 0;
    workouts.forEach(w => {
        totalYards += parseInt(w.distance) || 0;
        totalMinutes += parseInt(w.duration) || 0;
    });
    document.getElementById('stat-total-distance').innerText = `${totalYards.toLocaleString()} yd`;
    document.getElementById('stat-workout-count').innerText = workouts.length;
    document.getElementById('stat-workout-duration').innerText = `${totalMinutes} min total`;

    // 3. Hydration Stats
    const waterCups = nutrition.waterCups || 0;
    const waterPercent = Math.min(Math.round((waterCups / 8) * 100), 100);
    document.getElementById('stat-water-intake').innerText = `${waterCups} / 8 cups`;
    document.getElementById('stat-water-percent').innerText = `${waterPercent}% of Daily Goal`;

    // 4. Swimmer Profile Summary
    document.getElementById('dash-prof-name').innerText = profile.name;
    document.getElementById('dash-prof-age').innerText = profile.age;
    document.getElementById('dash-prof-team').innerText = profile.team || 'None';
    document.getElementById('dash-prof-count').innerText = `${times.length} times logged`;

    // Set up hook for profile modal
    document.getElementById('dash-edit-profile-btn').addEventListener('click', () => {
        document.getElementById('open-profile-settings').click();
    });

    // 5. Generate Recent Achievements Feed
    const feedContainer = document.getElementById('dashboard-recent-feed');
    feedContainer.innerHTML = '';
    
    // Take the 4 most recent swim times
    const recentTimes = times.slice(0, 4);
    
    if (recentTimes.length === 0) {
        feedContainer.innerHTML = `
            <div style="text-align: center; padding: 40px var(--text-secondary); color: var(--text-muted); font-size: 14px;">
                <i data-lucide="inbox" style="width: 40px; height: 40px; margin-bottom: 12px; stroke-width: 1.5;"></i>
                <p>No swim times logged yet.</p>
                <p style="font-size: 12px; margin-top: 4px;">Go to the "Times & Meets" tab or "Data Manager" to import data!</p>
            </div>
        `;
    } else {
        recentTimes.forEach(entry => {
            const isDQ = entry.time.trim().toUpperCase() === 'DQ';
            const prEntry = isDQ ? null : prMap[`${entry.event}_${entry.course}`];
            const isPR = !isDQ && prEntry && prEntry.id === entry.id;
            
            // Check if they dropped time compared to their previous swim in this event
            // Filter all swims in this event/course that happened BEFORE this swim's date, excluding DQs
            const previousSwims = times
                .filter(t => t.event === entry.event && t.course === entry.course && t.time.trim().toUpperCase() !== 'DQ' && new Date(t.date) < new Date(entry.date))
                .sort((a, b) => new Date(b.date) - new Date(a.date)); // Sort descending to get the closest past swim
            
            let timeDropHtml = '';
            if (!isDQ && previousSwims.length > 0) {
                const prevSecs = timeStringToSeconds(previousSwims[0].time);
                const currSecs = timeStringToSeconds(entry.time);
                const diff = prevSecs - currSecs;
                if (diff > 0) {
                    timeDropHtml = `<span class="time-drop-badge"><i data-lucide="trending-down" style="width:12px; height:12px; margin-right:2px;"></i>Dropped ${diff.toFixed(2)}s</span>`;
                }
            }

            const item = document.createElement('div');
            item.className = 'achievement-item';
            
            const eventFormatted = entry.event.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            
            let trophyStyle = '';
            let trophyIcon = 'timer';
            if (isDQ) {
                trophyStyle = 'background: rgba(255, 56, 56, 0.12); color: var(--accent-red); border: 1px solid rgba(255, 56, 56, 0.15);';
                trophyIcon = 'alert-triangle';
            } else if (isPR) {
                trophyStyle = '';
                trophyIcon = 'trophy';
            } else {
                trophyStyle = 'background: rgba(255,255,255,0.03); color: var(--text-muted);';
                trophyIcon = 'timer';
            }
            
            item.innerHTML = `
                <div class="achievement-trophy" style="${trophyStyle}">
                    <i data-lucide="${trophyIcon}"></i>
                </div>
                <div class="achievement-info" style="flex: 1;">
                    <h4 style="display: flex; align-items: center; gap: 8px;">
                        <span>${eventFormatted} (${entry.course})</span>
                        ${isPR ? '<span class="pr-badge"><i data-lucide="star" style="width:12px; height:12px; fill:currentColor;"></i>PR</span>' : ''}
                        ${isDQ ? '<span class="badge" style="background: rgba(255, 56, 56, 0.15); border: 1px solid rgba(255, 56, 56, 0.2); color: var(--accent-red); font-size: 10px; padding: 2px 6px;">Disqualified</span>' : ''}
                        ${timeDropHtml}
                    </h4>
                    <p>${entry.location} &bull; ${safeFormatDate(entry.date)}</p>
                </div>
                <div style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; color: ${isDQ ? 'var(--accent-red)' : (isPR ? 'var(--accent-cyan)' : 'var(--text-primary)')}">
                    ${isDQ ? 'DQ' : entry.time}
                </div>
            `;
            feedContainer.appendChild(item);
        });
    }

    // 6. Countdown Calculator
    // Find any future meet in times, or show a standard countdown to a summer meet
    const today = new Date();
    let meetDate = new Date(today.getFullYear(), 7, 22); // Default: August 22 of current year
    let meetName = "State Age Group Championships";
    
    // Check if there are any future swim dates logged in times (these are future meets!)
    const futureMeets = times.filter(t => new Date(t.date) > today).sort((a,b) => new Date(a.date) - new Date(b.date));
    if (futureMeets.length > 0) {
        meetDate = new Date(futureMeets[0].date);
        meetName = futureMeets[0].location;
    } else if (today > meetDate) {
        // If August 22 has passed, set it to March 15 of next year (Short Course Championships)
        meetDate = new Date(today.getFullYear() + 1, 2, 15);
        meetName = "Short Course Yards Championship";
    }
    
    const diffTime = meetDate - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    document.getElementById('countdown-days').innerText = diffDays > 0 ? diffDays : 0;
    document.getElementById('countdown-meet-name').innerText = meetName;
    document.getElementById('countdown-meet-name').nextElementSibling.innerText = safeFormatDate(meetDate, {month: 'long', day: 'numeric', year: 'numeric'});

    // Initialize Lucide Icons
    lucide.createIcons();
}
