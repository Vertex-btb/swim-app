/* ==========================================================================
   AeroSwim Workout & Training Log View
   ========================================================================== */

import { getWorkouts, addWorkout, deleteWorkout, safeFormatDate } from './storage.js';

// --- HTML Template for Workouts View ---

const WORKOUTS_VIEW_HTML = `
<!-- Workouts Overview Metrics -->
<div class="stats-grid" style="margin-bottom: 8px;">
    <div class="stat-card">
        <div class="stat-icon">
            <i data-lucide="compass"></i>
        </div>
        <div class="stat-info">
            <span class="stat-label">Season Yardage</span>
            <span class="stat-value" id="workout-stat-total">0 yd</span>
            <span class="stat-trend trend-neutral">Accumulated distance</span>
        </div>
    </div>
    
    <div class="stat-card">
        <div class="stat-icon">
            <i data-lucide="timer"></i>
        </div>
        <div class="stat-info">
            <span class="stat-label">Avg. Distance</span>
            <span class="stat-value" id="workout-stat-avg">0 yd</span>
            <span class="stat-trend trend-neutral">Per session average</span>
        </div>
    </div>

    <div class="stat-card">
        <div class="stat-icon">
            <i data-lucide="activity"></i>
        </div>
        <div class="stat-info">
            <span class="stat-label">Dominant Focus</span>
            <span class="stat-value" id="workout-stat-focus">Endurance</span>
            <span class="stat-trend trend-up" id="workout-stat-focus-sub">--</span>
        </div>
    </div>
</div>

<!-- Logs Header & List -->
<div class="card">
    <div class="card-header">
        <h2 class="card-title">
            <i data-lucide="dumbbell"></i>
            <span>Training & Practice Logs</span>
        </h2>
        <button class="btn btn-primary" id="btn-workouts-log-new">
            <i data-lucide="plus"></i>
            <span>Log Practice Session</span>
        </button>
    </div>

    <!-- Workouts Feed -->
    <div id="workouts-feed" style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Loaded dynamically -->
    </div>
</div>
`;

const FOCUS_THEMES = {
    'Endurance': { bg: 'rgba(0, 240, 255, 0.12)', border: 'rgba(0, 240, 255, 0.2)', color: 'var(--accent-cyan)' },
    'Sprint': { bg: 'rgba(255, 56, 56, 0.12)', border: 'rgba(255, 56, 56, 0.2)', color: 'var(--accent-red)' },
    'Technique': { bg: 'rgba(138, 43, 226, 0.15)', border: 'rgba(138, 43, 226, 0.2)', color: '#c084fc' },
    'Recovery': { bg: 'rgba(0, 255, 135, 0.12)', border: 'rgba(0, 255, 135, 0.2)', color: 'var(--accent-green)' },
    'Test Sets': { bg: 'rgba(255, 193, 7, 0.12)', border: 'rgba(255, 193, 7, 0.2)', color: 'var(--accent-gold)' },
    'Dry Land': { bg: 'rgba(157, 78, 221, 0.12)', border: 'rgba(157, 78, 221, 0.2)', color: 'var(--accent-purple)' },
    'Dry Land - Day 1': { bg: 'rgba(0, 240, 255, 0.12)', border: 'rgba(0, 240, 255, 0.2)', color: 'var(--accent-cyan)' },
    'Dry Land - Day 2': { bg: 'rgba(157, 78, 221, 0.12)', border: 'rgba(157, 78, 221, 0.2)', color: 'var(--accent-purple)' },
    'Dry Land - Day 3': { bg: 'rgba(255, 193, 7, 0.12)', border: 'rgba(255, 193, 7, 0.2)', color: 'var(--accent-gold)' }
};

/**
 * Calculates aggregates and renders workout entries
 */
async function renderWorkoutsList() {
    const feed = document.getElementById('workouts-feed');
    if (!feed) return;
    
    const workouts = await getWorkouts();
    
    let totalDist = 0;
    const focusCounts = {};
    
    workouts.forEach(w => {
        totalDist += parseInt(w.distance) || 0;
        const focusGroup = w.focus.startsWith('Dry Land') ? 'Dry Land' : w.focus;
        focusCounts[focusGroup] = (focusCounts[focusGroup] || 0) + 1;
    });

    const avgDist = workouts.length > 0 ? Math.round(totalDist / workouts.length) : 0;
    
    let dominantFocus = "None";
    let maxCount = 0;
    Object.keys(focusCounts).forEach(focus => {
        if (focusCounts[focus] > maxCount) {
            maxCount = focusCounts[focus];
            dominantFocus = focus;
        }
    });

    document.getElementById('workout-stat-total').innerText = `${totalDist.toLocaleString()} yd`;
    document.getElementById('workout-stat-avg').innerText = `${avgDist.toLocaleString()} yd`;
    document.getElementById('workout-stat-focus').innerText = dominantFocus;
    document.getElementById('workout-stat-focus-sub').innerText = workouts.length > 0 ? `${maxCount} of ${workouts.length} workouts` : "No sessions logged";

    feed.innerHTML = '';
    
    if (workouts.length === 0) {
        feed.innerHTML = `
            <div style="text-align: center; padding: 40px; color: var(--text-muted);">
                <i data-lucide="dumbbell" style="width: 48px; height: 48px; margin-bottom: 12px; stroke-width: 1.5;"></i>
                <p style="font-weight: 500;">No workout logs found.</p>
                <p style="font-size: 12px; margin-top: 4px;">Click "Log Practice Session" to track your training yardage and focus!</p>
            </div>
        `;
        return;
    }

    workouts.forEach(w => {
        const theme = FOCUS_THEMES[w.focus] || FOCUS_THEMES.Endurance;
        const card = document.createElement('div');
        card.className = 'workout-item';
        card.style.cssText = `
            background: rgba(255, 255, 255, 0.01);
            border: 1px solid var(--glass-border);
            border-left: 4px solid ${theme.color};
            border-radius: var(--border-radius-sm);
            padding: 20px;
            display: flex;
            flex-direction: column;
            gap: 12px;
        `;
        
        const hasTime = w.date.includes(' ') || w.date.includes(':');
        const dateFormatted = safeFormatDate(w.date, hasTime ? {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        } : {
            weekday: 'short',
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });

        const detailsFormatted = w.details ? w.details.replace(/\[x\]/g, '☑').replace(/\[ \]/g, '☐') : "No details provided.";

        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 8px;">
                <div>
                    <span style="font-size: 12px; color: var(--text-muted); display: block; margin-bottom: 2px;">${dateFormatted}</span>
                    <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
                        <h3 style="font-size: 16px; color: var(--text-primary);">${w.focus}</h3>
                        <span class="badge" style="background: ${theme.bg}; border: 1px solid ${theme.border}; color: ${theme.color};">
                            ${parseInt(w.distance) > 0 ? parseInt(w.distance).toLocaleString() + ' yd &bull; ' : ''}${w.duration} min
                        </span>
                    </div>
                </div>
                <button class="btn btn-danger btn-delete-workout" data-id="${w.id}" style="padding: 6px 10px; font-size: 11px;">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                    <span>Delete</span>
                </button>
            </div>

            <div style="background: rgba(255,255,255,0.015); border: 1px solid rgba(255,255,255,0.03); border-radius: 4px; padding: 12px 16px; font-family: monospace; font-size: 13px; color: var(--text-primary); white-space: pre-wrap; line-height: 1.5; margin-top: 4px;">${detailsFormatted}</div>

            ${w.notes ? `
            <div style="display: flex; gap: 10px; padding: 10px 14px; background: rgba(0, 240, 255, 0.02); border-left: 2px solid var(--accent-cyan); border-radius: 0 4px 4px 0; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
                <i data-lucide="message-square" style="width: 14px; height: 14px; color: var(--accent-cyan); flex-shrink: 0; margin-top: 1px;"></i>
                <p><strong>Coach's Feedback:</strong> <em>"${w.notes}"</em></p>
            </div>
            ` : ''}
        `;
        
        feed.appendChild(card);
    });

    feed.querySelectorAll('.btn-delete-workout').forEach(btn => {
        btn.addEventListener('click', async () => {
            const id = btn.getAttribute('data-id');
            if (confirm("Are you sure you want to delete this workout log?")) {
                await deleteWorkout(id);
                await renderWorkoutsList();
            }
        });
    });

    lucide.createIcons();
}

let activeWorkoutType = 'pool';

function setWorkoutType(type) {
    const typeBtnPool = document.getElementById('workout-type-pool');
    const typeBtnDryland = document.getElementById('workout-type-dryland');
    const poolFields = document.getElementById('pool-fields');
    const drylandFields = document.getElementById('dryland-fields');
    const workoutTypeInput = document.getElementById('workout-type');
    
    if (!typeBtnPool || !typeBtnDryland || !poolFields || !drylandFields || !workoutTypeInput) return;
    
    workoutTypeInput.value = type;
    activeWorkoutType = type;
    
    if (type === 'pool') {
        typeBtnPool.style.background = 'var(--accent-cyan)';
        typeBtnPool.style.color = '#000';
        typeBtnPool.style.borderColor = 'var(--accent-cyan)';
        
        typeBtnDryland.style.background = 'transparent';
        typeBtnDryland.style.color = '#fff';
        typeBtnDryland.style.borderColor = 'var(--glass-border)';
        
        poolFields.style.display = 'flex';
        drylandFields.style.display = 'none';
        
        document.getElementById('workout-input-distance').required = true;
        document.getElementById('workout-input-duration').required = true;
        document.getElementById('workout-input-focus').required = true;
    } else {
        typeBtnPool.style.background = 'transparent';
        typeBtnPool.style.color = '#fff';
        typeBtnPool.style.borderColor = 'var(--glass-border)';
        
        typeBtnDryland.style.background = 'var(--accent-purple)';
        typeBtnDryland.style.color = '#fff';
        typeBtnDryland.style.borderColor = 'var(--accent-purple)';
        
        poolFields.style.display = 'none';
        drylandFields.style.display = 'flex';
        
        document.getElementById('workout-input-distance').required = false;
        document.getElementById('workout-input-duration').required = false;
        document.getElementById('workout-input-focus').required = false;
        
        selectDrylandDay(1);
    }
}

function selectDrylandDay(day) {
    const tile1 = document.getElementById('tile-day-1');
    const tile2 = document.getElementById('tile-day-2');
    const tile3 = document.getElementById('tile-day-3');
    const activeDayInput = document.getElementById('dryland-active-day');
    
    if (!tile1 || !tile2 || !tile3 || !activeDayInput) return;
    
    activeDayInput.value = day;
    
    [tile1, tile2, tile3].forEach((t, idx) => {
        const dNum = idx + 1;
        const radio = document.getElementById(`radio-day-${dNum}`);
        const checkboxes = document.querySelectorAll(`.day-${dNum}-check`);
        
        if (dNum === day) {
            t.style.opacity = '1';
            t.style.background = 'rgba(255, 255, 255, 0.02)';
            let accentColor = 'var(--accent-cyan)';
            if (day === 2) accentColor = 'var(--accent-purple)';
            if (day === 3) accentColor = 'var(--accent-gold)';
            t.style.borderColor = accentColor;
            if (radio) radio.checked = true;
            checkboxes.forEach(c => c.disabled = false);
        } else {
            t.style.opacity = '0.4';
            t.style.background = 'rgba(255, 255, 255, 0.01)';
            t.style.borderColor = 'var(--glass-border)';
            if (radio) radio.checked = false;
            checkboxes.forEach(c => c.disabled = true);
        }
    });
}

function openWorkoutModal() {
    const modal = document.getElementById('workout-modal');
    document.getElementById('workout-form').reset();
    document.getElementById('workout-input-date').value = new Date().toISOString().slice(0, 10);
    
    // Set time to current time
    const now = new Date();
    const timeStr = ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2);
    document.getElementById('workout-input-time').value = timeStr;
    
    setWorkoutType('pool');
    modal.classList.add('active');
}

function closeWorkoutModal() {
    document.getElementById('workout-modal').classList.remove('active');
}

// --- Main View Hook ---

export async function initWorkoutsView() {
    const container = document.getElementById('main-viewport');
    container.innerHTML = WORKOUTS_VIEW_HTML;
    
    document.getElementById('btn-workouts-log-new').addEventListener('click', openWorkoutModal);
    
    await renderWorkoutsList();
}

// Global modal hook (run once on application startup)
export function setupWorkoutModalListeners() {
    const form = document.getElementById('workout-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const type = document.getElementById('workout-type').value;
        const dateVal = document.getElementById('workout-input-date').value;
        const timeVal = document.getElementById('workout-input-time').value;
        const notes = document.getElementById('workout-input-notes').value;
        
        // Combine date and time to support multiple workouts in a single day
        const date = `${dateVal} ${timeVal}`;
        
        let entry = {};
        
        if (type === 'pool') {
            const distance = parseInt(document.getElementById('workout-input-distance').value) || 0;
            const focus = document.getElementById('workout-input-focus').value;
            const duration = parseInt(document.getElementById('workout-input-duration').value) || 0;
            const details = document.getElementById('workout-input-details').value;
            
            entry = { date, distance, focus, duration, details, notes };
        } else {
            // Dryland workout submit
            const day = parseInt(document.getElementById('dryland-active-day').value) || 1;
            const focus = `Dry Land - Day ${day}`;
            const distance = 0;
            const duration = 20; // 20 mins for weekly regimens
            
            let details = "";
            let dayTitle = "";
            let exercises = [];
            
            if (day === 1) {
                dayTitle = "Day 1: Rowing & Dumbbell Strength";
                exercises = [
                    "Warm-up: 2 minutes of light rowing to loosen the joints.",
                    "Rowing Intervals (5 minutes): 30 seconds fast / 30 seconds easy.",
                    "Dumbbell Goblet Squats (3 sets x 12 reps)",
                    "Dumbbell Floor Press (3 sets x 12 reps)",
                    "Plank Finisher: 45-second front plank."
                ];
            } else if (day === 2) {
                dayTitle = "Day 2: The \"Easy Run\" & Core Power";
                exercises = [
                    "The Easy Run (12 minutes jog)",
                    "Squat Jumps (2 sets x 8 reps)",
                    "Streamline Holds (3 sets x 30 seconds)",
                    "Superman Holds (2 sets x 10 reps)"
                ];
            } else {
                dayTitle = "Day 3: Peloton Spin & Upper Body Stability";
                exercises = [
                    "Peloton Spin (10 minutes)",
                    "Light Dumbbell Overhead Press (2 sets x 10 reps)",
                    "Dumbbell Romanian Deadlifts (2 sets x 12 reps)",
                    "Scapular Wall Slides (2 minutes)"
                ];
            }
            
            details += `${dayTitle}\nCompleted Exercises:\n`;
            
            const checkboxes = document.querySelectorAll(`.day-${day}-check`);
            checkboxes.forEach((cb, idx) => {
                const marker = cb.checked ? "[x]" : "[ ]";
                details += `${marker} ${exercises[idx]}\n`;
            });
            
            entry = { date, distance, focus, duration, details, notes };
        }

        await addWorkout(entry);
        closeWorkoutModal();
        
        if (window.location.hash === '#workouts') {
            await renderWorkoutsList();
        } else if (window.location.hash === '#dashboard' || !window.location.hash) {
            window.dispatchEvent(new Event('hashchange'));
        }
    });

    // Toggle workout type category button listeners
    document.getElementById('workout-type-pool').addEventListener('click', () => setWorkoutType('pool'));
    document.getElementById('workout-type-dryland').addEventListener('click', () => setWorkoutType('dryland'));
    
    // Day Selection Tile click listeners
    document.getElementById('tile-day-1').addEventListener('click', () => selectDrylandDay(1));
    document.getElementById('tile-day-2').addEventListener('click', () => selectDrylandDay(2));
    document.getElementById('tile-day-3').addEventListener('click', () => selectDrylandDay(3));

    document.getElementById('close-workout-modal').addEventListener('click', closeWorkoutModal);
    document.getElementById('cancel-workout-btn').addEventListener('click', closeWorkoutModal);
}
