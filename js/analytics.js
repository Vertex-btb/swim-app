/* ==========================================================================
   AeroSwim Performance Analytics & Progress Charts
   ========================================================================== */

import { getProfile, getTimes, timeStringToSeconds, secondsToTimeString, safeFormatDate } from './storage.js';
import { STANDARDS_DATA, getAchievedStandard, TIER_ORDER, YMCA_STANDARDS_DATA, YMCA_TIER_ORDER } from './standards.js';
import { exportAnalyticsPDF } from './pdfReport.js';
import { convertCourseTime, generateFallSCYPredictions } from './conversions.js';

// --- HTML Template for Analytics View ---

const ANALYTICS_VIEW_HTML = `
<!-- Selector Panel -->
<div class="card">
    <div class="card-header" style="justify-content: space-between; flex-wrap: wrap; gap: 12px;">
        <h2 class="card-title">
            <i data-lucide="trending-up"></i>
            <span>Performance Progress Analytics</span>
        </h2>
        <button class="btn btn-secondary" id="analytics-export-pdf-btn" style="padding: 8px 16px; background: rgba(157, 78, 237, 0.15); color: #9d4edd; border: 1px solid rgba(157, 78, 237, 0.3); font-weight: 700; border-radius: 10px; display: inline-flex; align-items: center; gap: 8px; cursor: pointer;">
            <i data-lucide="file-text"></i>
            <span>Export PDF Report</span>
        </button>
    </div>
    
    <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-bottom: 8px;">
        <!-- Analysis Mode selector -->
        <div class="form-group" style="margin-bottom: 0; min-width: 180px;">
            <label for="chart-mode-select">Analysis Mode</label>
            <select id="chart-mode-select">
                <option value="single" selected>Single Event</option>
                <option value="overlay">Overlay Stroke Category</option>
            </select>
        </div>

        <!-- Event selector (Single Event Mode) -->
        <div class="form-group" id="group-event-select" style="margin-bottom: 0; min-width: 200px;">
            <label for="chart-event-select">Select Event</label>
            <select id="chart-event-select">
                <optgroup label="Freestyle">
                    <option value="50-free">50 Free</option>
                    <option value="100-free">100 Free</option>
                    <option value="200-free">200 Free</option>
                    <option value="500-free">500 Free</option>
                    <option value="1000-free">1000 Free</option>
                    <option value="1650-free">1650 Free</option>
                </optgroup>
                <optgroup label="Backstroke">
                    <option value="50-back">50 Back</option>
                    <option value="100-back" selected>100 Back</option>
                    <option value="200-back">200 Back</option>
                </optgroup>
                <optgroup label="Breaststroke">
                    <option value="50-breast">50 Breast</option>
                    <option value="100-breast">100 Breast</option>
                    <option value="200-breast">200 Breast</option>
                </optgroup>
                <optgroup label="Butterfly">
                    <option value="50-fly">50 Fly</option>
                    <option value="100-fly">100 Fly</option>
                    <option value="200-fly">200 Fly</option>
                </optgroup>
                <optgroup label="Individual Medley">
                    <option value="100-IM">100 IM</option>
                    <option value="200-IM">200 IM</option>
                    <option value="400-IM">400 IM</option>
                </optgroup>
            </select>
        </div>
        
        <!-- Target Standard selector (Single Event Mode) -->
        <div class="form-group" id="group-standard-select" style="margin-bottom: 0; min-width: 165px;">
            <label for="chart-standard-select">Target Standard</label>
            <select id="chart-standard-select">
                <option value="USA" selected>USA Swimming</option>
                <option value="YMCA">YMCA State</option>
                <option value="both">Both Standards</option>
            </select>
        </div>

        <!-- Stroke selector (Overlay Mode) -->
        <div class="form-group" id="group-stroke-select" style="margin-bottom: 0; min-width: 200px; display: none;">
            <label for="chart-stroke-select">Select Stroke Category</label>
            <select id="chart-stroke-select">
                <option value="free">Freestyle</option>
                <option value="back" selected>Backstroke</option>
                <option value="breast">Breaststroke</option>
                <option value="fly">Butterfly</option>
                <option value="IM">Individual Medley</option>
            </select>
        </div>
        
        <!-- Course selector -->
        <div class="form-group" style="margin-bottom: 0; min-width: 150px;">
            <label for="chart-course-select">Course Pool Size</label>
            <select id="chart-course-select">
                <option value="SCY" selected>Short Course Yards (SCY)</option>
                <option value="LCM">Long Course Meters (LCM)</option>
                <option value="SCM">Short Course Meters (SCM)</option>
            </select>
        </div>
    </div>
</div>

<!-- Chart & Insights Area -->
<div style="display: grid; grid-template-columns: 3fr 1.2fr; gap: 32px; margin-top: 8px;" id="analytics-grid">
    <!-- Chart Card -->
    <div class="card">
        <div class="chart-container" style="position: relative; height: 440px; width: 100%;">
            <canvas id="analytics-progress-chart"></canvas>
            <div id="no-chart-data-msg" style="display: none; position: absolute; top:50%; left:50%; transform: translate(-50%, -50%); text-align: center; color: var(--text-muted); width: 80%;">
                <i data-lucide="line-chart" style="width: 48px; height: 48px; margin-bottom: 12px; opacity: 0.5;"></i>
                <p style="font-weight: 500;">Insufficient Data to Graph Progress</p>
                <p style="font-size: 12px; margin-top: 4px;" id="no-data-subtext">Log at least 2 swim times for the selected Event and Course to view progress trends.</p>
            </div>
        </div>
    </div>

    <!-- Insights Card -->
    <div class="card" id="analytics-insights-card">
        <!-- Replaced dynamically by JS based on mode -->
    </div>
</div>

<!-- Course Time Converter & Fall SCY Time Predictor -->
<div id="course-converter-section" style="margin-top: 32px;"></div>

<!-- DQ & Technical Analysis Card -->
<div id="dq-analysis-section" style="margin-top: 32px;"></div>
`;

let progressChart = null;

// Palette for overlaid lines
const LINE_COLORS = [
    '#00f0ff', // Neon Cyan
    '#9d4edd', // Neon Purple
    '#00fa9a', // Neon Mint / Spring Green
    '#ffc107', // Gold / Amber
    '#ff4d6d', // Neon Pink / Coral
    '#3a86c8'  // Soft Blue
];

// Helper to convert SCY standards to SCM/LCM for comparisons
function getConvertedCuts(scyCuts, course) {
    if (course === 'SCY') return scyCuts;
    
    let multiplier = 1.0;
    if (course === 'SCM') multiplier = 1.1189;
    if (course === 'LCM') multiplier = 1.1591;
    
    const converted = {};
    for (const key in scyCuts) {
        const scySecs = timeStringToSeconds(scyCuts[key]);
        const convSecs = scySecs * multiplier;
        converted[key] = secondsToTimeString(convSecs);
    }
    return converted;
}

/**
 * Draws the progression line chart using Chart.js APIs
 */
async function drawProgressChart() {
    const modeVal = document.getElementById('chart-mode-select').value;
    const courseVal = document.getElementById('chart-course-select').value;
    const canvas = document.getElementById('analytics-progress-chart');
    const msgDiv = document.getElementById('no-chart-data-msg');
    const subtextP = document.getElementById('no-data-subtext');
    const insightsCard = document.getElementById('analytics-insights-card');
    
    if (!canvas) return;
    
    if (progressChart) {
        progressChart.destroy();
        progressChart = null;
    }
    
    const times = await getTimes();
    
    if (modeVal === 'single') {
        // --- SINGLE EVENT MODE ---
        const eventVal = document.getElementById('chart-event-select').value;
        const standardVal = document.getElementById('chart-standard-select').value;
        const chartData = times
            .filter(t => t.event === eventVal && t.course === courseVal && t.time.trim().toUpperCase() !== 'DQ')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        insightsCard.innerHTML = `
            <div class="card-header">
                <h3 class="card-title" style="font-size: 16px;">
                    <i data-lucide="lightbulb" style="color: var(--accent-gold);"></i>
                    <span>Progress Insights</span>
                </h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 14px; font-size: 13px;">
                <div>
                    <span style="color: var(--text-secondary); display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Personal Record (PR)</span>
                    <span id="insight-pb" style="font-family: 'Outfit', sans-serif; font-size: 20px; font-weight: 800; color: var(--accent-cyan);">--:--.--</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary); display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Baseline (First Swim)</span>
                    <span id="insight-baseline" style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 600;">--:--.--</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary); display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Lifetime Improvement</span>
                    <span id="insight-dropped" style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700; color: var(--accent-green);">--</span>
                </div>
                <div>
                    <span style="color: var(--text-secondary); display: block; font-size: 10px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Current Pace (Last 12 Mo)</span>
                    <span id="insight-pace" style="font-family: 'Outfit', sans-serif; font-size: 14px; font-weight: 700;">--</span>
                </div>
                <div id="insight-projection-container" style="display: none; padding: 10px; background: rgba(255,255,255,0.02); border-left: 3px solid var(--accent-cyan); border-radius: 4px; margin-top: 4px;">
                    <!-- Appended dynamically -->
                </div>
            </div>
        `;
        lucide.createIcons({ scope: insightsCard });

        const pbSpan = document.getElementById('insight-pb');
        const baselineSpan = document.getElementById('insight-baseline');
        const droppedSpan = document.getElementById('insight-dropped');
        const paceSpan = document.getElementById('insight-pace');
        const projContainer = document.getElementById('insight-projection-container');

        if (chartData.length < 2) {
            canvas.style.display = 'none';
            msgDiv.style.display = 'block';
            subtextP.innerText = "Log at least 2 swim times for the selected Event and Course to view progress trends.";
            
            pbSpan.innerText = chartData.length === 1 ? chartData[0].time : "--:--.--";
            baselineSpan.innerText = chartData.length === 1 ? chartData[0].time : "--:--.--";
            droppedSpan.innerText = "No history";
            droppedSpan.style.color = "var(--text-muted)";
            paceSpan.innerText = "Need more records";
            return;
        }

        canvas.style.display = 'block';
        msgDiv.style.display = 'none';

        const labels = chartData.map(t => safeFormatDate(t.date, { month: 'short', year: '2-digit' }));
        const dataPoints = chartData.map(t => timeStringToSeconds(t.time));

        const rawSeconds = dataPoints;
        const baselineSecs = rawSeconds[0];
        const pbSecs = Math.min(...rawSeconds);
        const pbIndex = rawSeconds.indexOf(pbSecs);
        const pbEntry = chartData[pbIndex];

        const totalImprovement = baselineSecs - pbSecs;
        
        // Calculate Pace (Drops per month over the last 12 months)
        const now = new Date();
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        
        const recentSwims = chartData.filter(t => new Date(t.date) >= oneYearAgo);
        let dropPerMonth = 0;
        
        if (recentSwims.length >= 2) {
            const firstDate = new Date(recentSwims[0].date);
            const lastDate = new Date(recentSwims[recentSwims.length - 1].date);
            const monthsDiff = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 30.44);
            
            if (monthsDiff > 0.05) {
                const firstTime = timeStringToSeconds(recentSwims[0].time);
                const lastTime = timeStringToSeconds(recentSwims[recentSwims.length - 1].time);
                dropPerMonth = (firstTime - lastTime) / monthsDiff; // positive means dropping time
            }
        }

        pbSpan.innerText = pbEntry.time;
        baselineSpan.innerText = chartData[0].time;
        
        if (totalImprovement > 0) {
            droppedSpan.innerText = `↓ ${totalImprovement.toFixed(2)}s dropped`;
            droppedSpan.style.color = "var(--accent-green)";
        } else if (totalImprovement < 0) {
            droppedSpan.innerText = `↑ +${Math.abs(totalImprovement).toFixed(2)}s change`;
            droppedSpan.style.color = "var(--accent-red)";
        } else {
            droppedSpan.innerText = "0.00s difference";
            droppedSpan.style.color = "var(--text-muted)";
        }

        if (dropPerMonth > 0) {
            paceSpan.innerText = `↓ ${dropPerMonth.toFixed(2)}s / month`;
            paceSpan.style.color = "var(--accent-cyan)";
        } else {
            paceSpan.innerText = dropPerMonth < 0 ? `↑ +${Math.abs(dropPerMonth).toFixed(2)}s / mo` : "Insufficient data";
            paceSpan.style.color = dropPerMonth < 0 ? "var(--accent-red)" : "var(--text-muted)";
        }

        // --- Standard Calculations ---
        const profile = getProfile();
        let ageBracket = "13-14";
        if (profile.age <= 12) ageBracket = "11-12";
        const gender = profile.gender || "Boys";

        let usaNextCutVal = null, usaNextCutSecs = null, usaNextCutTier = null;
        let ymcaNextCutVal = null, ymcaNextCutSecs = null, ymcaNextCutTier = null;

        // USA Next Cut Target
        if (STANDARDS_DATA[ageBracket] && STANDARDS_DATA[ageBracket][gender]) {
            const scyCuts = STANDARDS_DATA[ageBracket][gender][eventVal];
            if (scyCuts) {
                const cuts = getConvertedCuts(scyCuts, courseVal);
                const currentLevel = getAchievedStandard(pbSecs, cuts, TIER_ORDER);
                const currentIdx = TIER_ORDER.indexOf(currentLevel);
                if (currentIdx !== 0) {
                    usaNextCutTier = currentLevel === "None" ? "B" : TIER_ORDER[currentIdx - 1];
                    usaNextCutVal = cuts[usaNextCutTier];
                    usaNextCutSecs = timeStringToSeconds(usaNextCutVal);
                }
            }
        }

        // YMCA Next Cut Target
        if (YMCA_STANDARDS_DATA[ageBracket] && YMCA_STANDARDS_DATA[ageBracket][gender]) {
            const scyCuts = YMCA_STANDARDS_DATA[ageBracket][gender][eventVal];
            if (scyCuts) {
                const cuts = getConvertedCuts(scyCuts, courseVal);
                const currentLevel = getAchievedStandard(pbSecs, cuts, YMCA_TIER_ORDER);
                const currentIdx = YMCA_TIER_ORDER.indexOf(currentLevel);
                if (currentIdx !== 0) {
                    ymcaNextCutTier = currentLevel === "None" ? "Bronze" : YMCA_TIER_ORDER[currentIdx - 1];
                    ymcaNextCutVal = cuts[ymcaNextCutTier];
                    ymcaNextCutSecs = timeStringToSeconds(ymcaNextCutVal);
                }
            }
        }

        // Generate text projections
        let projectionHtml = "";
        let projectedDate = null;
        let furthestTargetSecs = null;
        const targetDatesList = [];

        const generateText = (tier, val, secs, label) => {
            const secsNeeded = pbSecs - secs;
            if (secsNeeded > 0 && dropPerMonth > 0) {
                const monthsNeeded = secsNeeded / dropPerMonth;
                const daysNeeded = monthsNeeded * 30.44;
                const lastSwim = chartData[chartData.length - 1];
                const targetDate = new Date(lastSwim.date);
                targetDate.setDate(targetDate.getDate() + daysNeeded);

                targetDatesList.push({ date: targetDate, secs: secs, tier: tier, val: val, label: label });
                
                return `
                    <div style="margin-bottom: 12px;">
                        <span style="font-size: 9px; text-transform: uppercase; color: var(--text-muted); display: block; letter-spacing: 0.05em;">${label} Target</span>
                        <span style="font-size: 12px; color: #fff; font-weight: 500;">
                            Projected to hit <b style="color:var(--accent-cyan);">${tier} (${val})</b> by <b style="color:#fff;">${safeFormatDate(targetDate, {month: 'short', year: 'numeric'})}</b>.
                        </span>
                    </div>
                `;
            } else if (secsNeeded <= 0) {
                return `
                    <div style="margin-bottom: 12px; color: var(--accent-green); font-weight: 600; font-size: 12px;">
                        🏆 Achieved ${label} ${tier} Cut (${val})!
                    </div>
                `;
            }
            return "";
        };

        if (standardVal === 'USA' || standardVal === 'both') {
            if (usaNextCutTier) {
                projectionHtml += generateText(usaNextCutTier, usaNextCutVal, usaNextCutSecs, "USA Swimming");
            } else {
                projectionHtml += `<div style="margin-bottom: 12px; color: var(--accent-green); font-size: 12px; font-weight: 600;">🏆 Max USA Cut (AAAA) achieved!</div>`;
            }
        }
        if (standardVal === 'YMCA' || standardVal === 'both') {
            if (ymcaNextCutTier) {
                projectionHtml += generateText(ymcaNextCutTier, ymcaNextCutVal, ymcaNextCutSecs, "YMCA State");
            } else {
                projectionHtml += `<div style="margin-bottom: 12px; color: var(--accent-green); font-size: 12px; font-weight: 600;">🏆 Max YMCA Cut (State) achieved!</div>`;
            }
        }

        if (projectionHtml) {
            projContainer.style.display = 'block';
            projContainer.innerHTML = projectionHtml;
        } else {
            projContainer.style.display = 'none';
        }

        const ctx = canvas.getContext('2d');
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, 'rgba(0, 240, 255, 0.25)');
        gradient.addColorStop(1, 'rgba(0, 240, 255, 0.0)');

        let datasets = [{
            label: 'Race Performance Time',
            data: dataPoints,
            borderColor: '#00f0ff',
            borderWidth: 3,
            backgroundColor: gradient,
            fill: true,
            tension: 0.25,
            pointBackgroundColor: dataPoints.map((val, idx) => idx === pbIndex ? '#ffc107' : '#8a2be2'),
            pointBorderColor: dataPoints.map((val, idx) => idx === pbIndex ? '#ffc107' : '#00f0ff'),
            pointRadius: dataPoints.map((val, idx) => idx === pbIndex ? 7 : 5),
            pointHoverRadius: 9,
            shadowBlur: 10,
            shadowColor: 'rgba(0, 240, 255, 0.5)',
            spanGaps: true
        }];

        // Plot Projected Trendline and Goal Target lines
        if (targetDatesList.length > 0) {
            // Sort to find the furthest target date to extend the X-axis
            targetDatesList.sort((a, b) => b.date - a.date);
            const furthestTarget = targetDatesList[0];
            projectedDate = furthestTarget.date;
            furthestTargetSecs = furthestTarget.secs;

            // Push projected date on X-axis labels
            labels.push(safeFormatDate(projectedDate, { month: 'short', year: '2-digit' }));
            dataPoints.push(null);

            // Construct trajectory line from current PR to target
            const trendData = new Array(labels.length).fill(null);
            trendData[pbIndex] = pbSecs;
            trendData[labels.length - 1] = furthestTargetSecs;

            datasets.push({
                label: 'Projected Trajectory',
                data: trendData,
                borderColor: 'rgba(0, 240, 255, 0.65)',
                borderWidth: 2,
                borderDash: [5, 5],
                fill: false,
                tension: 0,
                spanGaps: true,
                pointRadius: 0,
                pointHoverRadius: 0
            });
        }

        // Draw horizontal cuts
        if (standardVal === 'USA' || standardVal === 'both') {
            if (usaNextCutSecs) {
                const cutLineData = new Array(labels.length).fill(usaNextCutSecs);
                datasets.push({
                    label: `USA ${usaNextCutTier} Cut (${usaNextCutVal})`,
                    data: cutLineData,
                    borderColor: 'rgba(0, 240, 255, 0.25)',
                    borderWidth: 1.5,
                    borderDash: [2, 4],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                });
            }
        }
        if (standardVal === 'YMCA' || standardVal === 'both') {
            if (ymcaNextCutSecs) {
                const cutLineData = new Array(labels.length).fill(ymcaNextCutSecs);
                datasets.push({
                    label: `YMCA ${ymcaNextCutTier} Cut (${ymcaNextCutVal})`,
                    data: cutLineData,
                    borderColor: 'rgba(157, 78, 221, 0.55)', // purple/silver
                    borderWidth: 1.5,
                    borderDash: [2, 4],
                    fill: false,
                    pointRadius: 0,
                    pointHoverRadius: 0
                });
            }
        }

        progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { 
                        display: true,
                        position: 'top',
                        labels: { color: '#9ca3af', font: { family: 'Outfit', size: 11 }, boxWidth: 12 }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(11, 15, 25, 0.9)',
                        titleColor: '#00f0ff',
                        bodyColor: '#f3f4f6',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${secondsToTimeString(context.raw)}`;
                            },
                            afterLabel: function(context) {
                                if (context.datasetIndex === 0 && chartData[context.dataIndex]) {
                                    return `Meet: ${chartData[context.dataIndex].location}`;
                                }
                                return '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#9ca3af', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 11 },
                            callback: function(value) {
                                return secondsToTimeString(value);
                            }
                        }
                    }
                }
            }
        });
        
    } else {
        // --- OVERLAY STROKE CATEGORY MODE ---
        const strokeVal = document.getElementById('chart-stroke-select').value;
        
        const strokeGroups = {
            free: ['50-free', '100-free', '200-free', '500-free', '1000-free', '1650-free'],
            back: ['50-back', '100-back', '200-back'],
            breast: ['50-breast', '100-breast', '200-breast'],
            fly: ['50-fly', '100-fly', '200-fly'],
            IM: ['100-IM', '200-IM', '400-IM']
        };
        
        const eventsToCompare = strokeGroups[strokeVal] || [];
        const filteredTimes = times.filter(t => eventsToCompare.includes(t.event) && t.course === courseVal && t.time.trim().toUpperCase() !== 'DQ');
        
        if (filteredTimes.length === 0) {
            canvas.style.display = 'none';
            msgDiv.style.display = 'block';
            subtextP.innerText = "No swim times logged in this entire Stroke Category to display.";
            
            insightsCard.innerHTML = `
                <div class="card-header">
                    <h3 class="card-title" style="font-size: 16px;">
                        <i data-lucide="award" style="color: var(--accent-cyan);"></i>
                        <span>Stroke Category PRs</span>
                    </h3>
                </div>
                <p style="color: var(--text-muted); font-size: 12px; padding: 12px;">No logged times found in this category.</p>
            `;
            lucide.createIcons({ scope: insightsCard });
            return;
        }

        canvas.style.display = 'block';
        msgDiv.style.display = 'none';

        const uniqueDates = [...new Set(filteredTimes.map(t => t.date))].sort((a, b) => new Date(a) - new Date(b));
        const labels = uniqueDates.map(d => safeFormatDate(d, { month: 'short', year: '2-digit' }));

        const datasets = [];
        let colorIdx = 0;
        const prList = [];

        eventsToCompare.forEach(eventCode => {
            const eventTimes = filteredTimes.filter(t => t.event === eventCode);
            if (eventTimes.length === 0) return;

            let fastest = eventTimes[0];
            eventTimes.forEach(t => {
                if (timeStringToSeconds(t.time) < timeStringToSeconds(fastest.time)) {
                    fastest = t;
                }
            });
            
            const eventLabel = eventCode.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
            prList.push({ name: eventLabel, pr: fastest.time, color: LINE_COLORS[colorIdx % LINE_COLORS.length] });

            const alignedData = uniqueDates.map(d => {
                const match = eventTimes.find(t => t.date === d);
                return match ? timeStringToSeconds(match.time) : null;
            });

            datasets.push({
                label: eventLabel,
                data: alignedData,
                borderColor: LINE_COLORS[colorIdx % LINE_COLORS.length],
                backgroundColor: 'transparent',
                borderWidth: 3,
                tension: 0.2,
                spanGaps: true,
                pointRadius: 4,
                pointHoverRadius: 7,
                pointBackgroundColor: LINE_COLORS[colorIdx % LINE_COLORS.length]
            });

            colorIdx++;
        });

        let insightsHtml = `
            <div class="card-header">
                <h3 class="card-title" style="font-size: 16px;">
                    <i data-lucide="award" style="color: var(--accent-cyan);"></i>
                    <span>Category Personal Records</span>
                </h3>
            </div>
            <div style="display: flex; flex-direction: column; gap: 16px; font-size: 13px;">
        `;
        prList.forEach(item => {
            insightsHtml += `
                <div>
                    <span style="color: var(--text-secondary); display: block; font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">
                        ${item.name} PR
                    </span>
                    <span style="font-family: 'Outfit', sans-serif; font-size: 18px; font-weight: 700; color: ${item.color};">
                        ${item.pr}
                    </span>
                </div>
            `;
        });
        insightsHtml += `</div>`;
        insightsCard.innerHTML = insightsHtml;
        lucide.createIcons({ scope: insightsCard });

        const ctx = canvas.getContext('2d');
        progressChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            color: '#9ca3af',
                            font: { family: 'Outfit', size: 11 },
                            boxWidth: 12,
                            padding: 12
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(11, 15, 25, 0.95)',
                        titleColor: '#00f0ff',
                        bodyColor: '#f3f4f6',
                        borderColor: 'rgba(255, 255, 255, 0.08)',
                        borderWidth: 1,
                        padding: 12,
                        callbacks: {
                            label: function(context) {
                                return `${context.dataset.label}: ${secondsToTimeString(context.raw)}`;
                            },
                            afterLabel: function(context) {
                                const datasetLabel = context.dataset.label;
                                const eventKey = datasetLabel.toLowerCase().replace(/\s+/g, '-').replace('im', 'IM');
                                const dateStr = uniqueDates[context.dataIndex];
                                const match = times.find(t => t.event === eventKey && t.course === courseVal && t.date === dateStr);
                                return match ? `Meet: ${match.location}` : '';
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: { color: '#9ca3af', font: { size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255, 255, 255, 0.03)' },
                        ticks: {
                            color: '#9ca3af',
                            font: { size: 11 },
                            callback: function(value) {
                                return secondsToTimeString(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Render Course Converter & Fall SCY Predictor
    renderCourseConverterSection(times);

    // Render Technical & DQ Analysis card
    renderDQAnalysis(times);
}

/**
 * Renders the Course Converter & Fall SCY Time Predictor section.
 */
function renderCourseConverterSection(times) {
    const container = document.getElementById('course-converter-section');
    if (!container) return;

    const predictions = generateFallSCYPredictions(times);

    let tableRowsHtml = '';
    predictions.forEach(p => {
        let deltaHtml = '<span style="color: var(--text-muted);">--</span>';
        if (p.deltaFromPreviousSCY !== null) {
            if (p.deltaFromPreviousSCY > 0) {
                deltaHtml = `<span style="color: var(--accent-green); font-weight: 700;">↓ -${p.deltaFromPreviousSCY.toFixed(2)}s Drop</span>`;
            } else if (p.deltaFromPreviousSCY < 0) {
                deltaHtml = `<span style="color: var(--accent-red); font-weight: 600;">+${Math.abs(p.deltaFromPreviousSCY).toFixed(2)}s</span>`;
            } else {
                deltaHtml = `<span style="color: var(--accent-cyan); font-weight: 600;">Same Pace</span>`;
            }
        }

        tableRowsHtml += `
            <tr style="border-bottom: 1px solid rgba(255,255,255,0.02);">
                <td style="font-weight: 700; font-family: 'Outfit'; color: #fff;">${p.eventName}</td>
                <td style="font-family: monospace; color: var(--accent-gold);">${p.lcmPR} <span style="font-size: 10px; color: var(--text-muted);">(${p.lcmPRDate})</span></td>
                <td style="font-family: monospace; color: var(--text-secondary);">${p.scyPR} <span style="font-size: 10px; color: var(--text-muted);">(${p.scyPRDate})</span></td>
                <td style="font-family: monospace; font-weight: 800; color: var(--accent-cyan); font-size: 15px;">${p.projectedSCYTime}</td>
                <td>${deltaHtml}</td>
                <td style="font-size: 12px; color: var(--text-secondary);">${p.conversionNote}</td>
            </tr>
        `;
    });

    container.innerHTML = `
        <div class="card">
            <div class="card-header" style="justify-content: space-between; flex-wrap: wrap; gap: 12px;">
                <h3 class="card-title">
                    <i data-lucide="calculator" style="color: var(--accent-cyan);"></i>
                    <span>Course Converter & Fall SCY Time Predictor</span>
                </h3>
                <span class="badge badge-aaaa" style="font-size: 11px;">USA Swimming / NCAA Conversion Standards</span>
            </div>

            <!-- Interactive Converter Box -->
            <div style="background: rgba(0, 240, 255, 0.03); border: 1px solid rgba(0, 240, 255, 0.15); border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                <h4 style="font-size: 14px; font-family: 'Outfit'; font-weight: 700; margin-bottom: 12px; color: var(--accent-cyan);">
                    ⚡ Quick Single-Time Converter
                </h4>
                <div style="display: flex; gap: 16px; flex-wrap: wrap; align-items: flex-end;">
                    <div class="form-group" style="margin-bottom: 0; min-width: 160px; flex: 1;">
                        <label for="calc-event-select">Event</label>
                        <select id="calc-event-select">
                            <option value="50-free">50 Free</option>
                            <option value="100-free" selected>100 Free</option>
                            <option value="200-free">200 Free</option>
                            <option value="500-free">500 Free / 400 LCM</option>
                            <option value="100-back">100 Back</option>
                            <option value="200-back">200 Back</option>
                            <option value="100-breast">100 Breast</option>
                            <option value="200-breast">200 Breast</option>
                            <option value="100-fly">100 Fly</option>
                            <option value="200-fly">200 Fly</option>
                            <option value="200-IM">200 IM</option>
                            <option value="400-IM">400 IM</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; min-width: 140px; flex: 1;">
                        <label for="calc-from-course">From Course</label>
                        <select id="calc-from-course">
                            <option value="LCM" selected>LCM (50m Pool)</option>
                            <option value="SCM">SCM (25m Pool)</option>
                            <option value="SCY">SCY (25yd Pool)</option>
                        </select>
                    </div>

                    <div class="form-group" style="margin-bottom: 0; min-width: 140px; flex: 1;">
                        <label for="calc-time-input">Logged Time</label>
                        <input type="text" id="calc-time-input" placeholder="e.g. 1:08.50" value="1:08.50" autocomplete="off" />
                    </div>

                    <div class="form-group" style="margin-bottom: 0; min-width: 140px; flex: 1;">
                        <label for="calc-to-course">To Target Course</label>
                        <select id="calc-to-course">
                            <option value="SCY" selected>SCY (25yd Pool)</option>
                            <option value="LCM">LCM (50m Pool)</option>
                            <option value="SCM">SCM (25m Pool)</option>
                        </select>
                    </div>
                </div>

                <!-- Live Result Display -->
                <div id="calc-result-box" style="margin-top: 16px; padding: 14px; background: rgba(0,0,0,0.3); border-radius: 10px; border: 1px solid var(--glass-border); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block;">Converted Time Result</span>
                        <span id="calc-output-time" style="font-family: 'Outfit', sans-serif; font-size: 26px; font-weight: 800; color: var(--accent-cyan);">--:--.--</span>
                    </div>
                    <div style="text-align: right; max-width: 380px;">
                        <span id="calc-output-formula" style="font-size: 12px; font-weight: 600; color: #fff; display: block;">--</span>
                        <span id="calc-output-note" style="font-size: 11px; color: var(--text-secondary);">--</span>
                    </div>
                </div>
            </div>

            <!-- Fall 2026 Prediction Table -->
            <div style="margin-bottom: 12px;">
                <h4 style="font-size: 15px; font-family: 'Outfit'; font-weight: 700; color: #fff; margin-bottom: 4px;">
                    🗓️ Fall SCY Time Predictions (Based on Summer 2026 Long Course Swims)
                </h4>
                <p style="font-size: 12px; color: var(--text-secondary);">
                    Converts Colin's best summer 50m long course times into estimated 25yd short course times for the upcoming Fall season.
                </p>
            </div>

            <div class="table-container">
                <table class="custom-table" style="min-width: 850px;">
                    <thead>
                        <tr>
                            <th>Event</th>
                            <th>Summer 2026 LCM PR</th>
                            <th>Spring SCY Baseline</th>
                            <th>Projected Fall SCY</th>
                            <th>Projected Drop</th>
                            <th>Conversion Insight</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${tableRowsHtml}
                    </tbody>
                </table>
            </div>

            <div style="margin-top: 16px; padding: 12px 16px; background: rgba(255,255,255,0.02); border-radius: 8px; border-left: 3px solid var(--accent-cyan); font-size: 12px; color: var(--text-secondary);">
                <strong style="color: #fff;">💡 Why Long Course Predicts Faster Short Course Times:</strong> 
                A 50-meter Long Course (LCM) pool requires non-stop swimming with zero turns per 50m. In a 25-yard Short Course (SCY) pool, swimmers get powerful wall push-offs and underwater streamline breakouts every 25 yards. Therefore, long course summer conditioning directly translates into significant time drops during the short course fall season!
            </div>
        </div>
    `;

    // Wire up live calculator events
    const eventSelect = document.getElementById('calc-event-select');
    const fromCourseSelect = document.getElementById('calc-from-course');
    const timeInput = document.getElementById('calc-time-input');
    const toCourseSelect = document.getElementById('calc-to-course');

    const updateCalc = () => {
        const ev = eventSelect.value;
        const fromC = fromCourseSelect.value;
        const toC = toCourseSelect.value;
        const val = timeInput.value;

        const res = convertCourseTime(val, fromC, toC, ev);
        const outputTime = document.getElementById('calc-output-time');
        const outputFormula = document.getElementById('calc-output-formula');
        const outputNote = document.getElementById('calc-output-note');

        if (outputTime) outputTime.innerText = res.formatted;
        if (outputFormula) outputFormula.innerText = res.formula;
        if (outputNote) outputNote.innerText = res.note;
    };

    [eventSelect, fromCourseSelect, timeInput, toCourseSelect].forEach(el => {
        if (el) {
            el.addEventListener('input', updateCalc);
            el.addEventListener('change', updateCalc);
        }
    });

    updateCalc();
}

/**
 * Calculates DQ counts, DQ rate, stroke distributions, and improvement patterns.
 */
function renderDQAnalysis(times) {
    const container = document.getElementById('dq-analysis-section');
    if (!container) return;
    
    const totalSwims = times.length;
    const dqSwims = times.filter(t => t.time.trim().toUpperCase() === 'DQ');
    const dqCount = dqSwims.length;
    const dqRate = totalSwims > 0 ? ((dqCount / totalSwims) * 100).toFixed(1) : '0.0';
    
    // Sort all times descending to check consecutive clean swims
    const sortedTimes = [...times].sort((a, b) => new Date(b.date) - new Date(a.date));
    let cleanSwimsCount = 0;
    let foundDQ = false;
    
    for (let i = 0; i < sortedTimes.length; i++) {
        if (sortedTimes[i].time.trim().toUpperCase() === 'DQ') {
            foundDQ = true;
            break;
        }
        cleanSwimsCount++;
    }
    
    // Categorize DQs by stroke
    const strokeCounts = { Fly: 0, Back: 0, Breast: 0, Free: 0, IM: 0 };
    dqSwims.forEach(t => {
        const ev = t.event.toLowerCase();
        if (ev.includes('fly')) strokeCounts.Fly++;
        else if (ev.includes('back')) strokeCounts.Back++;
        else if (ev.includes('breast')) strokeCounts.Breast++;
        else if (ev.includes('free')) strokeCounts.Free++;
        else if (ev.includes('im')) strokeCounts.IM++;
    });
    
    // Dynamic advice based on dominant DQ stroke
    let adviceTitle = "Form Compliance Tips";
    let adviceText = "Keep up the technical training! Practice two-hand touches on breaststroke/butterfly finishes and clean transition turns in IM sets.";
    let adviceColor = "var(--accent-cyan)";
    
    let maxStroke = '';
    let maxDQs = 0;
    Object.keys(strokeCounts).forEach(s => {
        if (strokeCounts[s] > maxDQs) {
            maxDQs = strokeCounts[s];
            maxStroke = s;
        }
    });
    
    if (maxDQs > 0) {
        if (maxStroke === 'Breast') {
            adviceTitle = "Breaststroke Technical Focus";
            adviceText = "Most DQs are recorded in Breaststroke. Emphasize simultaneous two-hand touches on turns/finishes, check that feet are turned outward on the kick, and ensure no illegal butterfly kicks occur during underwater pullouts.";
            adviceColor = "var(--accent-red)";
        } else if (maxStroke === 'Fly') {
            adviceTitle = "Butterfly Technical Focus";
            adviceText = "Most DQs are recorded in Butterfly. Ensure the arm recovery is simultaneous above the surface and the legs execute breaststroke-free kick actions (only simultaneous dolphin kicks are legal).";
            adviceColor = "var(--accent-purple)";
        } else if (maxStroke === 'Back') {
            adviceTitle = "Backstroke Technical Focus";
            adviceText = "Most DQs are recorded in Backstroke. Ensure the shoulders do not roll past vertical onto the breast before initiating the turn, and watch out for non-continuous turning motions.";
            adviceColor = "var(--accent-gold)";
        } else if (maxStroke === 'IM') {
            adviceTitle = "IM Transition Focus";
            adviceText = "Most DQs are recorded in IM. Check the Back-to-Breast transition (Ledecky/crossover turns can be tricky). Ensure you finish on your back before leaving the wall on backstroke, and start on your breast when starting breaststroke.";
            adviceColor = "var(--accent-purple)";
        }
    }

    let progressText = "";
    if (dqCount === 0) {
        progressText = `<span style="color: var(--accent-green); font-weight: 600;">Perfect Technical Record!</span> Colin has 0 disqualifications logged. Excellent racing form!`;
    } else if (cleanSwimsCount > 0) {
        progressText = `<span style="color: var(--accent-green); font-weight: 600;">Technical Improvement!</span> Colin has swum <strong>${cleanSwimsCount}</strong> consecutive clean races since his last disqualification. Form is getting more consistent!`;
    } else {
        progressText = `<span style="color: var(--accent-red); font-weight: 600;">Attention Needed:</span> The most recent swim resulted in a DQ. Highlight technical discipline in the next workout.`;
    }
    
    container.innerHTML = `
        <div class="card" style="padding: 24px; background: linear-gradient(135deg, rgba(255,255,255,0.01) 0%, rgba(255, 56, 56, 0.02) 100%); border: 1px solid var(--glass-border);">
            <div class="card-header" style="padding-bottom: 16px; margin-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.05); display: flex; align-items: center; gap: 8px;">
                <i data-lucide="alert-octagon" style="color: ${dqCount > 0 ? 'var(--accent-red)' : 'var(--accent-green)'}; width: 20px; height: 20px;"></i>
                <h3 class="card-title" style="font-size: 18px; font-family: 'Outfit'; margin: 0;">Technical & DQ Analytics</h3>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 32px;">
                <!-- Column 1: DQ Stats -->
                <div style="display: flex; flex-direction: column; gap: 20px; border-right: 1px solid rgba(255,255,255,0.05); padding-right: 20px;">
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; letter-spacing: 0.05em; margin-bottom: 4px;">Total Disqualifications</span>
                        <span style="font-family: 'Outfit'; font-size: 32px; font-weight: 800; color: ${dqCount > 0 ? 'var(--accent-red)' : 'var(--text-primary)'};">${dqCount}</span>
                    </div>
                    <div>
                        <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; letter-spacing: 0.05em; margin-bottom: 4px;">Disqualification Rate</span>
                        <span style="font-family: 'Outfit'; font-size: 32px; font-weight: 800; color: ${dqCount > 0 ? 'var(--accent-purple)' : 'var(--accent-green)'};">${dqRate}%</span>
                        <span style="font-size: 11px; color: var(--text-secondary); display: block; margin-top: 2px;">out of ${totalSwims} total races</span>
                    </div>
                </div>
                
                <!-- Column 2: Stroke Distribution -->
                <div style="border-right: 1px solid rgba(255,255,255,0.05); padding-right: 20px; display: flex; flex-direction: column; justify-content: center;">
                    <span style="font-size: 11px; text-transform: uppercase; color: var(--text-muted); display: block; letter-spacing: 0.05em; margin-bottom: 12px;">DQs by Stroke Category</span>
                    <div style="display: flex; flex-direction: column; gap: 10px; font-size: 13px;">
                        ${Object.keys(strokeCounts).map(s => {
                            const count = strokeCounts[s];
                            const pct = dqCount > 0 ? Math.round((count / dqCount) * 100) : 0;
                            return `
                                <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                                    <span style="color: var(--text-primary); font-weight: 500; min-width: 80px;">${s}</span>
                                    <div style="flex: 1; height: 6px; background: rgba(255,255,255,0.03); border-radius: 3px; overflow: hidden;">
                                        <div style="width: ${pct}%; height: 100%; background: ${count > 0 ? 'var(--accent-red)' : 'var(--text-muted)'}; border-radius: 3px;"></div>
                                    </div>
                                    <span style="font-family: 'Outfit'; font-weight: 600; width: 30px; text-align: right; color: ${count > 0 ? 'var(--accent-red)' : 'var(--text-muted)'}">${count}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                
                <!-- Column 3: Coaching Insight -->
                <div style="display: flex; flex-direction: column; gap: 16px; justify-content: center;">
                    <div style="padding: 14px; background: rgba(255,255,255,0.015); border: 1px solid var(--glass-border); border-radius: 8px; font-size: 12px; line-height: 1.5; color: var(--text-secondary);">
                        ${progressText}
                    </div>
                    <div style="border-left: 3px solid ${adviceColor}; padding-left: 12px; font-size: 12px; line-height: 1.6;">
                        <span style="font-family: 'Outfit'; font-weight: 700; color: #fff; display: block; margin-bottom: 4px; font-size: 13px;">${adviceTitle}</span>
                        <p style="color: var(--text-secondary); margin: 0; font-style: italic;">"${adviceText}"</p>
                    </div>
                </div>
            </div>
        </div>
    `;
    lucide.createIcons({ scope: container });
}

// --- Main View Hook ---

export async function initAnalyticsView() {
    const container = document.getElementById('main-viewport');
    container.innerHTML = ANALYTICS_VIEW_HTML;
    
    const modeSelect = document.getElementById('chart-mode-select');
    const eventSelect = document.getElementById('chart-event-select');
    const strokeSelect = document.getElementById('chart-stroke-select');
    const standardSelect = document.getElementById('chart-standard-select');
    const courseSelect = document.getElementById('chart-course-select');
    
    const groupEvent = document.getElementById('group-event-select');
    const groupStroke = document.getElementById('group-stroke-select');
    const groupStandard = document.getElementById('group-standard-select');
    
    // Toggle selector visibility based on mode choice
    modeSelect.addEventListener('change', async () => {
        if (modeSelect.value === 'single') {
            groupEvent.style.display = 'block';
            groupStroke.style.display = 'none';
            groupStandard.style.display = 'block';
        } else {
            groupEvent.style.display = 'none';
            groupStroke.style.display = 'block';
            groupStandard.style.display = 'none';
        }
        await drawProgressChart();
    });
    
    eventSelect.addEventListener('change', async () => await drawProgressChart());
    strokeSelect.addEventListener('change', async () => await drawProgressChart());
    standardSelect.addEventListener('change', async () => await drawProgressChart());
    courseSelect.addEventListener('change', async () => await drawProgressChart());
    
    document.getElementById('analytics-export-pdf-btn')?.addEventListener('click', () => {
        exportAnalyticsPDF();
    });

    // Draw initial chart
    await drawProgressChart();
    
    lucide.createIcons();
}
