/* ==========================================================================
   AeroSwim - Cross Island & Flushing Y Holiday Invitational Progress Tracker
   ========================================================================== */

import { getProfile, getTimes, timeStringToSeconds, secondsToTimeString } from './storage.js';
import { HOLIDAY_INVITATIONAL_CUTS } from './standards.js';
import { convertCourseTime } from './conversions.js';

let displayUnit = 'SCY'; // 'SCY', 'LCM', 'SCM'
let viewLayout = 'tiles'; // 'tiles' or 'table'
let meetData = null;      // Parsed meet_cuts.json
let selectedMeet = null;  // Key within meetData.meets

const EVENT_ORDER = ['50-free','100-free','200-free','50-back','100-back','200-back','50-breast','100-breast','200-breast','50-fly','100-fly','200-fly','100-IM','200-IM'];

/**
 * Loads meet cuts from meet_cuts.json (falls back to hardcoded Holiday cuts if unavailable)
 */
async function loadMeetCuts() {
    try {
        const res = await fetch('meet_cuts.json', { cache: 'no-store' });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        meetData = await res.json();
    } catch (err) {
        console.warn('Could not load meet_cuts.json, using built-in Holiday cuts:', err);
        const fallback = {};
        Object.entries(HOLIDAY_INVITATIONAL_CUTS["11-12"]["Boys"]).forEach(([ev, c]) => fallback[ev] = c.Cut);
        meetData = { ageGroup: '11-12', gender: 'Boys', meets: { 'LI Holiday Invitational': fallback } };
    }
    const names = Object.keys(meetData.meets);
    if (!selectedMeet || !names.includes(selectedMeet)) selectedMeet = names[0];
}

/**
 * Renders the Holiday Invitational Meet Tracker View
 */
export async function initHolidayInvitationalView() {
    const container = document.getElementById('main-viewport');
    if (!container) return;

    if (!meetData) await loadMeetCuts();

    const viewTitle = document.getElementById('view-title');
    if (viewTitle) viewTitle.innerText = "Special Meets";

    container.innerHTML = `
        <div class="view-content" style="animation: fadeIn var(--transition-normal);">
            <!-- Meet Banner Header Card -->
            <div class="card" style="padding: 24px; border-left: 4px solid var(--accent-gold); background: linear-gradient(135deg, rgba(255,193,7,0.06), rgba(0,240,255,0.03)); margin-bottom: 24px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
                            <span class="badge badge-aaaa" style="font-size: 11px; font-weight: 700; text-transform: uppercase;">December Meet Target</span>
                            <span style="font-size: 12px; color: var(--text-muted);"><i data-lucide="map-pin" style="width: 14px; height: 14px; vertical-align: middle;"></i> ${(meetData.locations && meetData.locations[selectedMeet]) || 'Location TBD'}</span>
                        </div>
                        <h2 style="font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px;">
                            ${selectedMeet}
                        </h2>
                        <p style="font-size: 13px; color: var(--text-secondary); max-width: 680px;">
                            Track your personal best swims against qualifying time standards for the ${meetData.ageGroup} ${meetData.gender} division. Cuts are loaded from meet_cuts.json.
                        </p>
                    </div>

                    <!-- Display Unit & Layout Controls -->
                    <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
                        <div>
                            <label style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px; font-weight: 600;">Meet</label>
                            <select id="holiday-meet-select" class="form-control" style="padding: 8px 12px; font-size: 13px; min-width: 190px; background: rgba(0,0,0,0.3);">
                                ${Object.keys(meetData.meets).map(m => `<option value="${m}" ${m === selectedMeet ? 'selected' : ''}>${m}</option>`).join('')}
                            </select>
                        </div>
                        <div>
                            <label style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; margin-bottom: 4px; font-weight: 600;">Display Course</label>
                            <select id="holiday-unit-select" class="form-control" style="padding: 8px 12px; font-size: 13px; min-width: 160px; background: rgba(0,0,0,0.3);">
                                <option value="SCY" ${displayUnit === 'SCY' ? 'selected' : ''}>Yards (25yd SCY)</option>
                                <option value="LCM" ${displayUnit === 'LCM' ? 'selected' : ''}>Meters (50m LCM)</option>
                                <option value="SCM" ${displayUnit === 'SCM' ? 'selected' : ''}>Meters (25m SCM)</option>
                            </select>
                        </div>
                        <div style="display: flex; gap: 4px; align-self: flex-end;">
                            <button id="btn-holiday-tiles" class="btn ${viewLayout === 'tiles' ? 'btn-primary' : 'btn-outline'}" style="padding: 8px 14px; font-size: 12px;" title="Grid View">
                                <i data-lucide="layout-grid"></i>
                            </button>
                            <button id="btn-holiday-table" class="btn ${viewLayout === 'table' ? 'btn-primary' : 'btn-outline'}" style="padding: 8px 14px; font-size: 12px;" title="Table View">
                                <i data-lucide="table"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Content Sheet Container -->
            <div id="holiday-sheet-container"></div>
        </div>
    `;

    await renderHolidayTrackerSheet();
    bindHolidayEvents();
    if (window.lucide) lucide.createIcons();
}

/**
 * Builds and renders the qualifying standards tiles grid or breakdown table
 */
async function renderHolidayTrackerSheet() {
    const container = document.getElementById('holiday-sheet-container');
    if (!container) return;

    try {
        const profile = getProfile() || {};
        const times = (await getTimes()) || [];

        const targetCuts = meetData.meets[selectedMeet];
        const targetEventKeys = Object.keys(targetCuts).sort((a, b) => {
            const ia = EVENT_ORDER.indexOf(a), ib = EVENT_ORDER.indexOf(b);
            return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        });

        // Group valid logged times by event
        const eventMap = {};
        times.forEach(t => {
            if (!t || t.isDQ || t.time === 'DQ' || !t.event) return;
            if (!eventMap[t.event]) eventMap[t.event] = [];
            eventMap[t.event].push(t);
        });

        // Helper to find swimmer's fastest logged swim for a specific course
        const getBestSwim = (evKey, course) => {
            const list = (eventMap[evKey] || []).filter(t => t.course === course);
            if (list.length === 0) return null;
            let best = list[0];
            list.forEach(t => {
                if (timeStringToSeconds(t.time) < timeStringToSeconds(best.time)) best = t;
            });
            return best;
        };

        let totalQualified = 0;
        let totalEvents = targetEventKeys.length;
        let closestEventName = 'None';
        let smallestGapSecs = 9999;

        let tilesHtml = '';
        let tableRowsHtml = '';

        targetEventKeys.forEach(evKey => {
            const targetSCYCutStr = targetCuts[evKey];
            const targetSCYSecs = timeStringToSeconds(targetSCYCutStr);

            // Convert target cut into displayUnit
            const convertedTargetCut = convertCourseTime(targetSCYCutStr, 'SCY', displayUnit, evKey);
            const targetCutFormatted = convertedTargetCut.formatted;
            const targetCutSecs = convertedTargetCut.seconds || targetSCYSecs;

            // Find swimmer best performance across courses
            const scyBest = getBestSwim(evKey, 'SCY');
            const lcmBest = getBestSwim(evKey, 'LCM');
            const scmBest = getBestSwim(evKey, 'SCM');

            const candidates = [];
            if (scyBest) {
                const conv = convertCourseTime(scyBest.time, 'SCY', displayUnit, evKey);
                if (conv.seconds) candidates.push({ sec: conv.seconds, formatted: conv.formatted, source: `Spring SCY (${scyBest.time})`, raw: scyBest.time, date: scyBest.date });
            }
            if (lcmBest) {
                const conv = convertCourseTime(lcmBest.time, 'LCM', displayUnit, evKey);
                if (conv.seconds) candidates.push({ sec: conv.seconds, formatted: conv.formatted, source: `Summer LCM (${lcmBest.time})`, raw: lcmBest.time, date: lcmBest.date });
            }
            if (scmBest) {
                const conv = convertCourseTime(scmBest.time, 'SCM', displayUnit, evKey);
                if (conv.seconds) candidates.push({ sec: conv.seconds, formatted: conv.formatted, source: `SCM (${scmBest.time})`, raw: scmBest.time, date: scmBest.date });
            }

            let unifiedBestSecs = null;
            let unifiedFormatted = '--:--.--';
            let unifiedSourceNote = 'No swims logged yet';

            if (candidates.length > 0) {
                candidates.sort((a, b) => a.sec - b.sec);
                unifiedBestSecs = candidates[0].sec;
                unifiedFormatted = candidates[0].formatted;
                unifiedSourceNote = candidates[0].source;
            }

            // Event Formatting
            const parts = evKey.split('-');
            const dist = parts[0];
            const strokeCode = parts[1] ? parts[1].toUpperCase() : 'FREE';
            let strokeTitle = strokeCode;
            if (strokeCode === 'FREE') strokeTitle = 'Freestyle';
            else if (strokeCode === 'BACK') strokeTitle = 'Backstroke';
            else if (strokeCode === 'BREAST') strokeTitle = 'Breaststroke';
            else if (strokeCode === 'FLY') strokeTitle = 'Butterfly';
            else if (strokeCode === 'IM') strokeTitle = 'Individual Medley';

            const unitLabel = displayUnit === 'SCY' ? 'Yard' : (displayUnit === 'LCM' ? 'Long Course Meter' : 'Short Course Meter');
            const fullEventTitle = `${dist} ${unitLabel} ${strokeTitle}`;

            // Qualification Status Calculation
            let isQualified = false;
            let gapSecs = null;
            let gapText = 'No logged swims';
            let progressPercent = 0;

            if (unifiedBestSecs) {
                if (unifiedBestSecs <= targetCutSecs) {
                    isQualified = true;
                    totalQualified++;
                    gapText = '🏆 QUALIFIED!';
                    progressPercent = 100;
                } else {
                    gapSecs = unifiedBestSecs - targetCutSecs;
                    gapText = `Need ↓ -${gapSecs.toFixed(2)}s`;

                    if (gapSecs < smallestGapSecs) {
                        smallestGapSecs = gapSecs;
                        closestEventName = `${dist} ${strokeTitle} (Need -${gapSecs.toFixed(2)}s)`;
                    }

                    // Progress % calculation (Baseline set 20% slower than cut)
                    const baselineSecs = targetCutSecs * 1.20;
                    progressPercent = Math.max(10, Math.min(95, Math.round(((baselineSecs - unifiedBestSecs) / (baselineSecs - targetCutSecs)) * 100)));
                }
            }

            // --- 1. EVENT CARD TILE HTML ---
            tilesHtml += `
                <div class="card" style="padding: 20px; border-radius: 16px; border: 1px solid ${isQualified ? 'rgba(0, 255, 135, 0.3)' : 'var(--glass-border)'}; background: ${isQualified ? 'rgba(0, 255, 135, 0.03)' : 'rgba(255,255,255,0.02)'}; display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; transition: transform var(--transition-fast);">
                    <div style="position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: ${isQualified ? 'var(--accent-green)' : 'linear-gradient(90deg, var(--accent-gold), var(--accent-cyan))'};"></div>

                    <div>
                        <!-- Tile Header -->
                        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
                            <div>
                                <span style="font-size: 10px; text-transform: uppercase; color: var(--accent-gold); font-weight: 700; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">
                                    ${meetData.ageGroup} ${meetData.gender} &bull; ${selectedMeet}
                                </span>
                                <h3 style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 800; color: #fff; margin: 0;">
                                    ${fullEventTitle}
                                </h3>
                            </div>
                            <div>
                                ${isQualified 
                                    ? `<span class="badge badge-aaaa" style="font-size: 11px; padding: 4px 10px; background: rgba(0, 255, 135, 0.15); color: var(--accent-green); border: 1px solid rgba(0, 255, 135, 0.4);">🏆 Qualified</span>` 
                                    : `<span class="badge" style="font-size: 11px; padding: 4px 10px; background: rgba(255, 193, 7, 0.1); color: var(--accent-gold); border: 1px solid rgba(255, 193, 7, 0.3);">${gapText}</span>`
                                }
                            </div>
                        </div>

                        <!-- Target vs Swimmer Time Grid -->
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px;">
                            <!-- Target Cut Box -->
                            <div style="background: rgba(255, 193, 7, 0.08); border: 1px solid rgba(255, 193, 7, 0.2); border-radius: 12px; padding: 12px; text-align: center;">
                                <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); display: block; font-weight: 600;">Qualifying Standard</span>
                                <span style="font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; color: var(--accent-gold); display: block; margin-top: 2px;">
                                    ${targetCutFormatted}
                                </span>
                            </div>

                            <!-- Swimmer Best Box -->
                            <div style="background: rgba(0, 240, 255, 0.08); border: 1px solid rgba(0, 240, 255, 0.2); border-radius: 12px; padding: 12px; text-align: center;">
                                <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); display: block; font-weight: 600;">Personal Best (${displayUnit})</span>
                                <span style="font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; color: ${isQualified ? 'var(--accent-green)' : 'var(--accent-cyan)'}; display: block; margin-top: 2px;">
                                    ${unifiedFormatted}
                                </span>
                            </div>
                        </div>

                        <!-- Performance Source Note -->
                        <div style="font-size: 11px; color: var(--text-secondary); margin-bottom: 12px; text-align: center; background: rgba(0,0,0,0.2); padding: 6px; border-radius: 6px;">
                            ${unifiedSourceNote}
                        </div>
                    </div>

                    <!-- Progress Bar -->
                    <div>
                        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 6px;">
                            <span style="color: var(--text-muted); font-weight: 600;">Target Cut Gap</span>
                            <span style="font-family: monospace; font-weight: 700; color: ${isQualified ? 'var(--accent-green)' : 'var(--accent-gold)'};">
                                ${isQualified ? '100% Achieved' : gapText}
                            </span>
                        </div>
                        <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.06); border-radius: 4px; overflow: hidden;">
                            <div style="width: ${progressPercent}%; height: 100%; background: ${isQualified ? 'var(--accent-green)' : 'linear-gradient(90deg, var(--accent-purple), var(--accent-gold))'}; border-radius: 4px; transition: width 0.4s ease;"></div>
                        </div>
                    </div>
                </div>
            `;

            // --- 2. TABLE ROW HTML ---
            tableRowsHtml += `
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.03);">
                    <td style="font-weight: 700; font-family: 'Outfit', sans-serif; color: #fff;">${fullEventTitle}</td>
                    <td style="font-family: monospace; font-size: 15px; font-weight: 800; color: var(--accent-gold); text-align: center;">${targetCutFormatted}</td>
                    <td style="font-family: monospace; font-size: 15px; font-weight: 800; color: ${isQualified ? 'var(--accent-green)' : 'var(--accent-cyan)'}; text-align: center;">${unifiedFormatted}</td>
                    <td style="font-size: 12px; color: var(--text-secondary);">${unifiedSourceNote}</td>
                    <td style="text-align: center;">
                        ${isQualified 
                            ? `<span class="badge badge-aaaa" style="font-size: 10px; color: var(--accent-green);">🏆 Qualified</span>` 
                            : `<span class="badge" style="font-size: 10px; color: var(--accent-gold);">${gapText}</span>`
                        }
                    </td>
                </tr>
            `;
        });

        // Readiness Percentage
        const overallReadiness = Math.round((totalQualified / totalEvents) * 100);

        // Render Summary Header Stats + Grid / Table View
        container.innerHTML = `
            <!-- Top Summary Cards Grid -->
            <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); margin-bottom: 24px;">
                <div class="stat-card" style="padding: 18px;">
                    <div class="stat-icon" style="background: rgba(255, 193, 7, 0.1); color: var(--accent-gold);">
                        <i data-lucide="award"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Events Qualified</span>
                        <span class="stat-value" style="color: var(--accent-gold);">${totalQualified} / ${totalEvents}</span>
                    </div>
                </div>

                <div class="stat-card" style="padding: 18px;">
                    <div class="stat-icon" style="background: rgba(0, 255, 135, 0.1); color: var(--accent-green);">
                        <i data-lucide="check-circle-2"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Meet Readiness</span>
                        <span class="stat-value" style="color: var(--accent-green);">${overallReadiness}%</span>
                    </div>
                </div>

                <div class="stat-card" style="padding: 18px;">
                    <div class="stat-icon" style="background: rgba(0, 240, 255, 0.1); color: var(--accent-cyan);">
                        <i data-lucide="target"></i>
                    </div>
                    <div class="stat-info">
                        <span class="stat-label">Closest Pending Cut</span>
                        <span class="stat-value" style="font-size: 13px; font-weight: 700; color: #fff;">${totalQualified === totalEvents ? 'All Cuts Qualified!' : closestEventName}</span>
                    </div>
                </div>
            </div>

            <!-- Views: Grid Tiles vs Table -->
            ${viewLayout === 'tiles' ? `
                <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
                    ${tilesHtml}
                </div>
            ` : `
                <div class="card" style="padding: 0; overflow: hidden; border-radius: 16px;">
                    <div class="table-container">
                        <table class="custom-table" style="width: 100%; border-collapse: collapse;">
                            <thead>
                                <tr style="background: rgba(255,255,255,0.03); border-bottom: 1px solid var(--glass-border);">
                                    <th style="text-align: left; padding: 14px 16px;">Event Name</th>
                                    <th style="text-align: center; padding: 14px 16px;">Target Cut (${displayUnit})</th>
                                    <th style="text-align: center; padding: 14px 16px;">Swimmer Best</th>
                                    <th style="text-align: left; padding: 14px 16px;">Performance Baseline</th>
                                    <th style="text-align: center; padding: 14px 16px;">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${tableRowsHtml}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}
        `;

        if (window.lucide) lucide.createIcons();

    } catch (err) {
        console.error("Error rendering Holiday Invitational tracker:", err);
        container.innerHTML = `
            <div class="card" style="padding: 30px; text-align: center; color: var(--accent-red);">
                <i data-lucide="alert-triangle" style="width: 48px; height: 48px; margin-bottom: 12px;"></i>
                <h3 style="font-size: 18px; font-weight: 700; color: #fff;">Error Loading Meet Tracker</h3>
                <p style="font-size: 13px; color: var(--text-secondary); margin-top: 6px;">${err.message}</p>
            </div>
        `;
    }
}

/**
 * Binds event listeners for course toggles and view switching
 */
function bindHolidayEvents() {
    const unitSelect = document.getElementById('holiday-unit-select');
    const meetSelect = document.getElementById('holiday-meet-select');
    const btnTiles = document.getElementById('btn-holiday-tiles');
    const btnTable = document.getElementById('btn-holiday-table');

    if (meetSelect) {
        meetSelect.addEventListener('change', (e) => {
            selectedMeet = e.target.value;
            initHolidayInvitationalView();
        });
    }

    if (unitSelect) {
        unitSelect.addEventListener('change', (e) => {
            displayUnit = e.target.value;
            renderHolidayTrackerSheet();
        });
    }

    if (btnTiles) {
        btnTiles.addEventListener('click', () => {
            viewLayout = 'tiles';
            initHolidayInvitationalView();
        });
    }

    if (btnTable) {
        btnTable.addEventListener('click', () => {
            viewLayout = 'table';
            initHolidayInvitationalView();
        });
    }
}
