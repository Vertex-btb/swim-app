/* ==========================================================================
   AeroSwim Swim Times & Meets Log View (With SpreadSheet Grid Editor)
   ========================================================================== */

import { getTimes, addTime, deleteTime, saveTimes, updateTime, timeStringToSeconds, secondsToTimeString, getProfile, safeFormatDate } from './storage.js';
import { STANDARDS_DATA, getAchievedStandard, getAgeBracketForAge } from './standards.js';

// --- HTML Template for Times View ---

const TIMES_VIEW_HTML = `
<div class="card">
    <div class="card-header" style="flex-wrap: wrap; gap: 16px;">
        <h2 class="card-title">
            <i data-lucide="timer"></i>
            <span>Swim Times & Meets Log</span>
        </h2>
        <!-- Mode Switcher -->
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary active" id="btn-times-view-list" style="padding: 8px 14px; font-size: 13px;">
                <i data-lucide="list"></i>
                <span>List View</span>
            </button>
            <button class="btn btn-secondary" id="btn-times-view-grid" style="padding: 8px 14px; font-size: 13px;">
                <i data-lucide="grid"></i>
                <span>Grid Editor</span>
            </button>
            <button class="btn btn-primary" id="times-log-new-btn">
                <i data-lucide="plus"></i>
                <span>Log Time Entry</span>
            </button>
        </div>
    </div>

    <!-- VIEW 1: Read-only Filterable List View -->
    <div id="times-list-mode-container">
        <!-- Filter & Search Controls -->
        <div class="filter-bar">
            <div class="filter-controls">
                <div class="search-input-wrapper">
                    <i data-lucide="search"></i>
                    <input type="text" id="filter-search" class="search-input" placeholder="Search meet/location...">
                </div>
                
                <select id="filter-stroke" class="filter-select">
                    <option value="all">All Strokes</option>
                    <option value="free">Freestyle</option>
                    <option value="back">Backstroke</option>
                    <option value="breast">Breaststroke</option>
                    <option value="fly">Butterfly</option>
                    <option value="IM">Individual Medley</option>
                </select>

                <select id="filter-course" class="filter-select">
                    <option value="all">All Courses</option>
                    <option value="SCY">Short Course Yards (SCY)</option>
                    <option value="LCM">Long Course Meters (LCM)</option>
                    <option value="SCM">Short Course Meters (SCM)</option>
                </select>
            </div>
            
            <div style="font-size: 13px; color: var(--text-secondary);" id="times-count-label">
                Showing -- entries
            </div>
        </div>

        <!-- Times Table -->
        <div class="table-container">
            <table class="custom-table" id="times-table">
                <thead>
                    <tr>
                        <th>Date</th>
                        <th>Event</th>
                        <th>Course</th>
                        <th>Time</th>
                        <th>Location / Meet Name</th>
                        <th style="text-align: right;">Actions</th>
                    </tr>
                </thead>
                <tbody id="times-table-body">
                    <!-- Loaded dynamically -->
                </tbody>
            </table>
        </div>
    </div>

    <!-- VIEW 2: Interactive Grid Editor -->
    <div id="times-grid-mode-container" style="display: none;">
        <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 13px; line-height: 1.5;">
            Modify cells directly in the grid. Click <strong>+ Add Row</strong> to append new rows, and click <strong>Save Changes</strong> to sync all changes to Google Sheets at once.
        </p>

        <!-- Spreadsheet Grid Table -->
        <div class="table-container">
            <table class="custom-table" style="min-width: 800px;">
                <thead>
                    <tr>
                        <th style="width: 15%;">Date</th>
                        <th style="width: 20%;">Event</th>
                        <th style="width: 15%;">Course</th>
                        <th style="width: 15%;">Time</th>
                        <th style="width: 28%;">Location / Meet Name</th>
                        <th style="width: 7%; text-align: center;">Action</th>
                    </tr>
                </thead>
                <tbody id="spreadsheet-grid-body">
                    <!-- Rendered dynamically -->
                </tbody>
            </table>
        </div>

        <!-- Grid Editor Buttons -->
        <div style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
            <button class="btn btn-secondary" id="btn-grid-add-row">
                <i data-lucide="plus-circle"></i>
                <span>+ Add Row</span>
            </button>
            <div style="display: flex; gap: 12px;">
                <button class="btn btn-secondary" id="btn-grid-discard" style="border-color: rgba(255, 56, 56, 0.3); color: var(--accent-red);">
                    <i data-lucide="x"></i>
                    <span>Discard Changes</span>
                </button>
                <button class="btn btn-primary" id="btn-grid-save">
                    <i data-lucide="save"></i>
                    <span>Save Changes</span>
                </button>
            </div>
        </div>
    </div>
</div>
`;

// Event options list helper for select tags
const EVENT_OPTIONS = [
    { value: "50-free", label: "50 Free" },
    { value: "100-free", label: "100 Free" },
    { value: "200-free", label: "200 Free" },
    { value: "500-free", label: "500 Free" },
    { value: "1000-free", label: "1000 Free" },
    { value: "1650-free", label: "1650 Free" },
    { value: "50-back", label: "50 Back" },
    { value: "100-back", label: "100 Back" },
    { value: "200-back", label: "200 Back" },
    { value: "50-breast", label: "50 Breast" },
    { value: "100-breast", label: "100 Breast" },
    { value: "200-breast", label: "200 Breast" },
    { value: "50-fly", label: "50 Fly" },
    { value: "100-fly", label: "100 Fly" },
    { value: "200-fly", label: "200 Fly" },
    { value: "100-IM", label: "100 IM" },
    { value: "200-IM", label: "200 IM" },
    { value: "400-IM", label: "400 IM" }
];

// --- Computations & Routing ---

let activeSearchQuery = '';
let activeStrokeFilter = 'all';
let activeCourseFilter = 'all';
let activeMode = 'list'; // 'list' or 'grid'
let gridEntries = []; // Local grid memory copy

/**
 * Calculates which logged times are Personal Records (fastest for Event+Course)
 */
function getPRIds(times) {
    const prMap = {};
    times.forEach(t => {
        const key = `${t.event}_${t.course}`;
        const sec = timeStringToSeconds(t.time);
        if (sec === Infinity) return; // DQs are not valid PR times
        if (!prMap[key] || sec < timeStringToSeconds(prMap[key].time)) {
            prMap[key] = t;
        }
    });
    const prIds = new Set();
    Object.values(prMap).forEach(t => prIds.add(t.id));
    return prIds;
}

/**
 * Renders the read-only tabular list view
 */
export async function renderTimesTable() {
    const tableBody = document.getElementById('times-table-body');
    if (!tableBody) return;
    
    const times = await getTimes();
    const prIds = getPRIds(times);
    const profile = getProfile();
    
    // Choose correct standards cuts
    const ageBracket = getAgeBracketForAge(profile.age, 'USA');
    const gender = profile.gender || "Boys";
    const cuts = (STANDARDS_DATA[ageBracket] && STANDARDS_DATA[ageBracket][gender]) ? STANDARDS_DATA[ageBracket][gender] : STANDARDS_DATA["13-14"]["Boys"];
    
    const filteredTimes = times.filter(entry => {
        const matchesSearch = entry.location.toLowerCase().includes(activeSearchQuery.toLowerCase());
        let matchesStroke = false;
        if (activeStrokeFilter === 'all') {
            matchesStroke = true;
        } else {
            matchesStroke = entry.event.endsWith(`-${activeStrokeFilter}`) || entry.event === activeStrokeFilter;
        }
        const matchesCourse = activeCourseFilter === 'all' || entry.course === activeCourseFilter;
        return matchesSearch && matchesStroke && matchesCourse;
    });

    document.getElementById('times-count-label').innerText = `Showing ${filteredTimes.length} of ${times.length} entries`;
    tableBody.innerHTML = '';
    
    if (filteredTimes.length === 0) {
        tableBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    No times match the selected filters. Click "Log Time Entry" or edit in Grid.
                </td>
            </tr>
        `;
        return;
    }

    filteredTimes.forEach(entry => {
        const row = document.createElement('tr');
        const eventText = entry.event.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
        const isPR = prIds.has(entry.id);
        const isDQ = entry.time.trim().toUpperCase() === 'DQ';
        
        // Standard Badge check
        let standardBadgeHtml = '';
        if (isDQ) {
            standardBadgeHtml = `<span class="badge" style="background: rgba(255, 56, 56, 0.12); border: 1px solid rgba(255, 56, 56, 0.15); color: var(--accent-red); margin-left: 6px; font-size: 10px; padding: 2px 6px; border-radius: 4px;">DQ</span>`;
        } else if (entry.course === 'SCY' && cuts[entry.event]) {
            const eventCuts = cuts[entry.event];
            const achieved = getAchievedStandard(timeStringToSeconds(entry.time), eventCuts);
            if (achieved !== 'None') {
                let badgeColorClass = '';
                if (achieved === 'AAAA') badgeColorClass = 'badge-aaaa';
                else if (achieved === 'AAA') badgeColorClass = 'badge-aaa';
                else if (achieved === 'AA') badgeColorClass = 'badge-aa';
                else if (achieved === 'A') badgeColorClass = 'badge-a';
                else if (achieved === 'BB') badgeColorClass = 'badge-bb';
                else if (achieved === 'B') badgeColorClass = 'badge-b';
                
                standardBadgeHtml = `<span class="badge ${badgeColorClass}" style="margin-left: 6px; font-size: 10px; padding: 2px 6px; border-radius: 4px;" title="${achieved} Standard Target">${achieved}</span>`;
            }
        }
        
        const history = times
            .filter(t => t.event === entry.event && t.course === entry.course && t.time.trim().toUpperCase() !== 'DQ' && new Date(t.date) < new Date(entry.date))
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        
        let dropHtml = '';
        if (!isDQ && history.length > 0) {
            const prevSec = timeStringToSeconds(history[0].time);
            const currSec = timeStringToSeconds(entry.time);
            const diff = prevSec - currSec;
            if (diff > 0) {
                dropHtml = `<div class="time-drop-badge" title="Dropped from ${history[0].time}"><i data-lucide="chevron-down" style="width: 12px; height: 12px; stroke-width: 3;"></i>-${diff.toFixed(2)}s</div>`;
            }
        }

        const dateFormatted = safeFormatDate(entry.date);

        row.innerHTML = `
            <td style="font-weight: 500;">${dateFormatted}</td>
            <td style="font-weight: 600;">${eventText}</td>
            <td><span class="badge badge-${entry.course.toLowerCase()}">${entry.course}</span></td>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <span style="font-family: 'Outfit', sans-serif; font-size: 16px; font-weight: 700; color: ${isDQ ? 'var(--accent-red)' : (isPR ? 'var(--accent-cyan)' : 'inherit')}">
                        ${isDQ ? 'DQ' : entry.time}
                    </span>
                    ${standardBadgeHtml}
                    ${isPR ? '<span class="pr-badge" title="Personal Record"><i data-lucide="trophy" style="width: 14px; height: 14px;"></i></span>' : ''}
                    ${dropHtml}
                </div>
            </td>
            <td style="color: var(--text-secondary); max-width: 250px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${entry.location}
            </td>
            <td style="text-align: right;">
                <button class="btn btn-secondary btn-edit" data-id="${entry.id}" style="padding: 6px 10px; font-size: 12px; margin-right: 6px;">
                    <i data-lucide="edit-2" style="width: 12px; height: 12px;"></i>
                </button>
                <button class="btn btn-danger btn-delete" data-id="${entry.id}" style="padding: 6px 10px; font-size: 12px;">
                    <i data-lucide="trash-2" style="width: 12px; height: 12px;"></i>
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });

    tableBody.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', () => editEntry(btn.getAttribute('data-id')));
    });

    tableBody.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', () => deleteEntry(btn.getAttribute('data-id')));
    });

    lucide.createIcons();
}

// --- Spreadsheet Grid Renderer & Change Listeners ---

/**
 * Builds the spreadsheet inputs grid based on local `gridEntries` copy
 */
function renderSpreadsheetGrid() {
    const gridBody = document.getElementById('spreadsheet-grid-body');
    if (!gridBody) return;
    
    gridBody.innerHTML = '';
    
    if (gridEntries.length === 0) {
        gridBody.innerHTML = `
            <tr>
                <td colspan="6" style="text-align: center; padding: 40px; color: var(--text-muted);">
                    Grid is empty. Click "+ Add Row" to insert logs.
                </td>
            </tr>
        `;
        return;
    }

    gridEntries.forEach((entry, index) => {
        const row = document.createElement('tr');
        
        // Generate Event options dropdown
        let eventOptionsHtml = '';
        EVENT_OPTIONS.forEach(opt => {
            eventOptionsHtml += `<option value="${opt.value}" ${entry.event === opt.value ? 'selected' : ''}>${opt.label}</option>`;
        });

        // Generate Course options dropdown
        const courses = ['SCY', 'LCM', 'SCM'];
        let courseOptionsHtml = '';
        courses.forEach(c => {
            courseOptionsHtml += `<option value="${c}" ${entry.course === c ? 'selected' : ''}>${c}</option>`;
        });

        row.innerHTML = `
            <td>
                <input type="date" class="grid-cell-input date-input" data-idx="${index}" value="${entry.date}" style="width: 100%; border: none; background: transparent; padding: 4px; color: var(--text-primary);">
            </td>
            <td>
                <select class="grid-cell-input event-select" data-idx="${index}" style="width: 100%; border: none; background: transparent; padding: 4px; color: var(--text-primary);">
                    ${eventOptionsHtml}
                </select>
            </td>
            <td>
                <select class="grid-cell-input course-select" data-idx="${index}" style="width: 100%; border: none; background: transparent; padding: 4px; color: var(--text-primary);">
                    ${courseOptionsHtml}
                </select>
            </td>
            <td>
                <input type="text" class="grid-cell-input time-input" data-idx="${index}" value="${entry.time}" placeholder="e.g. 58.23" style="width: 100%; border: none; background: transparent; padding: 4px; color: var(--text-primary); font-family: monospace;">
            </td>
            <td>
                <input type="text" class="grid-cell-input loc-input" data-idx="${index}" value="${entry.location}" placeholder="YMCA Pool" style="width: 100%; border: none; background: transparent; padding: 4px; color: var(--text-primary);">
            </td>
            <td style="text-align: center;">
                <button class="btn btn-danger btn-grid-row-delete" data-idx="${index}" style="padding: 6px; border-radius: 4px; background: rgba(255, 56, 56, 0.1);">
                    <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                </button>
            </td>
        `;
        
        gridBody.appendChild(row);
    });

    // Wire up change listener hooks to sync UI inputs directly with memory `gridEntries`
    gridBody.querySelectorAll('.grid-cell-input').forEach(input => {
        input.addEventListener('change', (e) => {
            const idx = parseInt(e.target.getAttribute('data-idx'));
            const val = e.target.value;
            
            if (e.target.classList.contains('date-input')) gridEntries[idx].date = val;
            else if (e.target.classList.contains('event-select')) gridEntries[idx].event = val;
            else if (e.target.classList.contains('course-select')) gridEntries[idx].course = val;
            else if (e.target.classList.contains('time-input')) gridEntries[idx].time = val;
            else if (e.target.classList.contains('loc-input')) gridEntries[idx].location = val;
        });
    });

    // Wire delete row buttons
    gridBody.querySelectorAll('.btn-grid-row-delete').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            gridEntries.splice(idx, 1);
            renderSpreadsheetGrid();
        });
    });

    lucide.createIcons();
}

// --- Toggle Modes (List vs Grid) ---

async function switchToMode(mode) {
    activeMode = mode;
    const btnList = document.getElementById('btn-times-view-list');
    const btnGrid = document.getElementById('btn-times-view-grid');
    const containerList = document.getElementById('times-list-mode-container');
    const containerGrid = document.getElementById('times-grid-mode-container');
    const logNewBtn = document.getElementById('times-log-new-btn');
    
    if (mode === 'grid') {
        btnList.classList.remove('active');
        btnGrid.classList.add('active');
        containerList.style.display = 'none';
        containerGrid.style.display = 'block';
        if (logNewBtn) logNewBtn.style.display = 'none';
        
        // Prepare gridEntries by loading fresh data copies from storage
        const currentTimes = await getTimes();
        // Deep copy
        gridEntries = JSON.parse(JSON.stringify(currentTimes));
        renderSpreadsheetGrid();
    } else {
        btnList.classList.add('active');
        btnGrid.classList.remove('active');
        containerList.style.display = 'block';
        containerGrid.style.display = 'none';
        if (logNewBtn) logNewBtn.style.display = 'inline-flex';
        
        await renderTimesTable();
    }
}

// --- CRUD View Modals ---

async function openLogTimeModal(editId = null) {
    const modal = document.getElementById('time-modal');
    const form = document.getElementById('time-form');
    const title = document.getElementById('time-modal-title');
    const saveBtn = document.getElementById('save-time-btn');
    
    form.reset();
    document.getElementById('time-id').value = '';
    
    if (editId) {
        title.innerText = "Edit Swim Time";
        saveBtn.innerText = "Update Entry";
        
        const times = await getTimes();
        const entry = times.find(t => t.id === editId);
        
        if (entry) {
            document.getElementById('time-id').value = entry.id;
            document.getElementById('time-input-date').value = entry.date;
            document.getElementById('time-input-course').value = entry.course;
            document.getElementById('time-input-event').value = entry.event;
            document.getElementById('time-input-value').value = entry.time;
            document.getElementById('time-input-location').value = entry.location;
        }
    } else {
        title.innerText = "Log Swim Time";
        saveBtn.innerText = "Save Entry";
        document.getElementById('time-input-date').value = new Date().toISOString().slice(0, 10);
    }
    
    modal.classList.add('active');
}

function closeLogTimeModal() {
    document.getElementById('time-modal').classList.remove('active');
}

async function deleteEntry(id) {
    if (confirm("Are you sure you want to delete this swim time log?")) {
        await deleteTime(id);
        await renderTimesTable();
    }
}

async function editEntry(id) {
    await openLogTimeModal(id);
}

// --- Main View Hook ---

export async function initTimesView() {
    const container = document.getElementById('main-viewport');
    container.innerHTML = TIMES_VIEW_HTML;
    
    // Switch sub-view clicks
    document.getElementById('btn-times-view-list').addEventListener('click', () => switchToMode('list'));
    document.getElementById('btn-times-view-grid').addEventListener('click', () => switchToMode('grid'));
    
    document.getElementById('times-log-new-btn').addEventListener('click', () => openLogTimeModal());
    
    // Grid Operations
    document.getElementById('btn-grid-add-row').addEventListener('click', () => {
        gridEntries.push({
            id: 't_new_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            date: new Date().toISOString().slice(0, 10),
            location: '',
            event: '50-free',
            course: 'SCY',
            time: ''
        });
        renderSpreadsheetGrid();
    });

    document.getElementById('btn-grid-discard').addEventListener('click', () => {
        if (confirm("Discard all grid modifications?")) {
            switchToMode('list');
        }
    });

    document.getElementById('btn-grid-save').addEventListener('click', async () => {
        // Validation check
        const timeRegex = /^(\d{1,2}:)?\d{1,2}(\.\d{1,2})?$/;
        
        for (let i = 0; i < gridEntries.length; i++) {
            const entry = gridEntries[i];
            
            if (!entry.date) {
                alert(`Row ${i+1}: Date field is required.`);
                return;
            }
            if (!entry.location.trim()) {
                alert(`Row ${i+1}: Location / Meet name is required.`);
                return;
            }
            const timeValClean = entry.time.trim().toUpperCase();
            const isDQ = timeValClean === 'DQ';
            if (isDQ) {
                entry.time = 'DQ';
            }
            if (!timeValClean || (!isDQ && !timeRegex.test(timeValClean))) {
                alert(`Row ${i+1}: Enter a valid swim time (e.g. 25.43 or 01:04.58) or "DQ".`);
                return;
            }
        }
        
        // Save
        const btnSave = document.getElementById('btn-grid-save');
        const origText = btnSave.innerHTML;
        btnSave.disabled = true;
        btnSave.innerText = "Saving changes...";
        
        await saveTimes(gridEntries);
        
        btnSave.disabled = false;
        btnSave.innerHTML = origText;
        
        alert("Spreadsheet grid changes successfully saved!");
        await switchToMode('list');
    });

    // List Filtering elements
    const searchInput = document.getElementById('filter-search');
    const strokeSelect = document.getElementById('filter-stroke');
    const courseSelect = document.getElementById('filter-course');
    
    searchInput.value = activeSearchQuery;
    strokeSelect.value = activeStrokeFilter;
    courseSelect.value = activeCourseFilter;

    searchInput.addEventListener('input', async (e) => {
        activeSearchQuery = e.target.value;
        await renderTimesTable();
    });

    strokeSelect.addEventListener('change', async (e) => {
        activeStrokeFilter = e.target.value;
        await renderTimesTable();
    });

    courseSelect.addEventListener('change', async (e) => {
        activeCourseFilter = e.target.value;
        await renderTimesTable();
    });

    // Render default List
    await switchToMode('list');

    // Hook modals
    const quickAddBtn = document.getElementById('quick-add-time-btn');
    quickAddBtn.replaceWith(quickAddBtn.cloneNode(true));
    document.getElementById('quick-add-time-btn').addEventListener('click', () => openLogTimeModal());
}

// Global modal hook (run once on application startup)
export function setupTimeModalListeners() {
    const form = document.getElementById('time-form');
    
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('time-id').value;
        const date = document.getElementById('time-input-date').value;
        const course = document.getElementById('time-input-course').value;
        const event = document.getElementById('time-input-event').value;
        const timeVal = document.getElementById('time-input-value').value;
        const location = document.getElementById('time-input-location').value;
        
        const timeValClean = timeVal.trim().toUpperCase();
        const isDQ = timeValClean === 'DQ';
        const timeRegex = /^(\d{1,2}:)?\d{1,2}(\.\d{1,2})?$/;
        if (!isDQ && !timeRegex.test(timeValClean)) {
            alert("Please enter time in a valid format (e.g. 58.23 or 01:04.58) or \"DQ\".");
            return;
        }

        const entry = { date, course, event, time: isDQ ? 'DQ' : timeVal.trim(), location };

        if (id) {
            entry.id = id;
            await updateTime(entry);
        } else {
            await addTime(entry);
        }
        
        closeLogTimeModal();
        
        if (window.location.hash === '#times') {
            await renderTimesTable();
        } else if (window.location.hash === '#dashboard' || !window.location.hash) {
            window.dispatchEvent(new Event('hashchange'));
        }
    });

    document.getElementById('close-time-modal').addEventListener('click', closeLogTimeModal);
    document.getElementById('cancel-time-btn').addEventListener('click', closeLogTimeModal);
}
