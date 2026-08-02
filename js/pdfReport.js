/* ==========================================================================
   AeroSwim PDF Export Generator Module
   ========================================================================== */

import { getProfile, getTimes, timeStringToSeconds, secondsToTimeString, safeFormatDate } from './storage.js';
import { STANDARDS_DATA, YMCA_STANDARDS_DATA, getAchievedStandard, getBadgeColorClass, getAgeBracketForAge, TIER_ORDER, YMCA_TIER_ORDER } from './standards.js';
import { generateFallSCYPredictions } from './conversions.js';

/**
 * Main function to generate and launch the printable PDF report view
 */
export async function exportAnalyticsPDF() {
    const profile = getProfile();
    const times = await getTimes();
    
    // Determine Swimmer Age & Standards Bracket
    const age = profile.age || 14;
    const gender = profile.gender || "Boys";
    const ymcaBracket = getAgeBracketForAge(age, 'YMCA');
    const usaBracket = getAgeBracketForAge(age, 'USA');
    
    const ymcaCuts = (YMCA_STANDARDS_DATA[ymcaBracket] && YMCA_STANDARDS_DATA[ymcaBracket][gender]) 
        ? YMCA_STANDARDS_DATA[ymcaBracket][gender] 
        : YMCA_STANDARDS_DATA["13-14"]["Boys"];
        
    const usaCuts = (STANDARDS_DATA[usaBracket] && STANDARDS_DATA[usaBracket][gender])
        ? STANDARDS_DATA[usaBracket][gender]
        : STANDARDS_DATA["13-14"]["Boys"];

    // 1. Process PRs and YMCA Cut Insights
    const scyTimes = times.filter(t => t.course === 'SCY');
    
    // Group times by event
    const eventMap = {};
    scyTimes.forEach(t => {
        if (!eventMap[t.event]) eventMap[t.event] = [];
        eventMap[t.event].push(t);
    });

    // Compute YMCA achievements
    const ymcaStats = { State: 0, Silver: 0, Bronze: 0, None: 0 };
    const ymcaTableRows = [];

    // All available SCY events
    const allEvents = Array.from(new Set([...Object.keys(ymcaCuts), ...Object.keys(eventMap)]));
    
    allEvents.forEach(eventKey => {
        const evTimes = (eventMap[eventKey] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
        const validTimes = evTimes.filter(t => !t.isDQ && t.time && t.time !== 'DQ');
        
        let pr = null;
        let prSecs = null;
        let prDate = '--';
        let prLoc = '--';
        
        if (validTimes.length > 0) {
            let fastest = validTimes[0];
            validTimes.forEach(vt => {
                if (timeStringToSeconds(vt.time) < timeStringToSeconds(fastest.time)) {
                    fastest = vt;
                }
            });
            pr = fastest.time;
            prSecs = timeStringToSeconds(pr);
            prDate = safeFormatDate(fastest.date);
            prLoc = fastest.location || '';
        }

        const cuts = ymcaCuts[eventKey] || {};
        const ymcaTier = prSecs ? getAchievedStandard(prSecs, cuts, YMCA_TIER_ORDER) : 'None';
        ymcaStats[ymcaTier] = (ymcaStats[ymcaTier] || 0) + 1;

        const usaEvCuts = usaCuts[eventKey] || {};
        const usaTier = prSecs ? getAchievedStandard(prSecs, usaEvCuts, TIER_ORDER) : 'None';

        // Calculate margin to next YMCA cut
        let ymcaMarginText = 'Achieved Max';
        if (ymcaTier !== 'State') {
            let targetTier = 'Bronze';
            if (ymcaTier === 'Bronze') targetTier = 'Silver';
            if (ymcaTier === 'Silver') targetTier = 'State';
            
            if (cuts[targetTier]) {
                const targetSecs = timeStringToSeconds(cuts[targetTier]);
                if (prSecs) {
                    const diff = prSecs - targetSecs;
                    if (diff > 0) {
                        ymcaMarginText = `Need -${diff.toFixed(2)}s for ${targetTier}`;
                    } else {
                        ymcaMarginText = `Qualified for ${targetTier}!`;
                    }
                } else {
                    ymcaMarginText = `Target Cut: ${cuts[targetTier]}`;
                }
            }
        } else {
            ymcaMarginText = '🏆 State Qualifier';
        }

        const eventName = eventKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        ymcaTableRows.push({
            eventKey,
            eventName,
            pr: pr || '--:--.--',
            prDate,
            prLoc,
            ymcaTier,
            usaTier,
            stateCut: cuts.State || '--',
            silverCut: cuts.Silver || '--',
            bronzeCut: cuts.Bronze || '--',
            ymcaMarginText,
            timesCount: evTimes.length,
            dqCount: evTimes.filter(t => t.isDQ || t.time === 'DQ').length
        });
    });

    // Generate Fall SCY Predictions for Cover Page
    const fallPredictions = generateFallSCYPredictions(times);

    // 2. Stroke Groupings for 2x2 Grid Event Pages
    const strokeCategories = [
        { key: 'free', name: 'Freestyle', order: ['50-free', '100-free', '200-free', '500-free', '1000-free', '1650-free'] },
        { key: 'back', name: 'Backstroke', order: ['50-back', '100-back', '200-back'] },
        { key: 'breast', name: 'Breaststroke', order: ['50-breast', '100-breast', '200-breast'] },
        { key: 'fly', name: 'Butterfly', order: ['50-fly', '100-fly', '200-fly'] },
        { key: 'IM', name: 'Individual Medley', order: ['100-IM', '200-IM', '400-IM'] }
    ];

    // Build SVG sparkline helper
    function generateSVGSparkline(evTimes) {
        if (!evTimes || evTimes.length === 0) {
            return `<div style="height:90px; display:flex; align-items:center; justify-content:center; color:#666; font-size:11px; font-style:italic;">No logged swims yet</div>`;
        }
        
        const width = 290;
        const height = 90;
        const paddingLeft = 48; // Space for Vertical Axis Max/Min labels
        const paddingRight = 15;
        const paddingTop = 14;
        const paddingBottom = 14;
        
        // Sort chronologically
        const sorted = [...evTimes].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        const valid = sorted.filter(t => !t.isDQ && t.time && t.time !== 'DQ');
        if (valid.length === 0) {
            return `<div style="height:90px; display:flex; align-items:center; justify-content:center; color:#ff4d4f; font-size:11px; font-weight:600;">Disqualified Swims Only</div>`;
        }

        const secValues = valid.map(t => timeStringToSeconds(t.time));
        const minSec = Math.min(...secValues);
        const maxSec = Math.max(...secValues);
        const range = (maxSec - minSec) || 1;

        let points = [];
        let dotsSvg = '';

        sorted.forEach((t, idx) => {
            const x = sorted.length === 1 
                ? paddingLeft + (width - paddingLeft - paddingRight) / 2 
                : paddingLeft + (idx / (sorted.length - 1)) * (width - paddingLeft - paddingRight);

            if (t.isDQ || t.time === 'DQ') {
                dotsSvg += `<g transform="translate(${x}, ${height / 2})">
                    <line x1="-5" y1="-5" x2="5" y2="5" stroke="#ff4d4f" stroke-width="2"/>
                    <line x1="5" y1="-5" x2="-5" y2="5" stroke="#ff4d4f" stroke-width="2"/>
                    <title>${t.date}: DQ</title>
                </g>`;
            } else {
                const sec = timeStringToSeconds(t.time);
                // DOWNWARD GRAPH: Slowest/maxSec at TOP (paddingTop), Fastest/minSec at BOTTOM (height - paddingBottom)
                const y = paddingTop + ((maxSec - sec) / range) * (height - paddingTop - paddingBottom);
                points.push(`${x},${y}`);
                
                const isPR = (sec === minSec);
                const circleColor = isPR ? '#00f0ff' : '#52c41a';
                const radius = isPR ? 5 : 3.5;

                dotsSvg += `<circle cx="${x}" cy="${y}" r="${radius}" fill="${circleColor}" stroke="#111" stroke-width="1.5">
                    <title>${t.date}: ${t.time}</title>
                </circle>`;
            }
        });

        let lineSvg = '';
        if (points.length > 1) {
            lineSvg = `<polyline points="${points.join(' ')}" fill="none" stroke="#00f0ff" stroke-width="2" stroke-linejoin="round"/>`;
        }

        const maxTimeStr = secondsToTimeString(maxSec);
        const minTimeStr = secondsToTimeString(minSec);

        return `
            <svg width="100%" height="${height}px" viewBox="0 0 ${width} ${height}" style="background: rgba(0,0,0,0.2); border-radius: 8px; border: 1px solid rgba(255,255,255,0.08);">
                <!-- Y-Axis Vertical Line -->
                <line x1="${paddingLeft - 4}" y1="${paddingTop}" x2="${paddingLeft - 4}" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.15)" stroke-width="1.5"/>
                
                <!-- Y-Axis Max (Top / Slowest Time) Label -->
                <text x="${paddingLeft - 7}" y="${paddingTop + 4}" fill="#aaa" font-size="9px" font-family="monospace" text-anchor="end">
                    ${maxTimeStr}
                </text>
                <!-- Y-Axis Min (Bottom / Fastest Time) Label -->
                <text x="${paddingLeft - 7}" y="${height - paddingBottom + 3}" fill="#00f0ff" font-size="9px" font-family="monospace" text-anchor="end" font-weight="bold">
                    ${minTimeStr}
                </text>

                <!-- Grid Horizontal Lines -->
                <line x1="${paddingLeft}" y1="${paddingTop}" x2="${width - paddingRight}" y2="${paddingTop}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2,2"/>
                <line x1="${paddingLeft}" y1="${height - paddingBottom}" x2="${width - paddingRight}" y2="${height - paddingBottom}" stroke="rgba(255,255,255,0.05)" stroke-dasharray="2,2"/>
                
                ${lineSvg}
                ${dotsSvg}
            </svg>
        `;
    }

    // Build HTML pages for printable view
    let pagesHtml = '';

    // PAGE 1: Cover & YMCA Standards Insight
    pagesHtml += `
        <div class="pdf-page cover-page">
            <div class="header-banner">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <h1 style="font-family:'Outfit',sans-serif; font-size:24px; font-weight:800; color:#fff; margin:0 0 6px 0;">
                            AeroSwim Performance Analytics Report
                        </h1>
                        <p style="color:#00f0ff; font-size:13px; font-weight:600; margin:0;">
                            Swimmer: ${profile.name || 'Colin'} &bull; Age ${age} (${gender}) &bull; ${profile.team || 'NNJ YMCA'}
                        </p>
                    </div>
                    <div style="text-align:right; font-size:11px; color:#888;">
                        <div>Generated: ${new Date().toLocaleDateString()}</div>
                        <div style="color:#00f0ff; font-weight:600;">NJ YMCA & USA Swimming SCY Standards</div>
                    </div>
                </div>
            </div>

            <!-- YMCA Insight Cards -->
            <div style="margin-top:16px;">
                <h2 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:#fff; border-bottom:2px solid #9d4edd; padding-bottom:4px; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                    <span>🏆 NJ YMCA State Championships Standards Insight</span>
                </h2>

                <div style="display:grid; grid-template-columns: repeat(4, 1fr); gap:10px; margin-bottom:14px;">
                    <div class="summary-box" style="border-top:3px solid #ffd700;">
                        <span class="box-label">State Cuts</span>
                        <span class="box-value" style="color:#ffd700;">${ymcaStats.State}</span>
                    </div>
                    <div class="summary-box" style="border-top:3px solid #c0c0c0;">
                        <span class="box-label">Silver Cuts</span>
                        <span class="box-value" style="color:#c0c0c0;">${ymcaStats.Silver}</span>
                    </div>
                    <div class="summary-box" style="border-top:3px solid #cd7f32;">
                        <span class="box-label">Bronze Cuts</span>
                        <span class="box-value" style="color:#cd7f32;">${ymcaStats.Bronze}</span>
                    </div>
                    <div class="summary-box" style="border-top:3px solid #00f0ff;">
                        <span class="box-label">SCY PRs Logged</span>
                        <span class="box-value" style="color:#00f0ff;">${scyTimes.length}</span>
                    </div>
                </div>

                <!-- YMCA Matrix Table -->
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Colin's PR</th>
                            <th style="text-align:center;">YMCA Level</th>
                            <th style="text-align:center;">State Cut</th>
                            <th style="text-align:center;">Silver Cut</th>
                            <th style="text-align:center;">Bronze Cut</th>
                            <th>Target Insight</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${ymcaTableRows.map(r => `
                            <tr>
                                <td style="font-weight:700; color:#fff;">${r.eventName}</td>
                                <td style="font-family:monospace; font-weight:700; color:#00f0ff;">${r.pr}</td>
                                <td style="text-align:center;">
                                    <span class="badge ${getBadgeColorClass(r.ymcaTier)}">${r.ymcaTier}</span>
                                </td>
                                <td style="text-align:center; font-family:monospace; color:#ffd700; font-weight:600;">${r.stateCut}</td>
                                <td style="text-align:center; font-family:monospace; color:#c0c0c0;">${r.silverCut}</td>
                                <td style="text-align:center; font-family:monospace; color:#cd7f32;">${r.bronzeCut}</td>
                                <td style="font-size:11px; color:#aaa;">${r.ymcaMarginText}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>

            <!-- Fall SCY Predictions Section -->
            <div style="margin-top:16px;">
                <h2 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:700; color:#fff; border-bottom:2px solid #00f0ff; padding-bottom:4px; margin-bottom:10px; display:flex; align-items:center; gap:8px;">
                    <span>🗓️ Summer LCM to Fall SCY Time Predictions</span>
                </h2>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Summer LCM PR</th>
                            <th>Spring SCY Baseline</th>
                            <th>Projected Fall SCY</th>
                            <th>Projected Drop Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fallPredictions.map(p => `
                            <tr>
                                <td style="font-weight:700; color:#fff;">${p.eventName}</td>
                                <td style="font-family:monospace; color:#ffd700;">${p.lcmPR}</td>
                                <td style="font-family:monospace; color:#aaa;">${p.scyPR}</td>
                                <td style="font-family:monospace; font-weight:800; color:#00f0ff;">${p.projectedSCYTime}</td>
                                <td style="font-size:11px; font-weight:600; color:${p.deltaFromPreviousSCY > 0 ? '#52c41a' : '#00f0ff'};">${p.statusBadge}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;

    // PAGES 2+: Event Analytics Grids (4 Events per Page grouped by stroke)
    strokeCategories.forEach(stroke => {
        // Collect events matching this stroke
        const strokeEvents = ymcaTableRows.filter(r => {
            if (stroke.key === 'free') return r.eventKey.endsWith('-free');
            if (stroke.key === 'back') return r.eventKey.endsWith('-back');
            if (stroke.key === 'breast') return r.eventKey.endsWith('-breast');
            if (stroke.key === 'fly') return r.eventKey.endsWith('-fly');
            if (stroke.key === 'IM') return r.eventKey.endsWith('-IM');
            return false;
        });

        if (strokeEvents.length === 0) return;

        // Split into chunks of 4 events per page
        for (let i = 0; i < strokeEvents.length; i += 4) {
            const pageEvents = strokeEvents.slice(i, i + 4);
            const pageNum = Math.floor(i / 4) + 1;
            const totalPagesForStroke = Math.ceil(strokeEvents.length / 4);

            let gridCardsHtml = '';

            pageEvents.forEach(ev => {
                const evTimes = (eventMap[ev.eventKey] || []).sort((a, b) => new Date(a.date) - new Date(b.date));
                const validTimes = evTimes.filter(t => !t.isDQ && t.time && t.time !== 'DQ');
                
                // Calculate drop
                let totalDropSecs = 0;
                if (validTimes.length >= 2) {
                    const firstSec = timeStringToSeconds(validTimes[0].time);
                    const lastSec = timeStringToSeconds(validTimes[validTimes.length - 1].time);
                    totalDropSecs = firstSec - lastSec;
                }

                const sparklineSvg = generateSVGSparkline(evTimes);

                gridCardsHtml += `
                    <div class="event-tile">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                            <h3 style="font-family:'Outfit',sans-serif; font-size:16px; font-weight:800; color:#fff; margin:0;">
                                ${ev.eventName}
                            </h3>
                            <div style="display:flex; gap:6px;">
                                <span class="badge ${getBadgeColorClass(ev.ymcaTier)}" style="font-size:10px;">YMCA: ${ev.ymcaTier}</span>
                                <span class="badge ${getBadgeColorClass(ev.usaTier)}" style="font-size:10px;">USA: ${ev.usaTier}</span>
                            </div>
                        </div>

                        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:10px; background:rgba(255,255,255,0.03); padding:8px; border-radius:6px;">
                            <div>
                                <span style="font-size:10px; text-transform:uppercase; color:#888; display:block;">Personal Record</span>
                                <span style="font-family:monospace; font-size:16px; font-weight:800; color:#00f0ff;">${ev.pr}</span>
                                <span style="font-size:10px; color:#aaa; display:block;">${ev.prDate}</span>
                            </div>
                            <div>
                                <span style="font-size:10px; text-transform:uppercase; color:#888; display:block;">Total Swims Logged</span>
                                <span style="font-size:15px; font-weight:700; color:#fff;">${ev.timesCount} Swims</span>
                                ${ev.dqCount > 0 ? `<span style="font-size:10px; color:#ff4d4f; font-weight:600; display:block;">⚠️ ${ev.dqCount} Disqualified (DQ)</span>` : `<span style="font-size:10px; color:#52c41a; font-weight:600; display:block;">✓ 0 DQs</span>`}
                            </div>
                        </div>

                        <div style="margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;">
                            <span style="font-size:11px; font-weight:600; color:#ccc;">Time Progression & Trend</span>
                            ${totalDropSecs !== 0 ? `
                                <span style="font-size:11px; font-weight:700; color:${totalDropSecs > 0 ? '#52c41a' : '#ff4d4f'};">
                                    ${totalDropSecs > 0 ? '↓ -' + totalDropSecs.toFixed(2) + 's Drop' : '↑ +' + Math.abs(totalDropSecs).toFixed(2) + 's'}
                                </span>
                            ` : ''}
                        </div>

                        ${sparklineSvg}
                    </div>
                `;
            });

            // Fill remaining spots if < 4 events
            while (pageEvents.length < 4) {
                gridCardsHtml += `<div class="event-tile empty-tile" style="visibility:hidden;"></div>`;
                pageEvents.push(null);
            }

            pagesHtml += `
                <div class="pdf-page stroke-page">
                    <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:2px solid #00f0ff; padding-bottom:8px; margin-bottom:16px;">
                        <h2 style="font-family:'Outfit',sans-serif; font-size:20px; font-weight:800; color:#fff; margin:0; display:flex; align-items:center; gap:8px;">
                            <span>🏊 ${stroke.name} Event Analytics</span>
                            ${totalPagesForStroke > 1 ? `<span style="font-size:12px; color:#888; font-weight:400;">(Page ${pageNum} of ${totalPagesForStroke})</span>` : ''}
                        </h2>
                        <span style="font-size:11px; color:#888;">${profile.name || 'Colin'} &bull; ${profile.team || 'NNJ YMCA'}</span>
                    </div>

                    <!-- 2x2 Grid Layout -->
                    <div class="grid-2x2">
                        ${gridCardsHtml}
                    </div>
                </div>
            `;
        }
    });

    // 3. Render Printable Modal View
    let printContainer = document.getElementById('pdf-report-container');
    if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'pdf-report-container';
        document.body.appendChild(printContainer);
    }

    printContainer.innerHTML = `
        <style>
            #pdf-report-container {
                position: fixed;
                top: 0;
                left: 0;
                width: 100vw;
                height: 100vh;
                background: rgba(10, 15, 30, 0.95);
                backdrop-filter: blur(12px);
                z-index: 99999;
                overflow-y: auto;
                padding: 20px;
                box-sizing: border-box;
                font-family: 'Inter', sans-serif;
            }

            .pdf-toolbar {
                position: sticky;
                top: 0;
                z-index: 100000;
                background: #121927;
                border: 1px solid var(--glass-border, #2a364f);
                padding: 12px 24px;
                border-radius: 14px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 24px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
            }

            .pdf-page {
                width: 8.5in;
                min-height: 11in;
                margin: 0 auto 30px auto;
                background: #141c2e;
                border: 1px solid rgba(255, 255, 255, 0.1);
                border-radius: 12px;
                padding: 0.5in;
                box-sizing: border-box;
                box-shadow: 0 12px 40px rgba(0,0,0,0.6);
                page-break-after: always;
                break-after: page;
            }

            .header-banner {
                background: linear-gradient(135deg, rgba(0,240,255,0.1), rgba(157,78,237,0.15));
                border: 1px solid rgba(0,240,255,0.2);
                border-radius: 12px;
                padding: 18px 24px;
            }

            .summary-box {
                background: rgba(255,255,255,0.03);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 10px;
                padding: 14px;
                text-align: center;
            }
            .box-label { font-size: 11px; text-transform: uppercase; color: #888; display: block; margin-bottom: 4px; }
            .box-value { font-family: 'Outfit', sans-serif; font-size: 24px; font-weight: 800; }

            .report-table {
                width: 100%;
                border-collapse: separate;
                border-spacing: 0 4px;
                margin-top: 10px;
                font-size: 12px;
            }
            .report-table th {
                text-align: left;
                padding: 8px 10px;
                color: #888;
                font-size: 11px;
                text-transform: uppercase;
                border-bottom: 1px solid rgba(255,255,255,0.1);
            }
            .report-table td {
                padding: 8px 10px;
                background: rgba(255,255,255,0.02);
            }

            .grid-2x2 {
                display: grid;
                grid-template-columns: 1fr 1fr;
                grid-template-rows: 1fr 1fr;
                gap: 16px;
                height: calc(10in - 60px);
            }

            .event-tile {
                background: rgba(255,255,255,0.02);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 12px;
                padding: 14px;
                display: flex;
                flex-direction: column;
                justify-content: space-between;
            }

            /* PRINT SPECIFIC STYLES FOR HIGH RESOLUTION PDF */
            @media print {
                body * {
                    visibility: hidden;
                }
                #pdf-report-container, #pdf-report-container * {
                    visibility: visible;
                }
                #pdf-report-container {
                    position: absolute;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: auto;
                    background: #0d1322 !important;
                    padding: 0 !important;
                    overflow: visible !important;
                    -webkit-print-color-adjust: exact !important;
                    print-color-adjust: exact !important;
                }
                .pdf-toolbar {
                    display: none !important;
                }
                .pdf-page {
                    width: 100% !important;
                    min-height: 10in !important;
                    margin: 0 !important;
                    border: none !important;
                    box-shadow: none !important;
                    page-break-after: always !important;
                    break-after: page !important;
                    background: #0d1322 !important;
                }
            }
        </style>

        <div class="pdf-toolbar">
            <div style="display:flex; align-items:center; gap:12px;">
                <i data-lucide="file-text" style="color:#00f0ff; width:24px; height:24px;"></i>
                <div>
                    <strong style="color:#fff; font-size:16px; font-family:'Outfit';">Swimmer PDF Analytics Report Preview</strong>
                    <span style="font-size:12px; color:#aaa; display:block;">Cover Page with YMCA Standards + 4 Events Per Page (2x2 Stroke Grids)</span>
                </div>
            </div>
            <div style="display:flex; gap:12px;">
                <button id="btn-trigger-print" style="padding:10px 20px; border-radius:10px; background:#00f0ff; color:#000; font-family:'Outfit'; font-weight:800; border:none; cursor:pointer; display:flex; align-items:center; gap:8px;">
                    <i data-lucide="printer" style="width:16px; height:16px;"></i>
                    Print / Save to PDF
                </button>
                <button id="btn-close-pdf" style="padding:10px 16px; border-radius:10px; background:rgba(255,255,255,0.1); color:#fff; font-family:'Outfit'; font-weight:600; border:1px solid rgba(255,255,255,0.15); cursor:pointer;">
                    Close
                </button>
            </div>
        </div>

        <div class="pdf-document">
            ${pagesHtml}
        </div>
    `;

    lucide.createIcons();

    document.getElementById('btn-trigger-print').addEventListener('click', () => {
        window.print();
    });

    document.getElementById('btn-close-pdf').addEventListener('click', () => {
        printContainer.remove();
    });
}
