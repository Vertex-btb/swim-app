/* ==========================================================================
   AeroSwim Data Import/Export View & Core Parser
   ========================================================================== */

import { getTimes, saveTimes, exportFullData, importFullData } from './storage.js';

// --- HTML Template for Data Manager View ---

const DATA_MANAGER_HTML = `
<div class="card">
    <div class="card-header">
        <h2 class="card-title">
            <i data-lucide="sheet"></i>
            <span>Google Sheets CSV & Copy-Paste Importer</span>
        </h2>
    </div>
    <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
        Import your swim times directly from your spreadsheet. You can either download your Google Sheet as a <strong>CSV</strong> and upload it, or simply <strong>copy-paste</strong> the cells directly from your browser!
    </p>

    <!-- Drag & Drop Zone -->
    <div class="import-zone" id="csv-drag-zone">
        <i data-lucide="upload-cloud"></i>
        <div>
            <p style="font-weight: 600; margin-bottom: 6px;">Drag and drop your exported CSV here</p>
            <p style="font-size: 12px; color: var(--text-muted);">or click to browse local files</p>
        </div>
        <input type="file" id="csv-file-input" accept=".csv,text/csv" style="display: none;">
    </div>

    <!-- Manual Paste Area -->
    <div style="margin-top: 24px;">
        <label style="display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">
            Or Paste Cells Directly (Including Header Row)
        </label>
        <textarea class="paste-textarea" id="csv-paste-area" placeholder="Date&#9;Location&#9;Event&#9;Course&#9;Time&#10;2026-07-11&#9;Community Pool&#9;50-free&#9;SCY&#9;24.89&#10;2026-07-11&#9;Community Pool&#9;100-back&#9;SCY&#9;01:00.82"></textarea>
        <button class="btn btn-primary" id="btn-paste-import" style="margin-top: 12px;">
            <i data-lucide="clipboard-check"></i>
            <span>Parse & Import Pasted Data</span>
        </button>
    </div>

    <!-- Instructions Summary -->
    <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid var(--glass-border);">
        <h4 style="margin-bottom: 12px; font-size: 14px; color: var(--text-primary);">Required Column Headers:</h4>
        <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.6;">
            Make sure your spreadsheet includes a header row with these exact column names:
            <br>
            <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: var(--accent-cyan);">Date</code>, 
            <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: var(--accent-cyan);">Location</code>, 
            <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: var(--accent-cyan);">Event</code>, 
            <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: var(--accent-cyan);">Course</code>, and 
            <code style="background: rgba(255,255,255,0.06); padding: 2px 6px; border-radius: 4px; color: var(--accent-cyan);">Time</code>.
        </p>
    </div>
</div>

<div class="card" style="margin-top: 32px;">
    <div class="card-header">
        <h2 class="card-title">
            <i data-lucide="shield-alert"></i>
            <span>Full Backup & Restore</span>
        </h2>
    </div>
    <p style="color: var(--text-secondary); margin-bottom: 20px; font-size: 14px; line-height: 1.6;">
        Export all database records (profiles, swim times, workouts, and nutrition logs) to a single JSON file. You can restore your data on any device using the backup file.
    </p>
    
    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
        <button class="btn btn-secondary" id="btn-export-backup">
            <i data-lucide="download"></i>
            <span>Download Backup (.json)</span>
        </button>
        <button class="btn btn-secondary" id="btn-trigger-restore">
            <i data-lucide="upload"></i>
            <span>Restore Backup file</span>
        </button>
        <input type="file" id="backup-file-input" accept=".json" style="display: none;">
    </div>
</div>
`;

// --- Core Parser Logic ---

/**
 * Standardizes event strings (e.g. "50 free", "50 backstroke" -> "50-free", "50-back")
 */
function normalizeEvent(eventStr) {
    if (!eventStr) return '';
    let event = eventStr.toLowerCase().trim()
        .replace(/\s+/g, '-')       // Replace spaces with hyphens
        .replace(/stroke/g, '')     // Strip "stroke"
        .replace(/style/g, '')      // Strip "yle" from freestyle
        .replace(/fly/g, 'fly')
        .replace(/breast/g, 'breast')
        .replace(/back/g, 'back')
        .replace(/free/g, 'free')
        .replace(/im/g, 'IM')
        .replace(/-+/g, '-');       // Collapse duplicates
    
    // Correct case for IM
    if (event.endsWith('-im')) event = event.replace('-im', '-IM');
    if (event === 'im') event = 'IM';
    return event;
}

/**
 * Converts dates to standard YYYY-MM-DD
 */
function normalizeDate(dateStr) {
    if (!dateStr) return '';
    const trimmed = dateStr.trim();
    
    // Check if ISO format YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return trimmed;
    }
    
    // Handle MM/DD/YYYY or M/D/YYYY
    const slashParts = trimmed.split('/');
    if (slashParts.length === 3) {
        let m = slashParts[0].padStart(2, '0');
        let d = slashParts[1].padStart(2, '0');
        let y = slashParts[2];
        if (y.length === 2) y = '20' + y; // Assume 20xx
        return `${y}-${m}-${d}`;
    }

    // Handle DD-MM-YYYY
    const dashParts = trimmed.split('-');
    if (dashParts.length === 3 && dashParts[0].length <= 2) {
        let d = dashParts[0].padStart(2, '0');
        let m = dashParts[1].padStart(2, '0');
        let y = dashParts[2];
        if (y.length === 2) y = '20' + y;
        return `${y}-${m}-${d}`;
    }
    
    return trimmed; // fallback
}

/**
 * Parses full CSV or TSV string into structured JSON array
 */
function parseSpreadsheetText(text) {
    if (!text || !text.trim()) return [];
    
    // Check if it's the 8-line USA Swimming grid vertical copy-paste format
    const trimmedLines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
    if (trimmedLines.length >= 16) {
        const first8 = trimmedLines.slice(0, 8).map(h => h.toLowerCase());
        if (first8.includes('event') && first8.includes('time') && first8.includes('date') && first8.includes('meet')) {
            const headers = first8;
            const eventIdx = headers.indexOf('event');
            const timeIdx = headers.indexOf('time');
            const dateIdx = headers.indexOf('date');
            const meetIdx = headers.indexOf('meet');
            
            const results = [];
            const dataLines = trimmedLines.slice(8);
            for (let i = 0; i < dataLines.length; i += 8) {
                if (i + 7 >= dataLines.length) break;
                
                const chunk = dataLines.slice(i, i + 8);
                const rawEvent = chunk[eventIdx];
                const rawTime = chunk[timeIdx];
                const rawDate = chunk[dateIdx];
                const rawLoc = chunk[meetIdx];
                
                if (!rawEvent || !rawTime || !rawDate) continue;
                
                let eventCode = '';
                let courseCode = 'SCY';
                
                const parts = rawEvent.split(/\s+/);
                if (parts.length >= 3) {
                    const dist = parts[0];
                    const strokeAbbr = parts[1].toLowerCase();
                    courseCode = parts[2].toUpperCase();
                    
                    const strokeMap = {
                        "fr": "free",
                        "bk": "back",
                        "br": "breast",
                        "fl": "fly",
                        "im": "IM"
                    };
                    const mappedStroke = strokeMap[strokeAbbr] || strokeAbbr;
                    eventCode = dist + "-" + mappedStroke;
                } else {
                    eventCode = normalizeEvent(rawEvent);
                }
                
                let cleanTime = rawTime.replace(/[rR]$/, '');
                
                results.push({
                    date: normalizeDate(rawDate),
                    location: rawLoc || 'USA Swimming Meet',
                    event: eventCode,
                    course: courseCode,
                    time: cleanTime
                });
            }
            return results;
        }
    }
    
    // Determine delimiter: comma or tab
    const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
    if (lines.length < 2) return [];
    
    const firstLine = lines[0];
    const isTab = firstLine.includes('\t');
    const delimiter = isTab ? '\t' : ',';
    
    // Extract headers
    const rawHeaders = firstLine.split(delimiter).map(h => h.trim().toLowerCase());
    
    // Find index of required columns
    const dateIdx = rawHeaders.indexOf('date');
    const locationIdx = rawHeaders.indexOf('location');
    const eventIdx = rawHeaders.indexOf('event');
    const courseIdx = rawHeaders.indexOf('course');
    const timeIdx = rawHeaders.indexOf('time');
    
    if (dateIdx === -1 || eventIdx === -1 || timeIdx === -1) {
        alert("Error: Data must contain at least 'Date', 'Event', and 'Time' columns.");
        return [];
    }
    
    const results = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        
        // Handle CSV quote escapes or simple splitting
        let fields = [];
        if (delimiter === '\t') {
            fields = line.split('\t');
        } else {
            // Simple comma split but support basic quotes if there are commas in meet names
            fields = parseCSVLine(line);
        }
        
        if (fields.length <= Math.max(dateIdx, eventIdx, timeIdx)) continue;
        
        const rawDate = fields[dateIdx];
        const rawLoc = locationIdx !== -1 ? fields[locationIdx] : 'Unknown Meet';
        const rawEvent = fields[eventIdx];
        const rawCourse = courseIdx !== -1 ? fields[courseIdx] : 'SCY';
        const rawTime = fields[timeIdx];
        
        if (!rawDate || !rawEvent || !rawTime) continue;
        
        results.push({
            date: normalizeDate(rawDate),
            location: rawLoc.trim() || 'Unknown Meet',
            event: normalizeEvent(rawEvent),
            course: (rawCourse.trim().toUpperCase()) || 'SCY',
            time: rawTime.trim()
        });
    }
    
    return results;
}

/**
 * Helper to split a line by commas, respecting double quotes
 */
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        if (char === '"') {
            inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current.trim());
    return result;
}

/**
 * Imports list of parsed swim times and handles deduplication
 */
async function importParsedTimes(parsedEntries) {
    if (parsedEntries.length === 0) return 0;
    
    const existingTimes = await getTimes();
    let importCount = 0;
    
    parsedEntries.forEach(entry => {
        // Prevent duplicate logs: check if same Date, Event, Course, and Time already exists
        const isDuplicate = existingTimes.some(t => 
            t.date === entry.date && 
            t.event === entry.event && 
            t.course === entry.course && 
            t.time === entry.time
        );
        
        if (!isDuplicate) {
            entry.id = 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
            existingTimes.push(entry);
            importCount++;
        }
    });
    
    if (importCount > 0) {
        await saveTimes(existingTimes);
    }
    
    return importCount;
}

export function initDataManagerView() {
    const container = document.getElementById('main-viewport');
    container.innerHTML = DATA_MANAGER_HTML;
    
    
    const dragZone = document.getElementById('csv-drag-zone');
    const fileInput = document.getElementById('csv-file-input');
    const pasteArea = document.getElementById('csv-paste-area');
    const btnPasteImport = document.getElementById('btn-paste-import');
    
    const btnExport = document.getElementById('btn-export-backup');
    const btnRestoreTrigger = document.getElementById('btn-trigger-restore');
    const restoreFileInput = document.getElementById('backup-file-input');

    // Drag-and-Drop Handlers
    dragZone.addEventListener('click', () => fileInput.click());
    
    dragZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dragZone.classList.add('dragover');
    });
    
    dragZone.addEventListener('dragleave', () => {
        dragZone.classList.remove('dragover');
    });
    
    dragZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dragZone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) handleFileImport(file);
    });
    
    fileInput.addEventListener('change', () => {
        const file = fileInput.files[0];
        if (file) handleFileImport(file);
    });

    // Clipboard Paste Handler
    btnPasteImport.addEventListener('click', async () => {
        const rawText = pasteArea.value;
        if (!rawText.trim()) {
            alert("Please paste some data first.");
            return;
        }
        
        const parsed = parseSpreadsheetText(rawText);
        if (parsed.length === 0) return;
        
        const count = await importParsedTimes(parsed);
        alert(`Successfully imported ${count} new swim times out of ${parsed.length} parsed records!`);
        pasteArea.value = '';
    });

    // Backup Export Handlers
    btnExport.addEventListener('click', () => {
        const dataStr = exportFullData();
        const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
        
        const exportFileDefaultName = 'aeroswim_backup_' + new Date().toISOString().slice(0,10) + '.json';
        
        const linkElement = document.createElement('a');
        linkElement.setAttribute('href', dataUri);
        linkElement.setAttribute('download', exportFileDefaultName);
        linkElement.click();
    });

    // Restore Backup Handlers
    btnRestoreTrigger.addEventListener('click', () => restoreFileInput.click());
    
    restoreFileInput.addEventListener('change', () => {
        const file = restoreFileInput.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (e) => {
            const result = importFullData(e.target.result);
            if (result.success) {
                alert("Database successfully restored from backup!");
                window.location.hash = "#dashboard"; // Direct to dashboard
            } else {
                alert("Failed to restore backup: " + result.error);
            }
        };
        reader.readAsText(file);
    });

    // Load Lucide Icons
    lucide.createIcons();
}

/**
 * Reads local CSV file and imports it
 */
function handleFileImport(file) {
    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const parsed = parseSpreadsheetText(text);
        if (parsed.length === 0) return;
        
        const count = await importParsedTimes(parsed);
        alert(`Successfully imported ${count} new swim times out of ${parsed.length} parsed records!`);
    };
    reader.readAsText(file);
}
