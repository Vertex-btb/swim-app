/* ==========================================================================
   AeroSwim Season & Course Time Forecasting Module
   Unified Event Tiles Grid with Meters (LCM/SCM) & Yards (SCY) Toggle
   ========================================================================== */

import { getProfile, getTimes, timeStringToSeconds, secondsToTimeString, safeFormatDate } from './storage.js';
import { STANDARDS_DATA, YMCA_STANDARDS_DATA, getAchievedStandard, getBadgeColorClass, getAgeBracketForAge, TIER_ORDER, YMCA_TIER_ORDER } from './standards.js';
import { convertCourseTime } from './conversions.js';

// Module State
let displayUnit = 'SCY'; // 'SCY' (Yards), 'LCM' (Long Course Meters), 'SCM' (Short Course Meters)
let targetSystem = 'YMCA'; // 'YMCA', 'USA', 'both'
let strokeFilter = 'all';
let searchQuery = '';
let viewLayout = 'tiles'; // 'tiles' or 'table'

export async function initForecastView() {
    const container = document.getElementById('main-viewport');
    
    container.innerHTML = `
        <div class="view-content" style="animation: fadeIn var(--transition-normal);">
            <!-- Controls Card -->
            <div class="card" style="padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
                    <div>
                        <h2 style="font-family: 'Outfit', sans-serif; font-size: 22px; font-weight: 800; margin-bottom: 4px; display: flex; align-items: center; gap: 8px;">
                            <i data-lucide="compass" style="color: var(--accent-cyan);"></i>
                            <span>Season Course Forecast & Event Tiles</span>
                        </h2>
                        <p style="color: var(--text-secondary); font-size: 13px;">
                            Predict and forecast Colin's fall times across all swim events. Toggle between <strong>Yards (25yd)</strong> and <strong>Meters (50m)</strong> baselines.
                        </p>
                    </div>

                    <!-- Unit & System Selectors -->
                    <div style="display: flex; gap: 12px; flex-wrap: wrap; align-items: center;">
                        <!-- Display Unit Toggle -->
                        <div class="form-group" style="margin-bottom: 0; min-width: 210px;">
                            <label for="forecast-unit-select" style="font-size: 11px; text-transform: uppercase; color: var(--accent-cyan); font-weight: 700;">Unified Display Unit</label>
                            <select id="forecast-unit-select" style="padding: 10px 14px; border-radius: 12px; background: rgba(0,240,255,0.08); color: #fff; border: 1px solid rgba(0,240,255,0.3); font-family: 'Outfit'; font-weight: 700;">
                                <option value="SCY" ${displayUnit === 'SCY' ? 'selected' : ''}>Yards (SCY - 25yd Pool)</option>
                                <option value="LCM" ${displayUnit === 'LCM' ? 'selected' : ''}>Long Course Meters (LCM - 50m Pool)</option>
                                <option value="SCM" ${displayUnit === 'SCM' ? 'selected' : ''}>Short Course Meters (SCM - 25m Pool)</option>
                            </select>
                        </div>

                        <!-- System Standard Toggle -->
                        <div class="form-group" style="margin-bottom: 0; min-width: 170px;">
                            <label for="forecast-system-select" style="font-size: 11px; text-transform: uppercase; color: var(--text-muted);">Target Standard</label>
                            <select id="forecast-system-select" style="padding: 10px 14px; border-radius: 12px; background: rgba(0,0,0,0.2); color: #fff; border: 1px solid var(--glass-border); font-family: 'Outfit'; font-weight: 600;">
                                <option value="YMCA" ${targetSystem === 'YMCA' ? 'selected' : ''}>NJ YMCA State Cuts</option>
                                <option value="USA" ${targetSystem === 'USA' ? 'selected' : ''}>USA Swimming Cuts</option>
                                <option value="both" ${targetSystem === 'both' ? 'selected' : ''}>Both Systems</option>
                            </select>
                        </div>

                        <!-- View Layout Toggle (Tiles vs Table) -->
                        <div class="form-group" style="margin-bottom: 0;">
                            <label style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block;">View Mode</label>
                            <div style="display: flex; gap: 4px; background: rgba(0,0,0,0.2); padding: 4px; border-radius: 10px; border: 1px solid var(--glass-border);">
                                <button id="btn-layout-tiles" class="btn" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; ${viewLayout === 'tiles' ? 'background: var(--accent-cyan); color: #000; font-weight: 700;' : 'background: transparent; color: #fff;'}">
                                    <i data-lucide="layout-grid" style="width: 14px; height: 14px;"></i> Tiles
                                </button>
                                <button id="btn-layout-table" class="btn" style="padding: 6px 12px; font-size: 12px; border-radius: 6px; ${viewLayout === 'table' ? 'background: var(--accent-cyan); color: #000; font-weight: 700;' : 'background: transparent; color: #fff;'}">
                                    <i data-lucide="table" style="width: 14px; height: 14px;"></i> Table
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Secondary Filters -->
                <div style="display: flex; gap: 16px; margin-top: 16px; flex-wrap: wrap; align-items: center; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px;">
                    <div style="flex: 1; min-width: 220px;">
                        <input type="text" id="forecast-search" placeholder="Search event (e.g. 100 Free, Back)..." value="${searchQuery}" style="padding: 9px 14px; border-radius: 10px; background: rgba(0,0,0,0.2); color: #fff; border: 1px solid var(--glass-border); width: 100%; font-size: 13px;" autocomplete="off" />
                    </div>

                    <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                        <button class="btn ${strokeFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" data-stroke="all" class="forecast-stroke-btn" style="padding: 6px 14px; font-size: 12px;">All Strokes</button>
                        <button class="btn ${strokeFilter === 'free' ? 'btn-primary' : 'btn-secondary'}" data-stroke="free" class="forecast-stroke-btn" style="padding: 6px 14px; font-size: 12px;">Freestyle</button>
                        <button class="btn ${strokeFilter === 'back' ? 'btn-primary' : 'btn-secondary'}" data-stroke="back" class="forecast-stroke-btn" style="padding: 6px 14px; font-size: 12px;">Backstroke</button>
                        <button class="btn ${strokeFilter === 'breast' ? 'btn-primary' : 'btn-secondary'}" data-stroke="breast" class="forecast-stroke-btn" style="padding: 6px 14px; font-size: 12px;">Breaststroke</button>
                        <button class="btn ${strokeFilter === 'fly' ? 'btn-primary' : 'btn-secondary'}" data-stroke="fly" class="forecast-stroke-btn" style="padding: 6px 14px; font-size: 12px;">Butterfly</button>
                        <button class="btn ${strokeFilter === 'IM' ? 'btn-primary' : 'btn-secondary'}" data-stroke="IM" class="forecast-stroke-btn" style="padding: 6px 14px; font-size: 12px;">IM</button>
                    </div>
                </div>
            </div>

            <!-- Master Forecast Content Container -->
            <div id="forecast-sheet-container"></div>
        </div>
    `;

    renderForecastSheet();
    bindForecastEvents();
    lucide.createIcons();
}

/**
 * Builds and renders the Event Tiles Grid or Master Sheet Table
 */
async function renderForecastSheet() {
    const container = document.getElementById('forecast-sheet-container');
    if (!container) return;

    try {
        const profile = getProfile() || {};
        const times = (await getTimes()) || [];
        
        const age = profile.age || 14;
        let gender = profile.gender || 'Boys';
        if (gender.toString().toLowerCase().startsWith('g') || gender.toString().toLowerCase().startsWith('f')) {
            gender = 'Girls';
        } else {
            gender = 'Boys';
        }
        
        const ymcaBracket = getAgeBracketForAge(age, 'YMCA');
        const usaBracket = getAgeBracketForAge(age, 'USA');
        
        const ymcaCuts = (YMCA_STANDARDS_DATA[ymcaBracket] && YMCA_STANDARDS_DATA[ymcaBracket][gender]) 
            ? YMCA_STANDARDS_DATA[ymcaBracket][gender] 
            : ((YMCA_STANDARDS_DATA["13-14"] && YMCA_STANDARDS_DATA["13-14"][gender]) || {});
            
        const usaCuts = (STANDARDS_DATA[usaBracket] && STANDARDS_DATA[usaBracket][gender])
            ? STANDARDS_DATA[usaBracket][gender]
            : ((STANDARDS_DATA["13-14"] && STANDARDS_DATA["13-14"][gender]) || {});

        // Group all logged times by event key
        const eventMap = {};
        times.forEach(t => {
            if (!t || t.isDQ || t.time === 'DQ' || !t.event) return;
            if (!eventMap[t.event]) eventMap[t.event] = [];
            eventMap[t.event].push(t);
        });

        // Combine all unique event keys from standards databases + logged times
        const allEventKeys = Array.from(new Set([
            ...Object.keys(ymcaCuts), 
            ...Object.keys(usaCuts), 
            ...Object.keys(eventMap)
        ]));

        // Filter events by search query & stroke button
        const filteredEvents = allEventKeys.filter(eventKey => {
            if (!eventKey) return false;
            const name = eventKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            const matchesSearch = name.toLowerCase().includes((searchQuery || '').toLowerCase());
            
            let matchesStroke = true;
            if (strokeFilter && strokeFilter !== 'all') {
                const lowerKey = eventKey.toLowerCase();
                const lowerStroke = strokeFilter.toLowerCase();
                matchesStroke = lowerKey.endsWith(`-${lowerStroke}`) || lowerKey.includes(lowerStroke);
            }
            return matchesSearch && matchesStroke;
        });

    // Helper to calculate best swim for an event and course
    const getBestSwim = (evKey, course) => {
        const list = (eventMap[evKey] || []).filter(t => t.course === course);
        if (list.length === 0) return null;
        let best = list[0];
        list.forEach(t => {
            if (timeStringToSeconds(t.time) < timeStringToSeconds(best.time)) best = t;
        });
        return best;
    };

    let totalProjectedCuts = 0;
    let totalEventsCount = filteredEvents.length;

    let tilesHtml = '';
    let masterRowsHtml = '';

    filteredEvents.forEach(evKey => {
        const eventName = evKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const strokeName = evKey.split('-')[1] ? evKey.split('-')[1].toUpperCase() : 'FREE';
        const distName = evKey.split('-')[0];
        const fullEventName = `${distName} ${displayUnit === 'SCY' ? 'Yard' : (displayUnit === 'LCM' ? 'Long Course Meter' : 'Short Course Meter')} ${strokeName === 'IM' ? 'Individual Medley' : (strokeName === 'FREE' ? 'Freestyle' : (strokeName === 'BACK' ? 'Backstroke' : (strokeName === 'BREAST' ? 'Breaststroke' : 'Butterfly')))}`;
        
        const scyBest = getBestSwim(evKey, 'SCY');
        const lcmBest = getBestSwim(evKey, 'LCM');
        const scmBest = getBestSwim(evKey, 'SCM');

        // Determine Unified Master Time in displayUnit
        let unifiedBestSecs = null;
        let unifiedFormatted = '--:--.--';
        let unifiedSourceNote = 'No logged swims';
        let conversionDetailNote = '';

        const candidates = [];

        if (scyBest) {
            const conv = convertCourseTime(scyBest.time, 'SCY', displayUnit, evKey);
            if (conv.seconds) candidates.push({ sec: conv.seconds, formatted: conv.formatted, source: `Spring SCY (${scyBest.time})`, note: conv.note, date: scyBest.date });
        }
        if (lcmBest) {
            const conv = convertCourseTime(lcmBest.time, 'LCM', displayUnit, evKey);
            if (conv.seconds) candidates.push({ sec: conv.seconds, formatted: conv.formatted, source: `Summer LCM (${lcmBest.time})`, note: conv.note, date: lcmBest.date });
        }
        if (scmBest) {
            const conv = convertCourseTime(scmBest.time, 'SCM', displayUnit, evKey);
            if (conv.seconds) candidates.push({ sec: conv.seconds, formatted: conv.formatted, source: `SCM (${scmBest.time})`, note: conv.note, date: scmBest.date });
        }

        if (candidates.length > 0) {
            candidates.sort((a, b) => a.sec - b.sec);
            unifiedBestSecs = candidates[0].sec;
            unifiedFormatted = candidates[0].formatted;
            unifiedSourceNote = `Based on ${candidates[0].source}`;
            conversionDetailNote = candidates[0].note;
        }

        // Convert Target Standards into displayUnit
        const ymcaSCYCuts = ymcaCuts[evKey] || {};
        const usaSCYCuts = usaCuts[evKey] || {};

        let targetYMCACutText = '--';
        let targetUSACutText = '--';
        let ymcaBadge = 'None';
        let usaBadge = 'None';
        let gapInsightText = 'No target cut data';
        let gapPercent = 0;

        if (ymcaSCYCuts.State) {
            const convertedState = convertCourseTime(ymcaSCYCuts.State, 'SCY', displayUnit, evKey);
            targetYMCACutText = convertedState.formatted;
        }

        if (usaSCYCuts.AAAA) {
            const convertedAAAA = convertCourseTime(usaSCYCuts.AAAA, 'SCY', displayUnit, evKey);
            targetUSACutText = convertedAAAA.formatted;
        }

        if (unifiedBestSecs) {
            const ymcaConvertedCuts = {};
            Object.keys(ymcaSCYCuts).forEach(t => {
                const conv = convertCourseTime(ymcaSCYCuts[t], 'SCY', displayUnit, evKey);
                ymcaConvertedCuts[t] = conv.formatted;
            });
            ymcaBadge = getAchievedStandard(unifiedBestSecs, ymcaConvertedCuts, YMCA_TIER_ORDER);

            const usaConvertedCuts = {};
            Object.keys(usaSCYCuts).forEach(t => {
                const conv = convertCourseTime(usaSCYCuts[t], 'SCY', displayUnit, evKey);
                usaConvertedCuts[t] = conv.formatted;
            });
            usaBadge = getAchievedStandard(unifiedBestSecs, usaConvertedCuts, TIER_ORDER);

            if (ymcaBadge === 'State' || usaBadge === 'AAAA') {
                totalProjectedCuts++;
                gapInsightText = '<span style="color: var(--accent-green); font-weight: 700;">🏆 Target Cut Achieved!</span>';
                gapPercent = 100;
            } else if (ymcaSCYCuts.State) {
                const targetSecs = convertCourseTime(ymcaSCYCuts.State, 'SCY', displayUnit, evKey).seconds;
                if (targetSecs && unifiedBestSecs > targetSecs) {
                    const gap = unifiedBestSecs - targetSecs;
                    gapInsightText = `<span style="color: var(--accent-cyan); font-weight: 600;">Need ↓ -${gap.toFixed(2)}s for YMCA State (${targetYMCACutText})</span>`;
                    
                    // Gap progress (0% to 100%)
                    const baselineSecs = targetSecs * 1.25; // 25% slower baseline
                    gapPercent = Math.max(5, Math.min(95, Math.round(((baselineSecs - unifiedBestSecs) / (baselineSecs - targetSecs)) * 100)));
                }
            }
        }

        // --- 1. RENDER EVENT TILE CARD ---
        tilesHtml += `
            <div class="card" style="padding: 20px; border: 1px solid var(--glass-border); border-radius: 16px; background: rgba(255,255,255,0.02); display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; transition: transform var(--transition-fast);">
                <div style="position: absolute; top: 0; left: 0; width: 100%; height: 3px; background: linear-gradient(90deg, var(--accent-cyan), var(--accent-purple));"></div>

                <div>
                    <!-- Tile Header -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px; gap: 8px;">
                        <div>
                            <span style="font-size: 10px; text-transform: uppercase; color: var(--accent-cyan); font-weight: 700; letter-spacing: 0.05em; display: block; margin-bottom: 2px;">
                                ${evKey.toUpperCase()} &bull; ${displayUnit}
                            </span>
                            <h3 style="font-family: 'Outfit', sans-serif; font-size: 17px; font-weight: 800; color: #fff; margin: 0;">
                                ${fullEventName}
                            </h3>
                        </div>
                        <div style="display: flex; flex-direction: column; align-items: flex-end; gap: 4px;">
                            ${ymcaBadge !== 'None' ? `<span class="badge ${getBadgeColorClass(ymcaBadge)}" style="font-size: 10px;">YMCA: ${ymcaBadge}</span>` : ''}
                            ${usaBadge !== 'None' ? `<span class="badge ${getBadgeColorClass(usaBadge)}" style="font-size: 10px;">USA: ${usaBadge}</span>` : ''}
                        </div>
                    </div>

                    <!-- Unified Best Time Banner -->
                    <div style="background: rgba(0, 240, 255, 0.05); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 12px; padding: 12px 16px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: center;">
                        <div>
                            <span style="font-size: 10px; text-transform: uppercase; color: var(--text-muted); display: block;">Forecasted Best (${displayUnit})</span>
                            <span style="font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 800; color: var(--accent-cyan);">${unifiedFormatted}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size: 11px; font-weight: 600; color: #fff; display: block;">${unifiedSourceNote}</span>
                            <span style="font-size: 10px; color: var(--text-secondary);">${conversionDetailNote}</span>
                        </div>
                    </div>

                    <!-- actual performances breakdown -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.04);">
                        <div>
                            <span style="font-size: 10px; uppercase; color: var(--text-muted); display: block;">Spring SCY (25yd)</span>
                            <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: #fff;">${scyBest ? scyBest.time : '--'}</span>
                            <span style="font-size: 10px; color: var(--text-muted); display: block;">${scyBest ? safeFormatDate(scyBest.date) : 'No SCY Logged'}</span>
                        </div>
                        <div>
                            <span style="font-size: 10px; uppercase; color: var(--text-muted); display: block;">Summer LCM (50m)</span>
                            <span style="font-family: monospace; font-size: 13px; font-weight: 700; color: var(--accent-gold);">${lcmBest ? lcmBest.time : '--'}</span>
                            <span style="font-size: 10px; color: var(--text-muted); display: block;">${lcmBest ? safeFormatDate(lcmBest.date) : 'No LCM Logged'}</span>
                        </div>
                    </div>
                </div>

                <!-- Target Cut Progress Bar & Gap -->
                <div style="border-top: 1px solid rgba(255,255,255,0.06); padding-top: 12px; margin-top: 4px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 6px;">
                        <span style="color: var(--text-secondary);">${gapInsightText}</span>
                        <span style="font-family: monospace; font-weight: 700; color: var(--accent-gold);">Cut: ${targetYMCACutText}</span>
                    </div>

                    <div style="width: 100%; height: 6px; background: rgba(255,255,255,0.06); border-radius: 3px; overflow: hidden;">
                        <div style="width: ${gapPercent}%; height: 100%; background: linear-gradient(90deg, var(--accent-purple), var(--accent-cyan)); border-radius: 3px; transition: width 0.4s ease;"></div>
                    </div>
                </div>
            </div>
        `;

        // --- 2. RENDER TABLE ROW (ALTERNATIVE MODE) ---
        masterRowsHtml += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                <td style="font-weight: 700; font-family: 'Outfit'; color: #fff;">${eventName}</td>
                <td style="font-family: monospace; color: var(--accent-cyan);">${scyBest ? scyBest.time : '--'}</td>
                <td style="font-family: monospace; color: var(--accent-gold);">${lcmBest ? lcmBest.time : '--'}</td>
                <td style="font-family: monospace; font-weight: 800; font-size: 15px; color: var(--accent-cyan);">${unifiedFormatted}</td>
                <td style="text-align: center;"><span class="badge ${getBadgeColorClass(ymcaBadge)}" style="font-size: 10px;">${ymcaBadge}</span></td>
                <td style="text-align: center;"><span class="badge ${getBadgeColorClass(usaBadge)}" style="font-size: 10px;">${usaBadge}</span></td>
                <td style="font-size: 12px;">${gapInsightText}</td>
            </tr>
        `;
    });

    const unitLabel = displayUnit === 'SCY' ? 'Yards (25yd SCY)' : (displayUnit === 'LCM' ? 'Meters (50m LCM)' : 'Meters (25m SCM)');

    let viewContentHtml = '';

    if (viewLayout === 'tiles') {
        viewContentHtml = `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px;">
                ${tilesHtml.length > 0 ? tilesHtml : `
                    <div class="card" style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                        <i data-lucide="compass" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                        <p style="font-size: 16px; font-weight: 600;">No Event Tiles Found</p>
                        <p style="font-size: 12px;">Try adjusting your stroke filter or search query.</p>
                    </div>
                `}
            </div>
        `;
    } else {
        viewContentHtml = `
            <div class="card">
                <div class="card-header" style="justify-content: space-between; flex-wrap: wrap;">
                    <h3 class="card-title">
                        <i data-lucide="table" style="color: var(--accent-cyan);"></i>
                        <span>Master Integrated Course Forecast Table</span>
                    </h3>
                    <span class="badge badge-aaaa" style="font-size: 11px;">All Times Converted to ${displayUnit}</span>
                </div>

                <div class="table-container">
                    <table class="custom-table" style="min-width: 900px;">
                        <thead>
                            <tr style="height: 44px; background: rgba(255,255,255,0.01);">
                                <th>Event</th>
                                <th>Spring SCY (Yards)</th>
                                <th>Summer LCM (Meters)</th>
                                <th style="color: var(--accent-cyan);">Unified Best (${displayUnit})</th>
                                <th style="text-align: center;">YMCA Cut</th>
                                <th style="text-align: center;">USA Cut</th>
                                <th>Forecast Gap</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${masterRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    container.innerHTML = `
        <!-- Summary Stats Cards -->
        <div class="stats-grid" style="grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); margin-top: 16px; margin-bottom: 24px;">
            <div class="stat-card" style="padding: 16px;">
                <div class="stat-icon" style="background: rgba(0, 240, 255, 0.1); color: var(--accent-cyan);">
                    <i data-lucide="layout-grid"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Events Forecasted</span>
                    <span class="stat-value">${totalEventsCount} Event Tiles</span>
                </div>
            </div>

            <div class="stat-card" style="padding: 16px;">
                <div class="stat-icon" style="background: rgba(157, 78, 237, 0.1); color: #9d4edd;">
                    <i data-lucide="award"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Target Cuts Qualified</span>
                    <span class="stat-value">${totalProjectedCuts}</span>
                </div>
            </div>

            <div class="stat-card" style="padding: 16px;">
                <div class="stat-icon" style="background: rgba(255, 193, 7, 0.1); color: var(--accent-gold);">
                    <i data-lucide="compass"></i>
                </div>
                <div class="stat-info">
                    <span class="stat-label">Unified Baseline Unit</span>
                    <span class="stat-value" style="font-size: 16px; font-weight: 700; color: var(--accent-cyan);">${unitLabel}</span>
                </div>
            </div>
        </div>

        ${viewContentHtml}
    `;

    lucide.createIcons();
    } catch (err) {
        console.error("Error rendering forecast sheet:", err);
        container.innerHTML = `
            <div class="card" style="padding: 30px; text-align: center; color: var(--accent-red);">
                <i data-lucide="alert-triangle" style="width: 48px; height: 48px; margin-bottom: 12px;"></i>
                <h3 style="font-size: 18px; font-weight: 700; color: #fff;">Error Rendering Season Forecast</h3>
                <p style="font-size: 13px; color: var(--text-secondary); margin-top: 6px;">${err.message || 'An unexpected error occurred while processing swim times.'}</p>
            </div>
        `;
    }
}

/**
 * Binds event listeners for unit toggles, layout switches, filters, and search inputs
 */
function bindForecastEvents() {
    const unitSelect = document.getElementById('forecast-unit-select');
    const systemSelect = document.getElementById('forecast-system-select');
    const searchInput = document.getElementById('forecast-search');
    const btnTiles = document.getElementById('btn-layout-tiles');
    const btnTable = document.getElementById('btn-layout-table');
    
    if (unitSelect) {
        unitSelect.addEventListener('change', (e) => {
            displayUnit = e.target.value;
            renderForecastSheet();
        });
    }

    if (systemSelect) {
        systemSelect.addEventListener('change', (e) => {
            targetSystem = e.target.value;
            renderForecastSheet();
        });
    }

    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value;
            renderForecastSheet();
        });
    }

    if (btnTiles) {
        btnTiles.addEventListener('click', () => {
            viewLayout = 'tiles';
            initForecastView();
        });
    }

    if (btnTable) {
        btnTable.addEventListener('click', () => {
            viewLayout = 'table';
            initForecastView();
        });
    }

    document.querySelectorAll('.forecast-stroke-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            strokeFilter = e.currentTarget.getAttribute('data-stroke');
            initForecastView();
        });
    });
}
