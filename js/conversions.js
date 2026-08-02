/* ==========================================================================
   AeroSwim Course Time Conversion & Projection Engine
   Standard NCAA & USA Swimming Age-Group Conversion Algorithms
   ========================================================================== */

import { timeStringToSeconds, secondsToTimeString } from './storage.js';

/**
 * Returns turn deduction constants based on event stroke and distance.
 * In Short Course Yards (25yd), swimmers get a speed boost from flip turns and push-offs.
 */
function getTurnDeduction(eventKey) {
    const ev = (eventKey || '').toLowerCase();
    
    // Distance Events
    if (ev.includes('500') || ev.includes('400')) return 0; // Special distance ratio formula used
    if (ev.includes('1000') || ev.includes('800')) return 0;
    if (ev.includes('1650') || ev.includes('1500')) return 0;

    // Breaststroke has larger wall advantages due to underwater pullouts
    if (ev.includes('breast')) {
        if (ev.includes('50-')) return 1.0;
        if (ev.includes('100-')) return 2.0;
        if (ev.includes('200-')) return 4.0;
    }
    
    // IM Events
    if (ev.includes('im')) {
        if (ev.includes('100-')) return 1.6;
        if (ev.includes('200-')) return 3.2;
        if (ev.includes('400-')) return 6.4;
    }

    // Free, Back, Fly
    if (ev.includes('50-')) return 0.80;
    if (ev.includes('100-')) return 1.60;
    if (ev.includes('200-')) return 3.20;

    return 1.60; // Default 100m fallback
}

/**
 * Converts a swim time string between pool courses: 'LCM' (50m), 'SCY' (25yd), 'SCM' (25m).
 * @param {string} timeStr - Time string formatted as "MM:SS.ss" or "SS.ss"
 * @param {string} fromCourse - 'LCM', 'SCY', or 'SCM'
 * @param {string} toCourse - 'LCM', 'SCY', or 'SCM'
 * @param {string} eventKey - e.g. '50-free', '100-back', '200-IM'
 * @returns {Object} Conversion result object with formatted time, raw seconds, and breakdown note
 */
export function convertCourseTime(timeStr, fromCourse, toCourse, eventKey = '100-free') {
    if (!timeStr || timeStr === 'DQ' || timeStr === '--') {
        return { formatted: '--:--.--', seconds: null, formula: 'N/A', note: 'No valid time' };
    }

    const inputSecs = timeStringToSeconds(timeStr);
    if (!inputSecs || isNaN(inputSecs)) {
        return { formatted: '--:--.--', seconds: null, formula: 'N/A', note: 'Invalid time format' };
    }

    if (fromCourse === toCourse) {
        return {
            formatted: secondsToTimeString(inputSecs),
            seconds: inputSecs,
            formula: 'Direct Same Course',
            note: 'No conversion required'
        };
    }

    let resultSecs = inputSecs;
    let formulaName = '';
    let explanationNote = '';

    const ev = (eventKey || '').toLowerCase();
    const turnDeduction = getTurnDeduction(ev);

    // 1. Convert to SCY first if starting from LCM or SCM
    let scySecs = inputSecs;

    if (fromCourse === 'LCM') {
        if (ev.includes('500') || ev.includes('400-free')) {
            // 400m LCM -> 500yd SCY
            scySecs = inputSecs * 1.140;
            formulaName = 'USA Swimming Distance Ratio (1.140x)';
            explanationNote = 'Converted 400m Long Course to 500yd Short Course.';
        } else if (ev.includes('1000') || ev.includes('800-free')) {
            // 800m LCM -> 1000yd SCY
            scySecs = inputSecs * 1.140;
            formulaName = 'USA Swimming Distance Ratio (1.140x)';
            explanationNote = 'Converted 800m Long Course to 1000yd Short Course.';
        } else if (ev.includes('1650') || ev.includes('1500-free')) {
            // 1500m LCM -> 1650yd SCY
            scySecs = inputSecs * 1.015;
            formulaName = 'USA Swimming Distance Ratio (1.015x)';
            explanationNote = 'Converted 1500m Long Course to 1650yd Short Course.';
        } else {
            // Standard LCM -> SCY: (LCM_sec - turnDeduction) / 1.11
            scySecs = Math.max(1, (inputSecs - turnDeduction) / 1.11);
            formulaName = 'NCAA / USA Swimming Turn-Adjusted Standard';
            explanationNote = `Subtracted ${turnDeduction.toFixed(1)}s for flip-turn wall push-offs and converted meters to yards.`;
        }
    } else if (fromCourse === 'SCM') {
        // SCM -> SCY: 25m to 25yd ratio
        scySecs = inputSecs / 1.11;
        formulaName = 'Short Course Meters to Yards Factor (1.11x)';
        explanationNote = 'Converted 25-meter pool length to 25-yard pool length.';
    }

    // 2. Output to target course
    if (toCourse === 'SCY') {
        resultSecs = scySecs;
    } else if (toCourse === 'LCM') {
        if (fromCourse === 'SCY') {
            if (ev.includes('500') || ev.includes('400')) {
                resultSecs = inputSecs / 1.140;
                formulaName = 'USA Swimming Distance Ratio (1 / 1.140)';
            } else if (ev.includes('1000') || ev.includes('800')) {
                resultSecs = inputSecs / 1.140;
            } else if (ev.includes('1650') || ev.includes('1500')) {
                resultSecs = inputSecs / 1.015;
            } else {
                // SCY -> LCM: (SCY_sec * 1.11) + turnDeduction
                resultSecs = (inputSecs * 1.11) + turnDeduction;
                formulaName = 'Reverse NCAA / USA Swimming Standard';
            }
            explanationNote = `Converted 25-yard pool to 50-meter long course, accounting for fewer turns (+${turnDeduction.toFixed(1)}s turn penalty).`;
        } else if (fromCourse === 'SCM') {
            // SCM -> LCM
            const turnPenalty = turnDeduction * 0.5;
            resultSecs = inputSecs + turnPenalty;
            formulaName = 'Short Course to Long Course Turn Penalty';
            explanationNote = 'Added turn time allowance for 50m long course pool.';
        }
    } else if (toCourse === 'SCM') {
        if (fromCourse === 'SCY') {
            resultSecs = scySecs * 1.11;
            formulaName = 'Yards to Meters Factor (1.11x)';
        } else if (fromCourse === 'LCM') {
            const turnCredit = turnDeduction * 0.5;
            resultSecs = Math.max(1, inputSecs - turnCredit);
            formulaName = 'Long Course to Short Course Meters Turn Credit';
        }
    }

    return {
        formatted: secondsToTimeString(resultSecs),
        seconds: resultSecs,
        formula: formulaName,
        note: explanationNote
    };
}

/**
 * Helper to generate a full prediction model comparing a swimmer's summer LCM PRs
 * against their spring SCY PRs and calculating projected Fall SCY times.
 */
export function generateFallSCYPredictions(timesList) {
    const scyTimes = timesList.filter(t => t.course === 'SCY' && !t.isDQ && t.time && t.time !== 'DQ');
    const lcmTimes = timesList.filter(t => t.course === 'LCM' && !t.isDQ && t.time && t.time !== 'DQ');

    // Group PRs by event
    const getPRMap = (list) => {
        const map = {};
        list.forEach(t => {
            const sec = timeStringToSeconds(t.time);
            if (!map[t.event] || sec < map[t.event].sec) {
                map[t.event] = { time: t.time, sec: sec, date: t.date, location: t.location };
            }
        });
        return map;
    };

    const scyPRs = getPRMap(scyTimes);
    const lcmPRs = getPRMap(lcmTimes);

    // Collect all events logged in either course
    const allEvents = Array.from(new Set([...Object.keys(scyPRs), ...Object.keys(lcmPRs)]));

    const predictions = allEvents.map(eventKey => {
        const scyPR = scyPRs[eventKey];
        const lcmPR = lcmPRs[eventKey];

        const convertedFromLCM = lcmPR ? convertCourseTime(lcmPR.time, 'LCM', 'SCY', eventKey) : null;

        let projectedSCYTime = null;
        let projectedSecs = null;
        let deltaFromPreviousSCY = null;
        let statusBadge = 'No Summer Data';

        if (convertedFromLCM && convertedFromLCM.seconds) {
            projectedSecs = convertedFromLCM.seconds;
            projectedSCYTime = convertedFromLCM.formatted;

            if (scyPR) {
                deltaFromPreviousSCY = scyPR.sec - projectedSecs; // Positive means faster projected SCY
                if (deltaFromPreviousSCY > 0) {
                    statusBadge = `🔥 Projected -${deltaFromPreviousSCY.toFixed(2)}s Drop`;
                } else {
                    statusBadge = `↔ On Pace (+${Math.abs(deltaFromPreviousSCY).toFixed(2)}s)`;
                }
            } else {
                statusBadge = '✨ New Projected SCY Baseline';
            }
        } else if (scyPR) {
            projectedSCYTime = scyPR.time;
            projectedSecs = scyPR.sec;
            statusBadge = 'Spring SCY Baseline (No Summer Swims)';
        }

        const eventName = eventKey.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        return {
            eventKey,
            eventName,
            scyPR: scyPR ? scyPR.time : '--:--.--',
            scyPRDate: scyPR ? scyPR.date : '--',
            lcmPR: lcmPR ? lcmPR.time : '--:--.--',
            lcmPRDate: lcmPR ? lcmPR.date : '--',
            projectedSCYTime: projectedSCYTime || '--:--.--',
            projectedSecs: projectedSecs,
            deltaFromPreviousSCY,
            statusBadge,
            conversionNote: convertedFromLCM ? convertedFromLCM.note : 'No summer LCM time logged to convert'
        };
    });

    return predictions;
}
