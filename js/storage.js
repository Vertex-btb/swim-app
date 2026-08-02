/* ==========================================================================
   AeroSwim Storage & Async Google Sheets Sync Layer (Optimistic Updates)
   ========================================================================== */

// --- Time Conversion Helpers ---

export function timeStringToSeconds(timeStr) {
    if (!timeStr) return 0;
    const cleanStr = timeStr.trim().toUpperCase();
    if (cleanStr === 'DQ') return Infinity;
    if (cleanStr.includes(':')) {
        const parts = cleanStr.split(':');
        const minutes = parseFloat(parts[0]) || 0;
        const seconds = parseFloat(parts[1]) || 0;
        return (minutes * 60) + seconds;
    } else {
        return parseFloat(cleanStr) || 0;
    }
}

export function secondsToTimeString(seconds) {
    if (isNaN(seconds) || seconds <= 0 || seconds === Infinity) return "--:--.--";
    const minutes = Math.floor(seconds / 60);
    const remainingSecs = (seconds % 60).toFixed(2);
    if (minutes > 0) {
        const paddedSecs = remainingSecs.indexOf('.') === 1 ? '0' + remainingSecs : remainingSecs;
        return `${minutes}:${paddedSecs}`;
    } else {
        return remainingSecs;
    }
}

export function safeFormatDate(dateStr, options) {
    if (!dateStr) return 'No Date';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return 'Invalid Date';
    return d.toLocaleDateString(undefined, options || { month: 'short', day: 'numeric', year: 'numeric' });
}

// --- Local & Remote Sync States ---

const KEYS = {
    PROFILE: 'aeroswim_profile',
    TIMES: 'aeroswim_times',
    WORKOUTS: 'aeroswim_workouts',
    NUTRITION: 'aeroswim_nutrition'
};

// Default seeds (Clean Empty Slate for New Users)
const DEFAULT_PROFILE = { name: "Swimmer Name", age: 14, gender: "Boys", team: "Unattached", sheetsUrl: "", sheetsKey: "" };

const DEFAULT_TIMES = [];

const DEFAULT_WORKOUTS = [];

const DEFAULT_NUTRITION = {
    history: {}
};

let cachedDb = null;
let isSyncing = false;

export function initializeStorage() {
    if (!localStorage.getItem(KEYS.PROFILE)) localStorage.setItem(KEYS.PROFILE, JSON.stringify(DEFAULT_PROFILE));
    if (!localStorage.getItem(KEYS.TIMES)) localStorage.setItem(KEYS.TIMES, JSON.stringify(DEFAULT_TIMES));
    if (!localStorage.getItem(KEYS.WORKOUTS)) localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(DEFAULT_WORKOUTS));
    if (!localStorage.getItem(KEYS.NUTRITION)) localStorage.setItem(KEYS.NUTRITION, JSON.stringify(DEFAULT_NUTRITION));
}

// --- Sync Controller ---

/**
 * Downloads data from Google Sheets API, authenticated with URL key (Runs in background)
 */
export async function syncFromSheets(force = false) {
    const profile = getProfile();
    if (!profile.sheetsUrl) {
        cachedDb = null;
        return { success: false, error: 'No Sync URL provided' };
    }
    
    if (isSyncing && !force) return { success: false, error: 'Sync already in progress' };
    isSyncing = true;
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8-second max timeout
    
    try {
        console.log("Syncing from Google Sheets in background...");
        
        const delimiter = profile.sheetsUrl.includes('?') ? '&' : '?';
        const syncUrl = `${profile.sheetsUrl}${delimiter}key=${encodeURIComponent(profile.sheetsKey || '')}`;
        
        const response = await fetch(syncUrl, {
            method: 'GET',
            redirect: 'follow',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        // Save to cache
        cachedDb = data;
        
        // Save local copy
        if (data.profile) localStorage.setItem(KEYS.PROFILE, JSON.stringify({ ...profile, ...data.profile }));
        if (data.times) localStorage.setItem(KEYS.TIMES, JSON.stringify(data.times));
        if (data.workouts) localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(data.workouts));
        if (data.nutrition) localStorage.setItem(KEYS.NUTRITION, JSON.stringify(data.nutrition));
        
        console.log("Background sync complete!");
        
        // Notify UI to refresh data silently
        window.dispatchEvent(new Event('profileChanged'));
        window.dispatchEvent(new Event('timesChanged'));
        window.dispatchEvent(new Event('workoutsChanged'));
        window.dispatchEvent(new Event('nutritionChanged'));
        
        return {
            success: true,
            timesCount: (data.times || []).length,
            workoutsCount: (data.workouts || []).length
        };
        
    } catch (err) {
        clearTimeout(timeoutId);
        const errMsg = err.name === 'AbortError' ? 'Sync timed out (Google Sheets did not respond in 8 seconds)' : err.message;
        console.error("Sheets sync failed: ", errMsg);
        return { success: false, error: errMsg };
    } finally {
        isSyncing = false;
    }
}

/**
 * Dispatches POST request to Apps Script silently in the background (Non-blocking)
 */
function postToSheets(action, payloadData) {
    const profile = getProfile();
    if (!profile.sheetsUrl) return;
    
    // Fire-and-forget: browser will run this request in the background
    fetch(profile.sheetsUrl, {
        method: 'POST',
        redirect: 'follow',
        body: JSON.stringify({
            action: action,
            key: profile.sheetsKey || '',
            data: payloadData
        })
    })
    .then(response => response.json())
    .then(resJson => {
        if (!resJson.success) {
            console.error("Background write error:", resJson.error);
        } else {
            console.log(`Background write successful: ${action}`);
        }
    })
    .catch(e => {
        console.error("Background write failed: ", e);
    });
}

// --- CRUD Swimmer Profile ---

export function getProfile() {
    return JSON.parse(localStorage.getItem(KEYS.PROFILE)) || DEFAULT_PROFILE;
}

export async function saveProfile(profile) {
    // 1. Update local cache immediately
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
    window.dispatchEvent(new Event('profileChanged'));
    
    // 2. Dispatch background push (do not await)
    if (profile.sheetsUrl) {
        postToSheets("saveProfile", profile);
    }
}

// --- CRUD Swim Times ---

export async function getTimes() {
    let times = [];
    if (cachedDb && cachedDb.times) {
        times = cachedDb.times;
    } else {
        times = JSON.parse(localStorage.getItem(KEYS.TIMES)) || [];
    }
    return times.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function saveTimes(times) {
    // 1. Update local cache immediately
    localStorage.setItem(KEYS.TIMES, JSON.stringify(times));
    if (cachedDb) cachedDb.times = times;
    window.dispatchEvent(new Event('timesChanged'));
    
    // 2. Dispatch background push (do not await)
    const profile = getProfile();
    if (profile.sheetsUrl) {
        postToSheets("saveAllTimes", times);
    }
}

export async function addTime(entry) {
    if (!entry.id) {
        entry.id = 't_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    }
    
    // 1. Update local cache immediately
    const times = await getTimes();
    times.push(entry);
    localStorage.setItem(KEYS.TIMES, JSON.stringify(times));
    if (cachedDb) cachedDb.times = times;
    window.dispatchEvent(new Event('timesChanged'));
    
    // 2. Dispatch background push (do not await)
    const profile = getProfile();
    if (profile.sheetsUrl) {
        postToSheets("addTime", entry);
    }
    return entry;
}

export async function updateTime(entry) {
    // 1. Update local cache immediately
    const times = await getTimes();
    const idx = times.findIndex(t => t.id === entry.id);
    if (idx !== -1) {
        times[idx] = entry;
        localStorage.setItem(KEYS.TIMES, JSON.stringify(times));
        if (cachedDb) cachedDb.times = times;
        window.dispatchEvent(new Event('timesChanged'));
        
        // 2. Dispatch background push (do not await)
        const profile = getProfile();
        if (profile.sheetsUrl) {
            postToSheets("updateTime", entry);
        }
    }
}

export async function deleteTime(id) {
    // 1. Update local cache immediately
    let times = await getTimes();
    times = times.filter(t => t.id !== id);
    localStorage.setItem(KEYS.TIMES, JSON.stringify(times));
    if (cachedDb) cachedDb.times = times;
    window.dispatchEvent(new Event('timesChanged'));
    
    // 2. Dispatch background push (do not await)
    const profile = getProfile();
    if (profile.sheetsUrl) {
        fetch(profile.sheetsUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteTime', key: profile.sheetsKey || '', id: id })
        })
        .catch(err => console.error("Background deleteTime failed: ", err));
    }
}

// --- CRUD Workouts ---

export async function getWorkouts() {
    let workouts = [];
    if (cachedDb && cachedDb.workouts) {
        workouts = cachedDb.workouts;
    } else {
        workouts = JSON.parse(localStorage.getItem(KEYS.WORKOUTS)) || [];
    }
    return workouts.sort((a, b) => new Date(b.date) - new Date(a.date));
}

export async function addWorkout(entry) {
    entry.id = 'w_' + Date.now();
    
    // 1. Update local cache immediately
    const workouts = await getWorkouts();
    workouts.push(entry);
    localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
    if (cachedDb) cachedDb.workouts = workouts;
    window.dispatchEvent(new Event('workoutsChanged'));
    
    // 2. Dispatch background push (do not await)
    const profile = getProfile();
    if (profile.sheetsUrl) {
        postToSheets("addWorkout", entry);
    }
    return entry;
}

export async function deleteWorkout(id) {
    // 1. Update local cache immediately
    let workouts = await getWorkouts();
    workouts = workouts.filter(w => w.id !== id);
    localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(workouts));
    if (cachedDb) cachedDb.workouts = workouts;
    window.dispatchEvent(new Event('workoutsChanged'));
    
    // 2. Dispatch background push (do not await)
    const profile = getProfile();
    if (profile.sheetsUrl) {
        fetch(profile.sheetsUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'deleteWorkout', key: profile.sheetsKey || '', id: id })
        })
        .catch(err => console.error("Background deleteWorkout failed: ", err));
    }
}

// --- CRUD Nutrition ---

export function getNutritionData() {
    if (cachedDb && cachedDb.nutrition) {
        return cachedDb.nutrition;
    }
    return JSON.parse(localStorage.getItem(KEYS.NUTRITION)) || DEFAULT_NUTRITION;
}

export function getNutritionForDate(dateStr) {
    const data = getNutritionData();
    if (!data.history) data.history = {};
    if (!data.history[dateStr]) {
        return {
            waterCups: 0,
            meals: { breakfast: "", lunch: "", dinner: "", snacks: "" },
            calories: 0
        };
    }
    return data.history[dateStr];
}

export async function saveNutritionForDate(dateStr, dayData) {
    // 1. Update local cache immediately
    const data = getNutritionData();
    if (!data.history) data.history = {};
    data.history[dateStr] = dayData;
    localStorage.setItem(KEYS.NUTRITION, JSON.stringify(data));
    if (cachedDb) cachedDb.nutrition = data;
    window.dispatchEvent(new Event('nutritionChanged'));
    
    // 2. Dispatch background push (do not await)
    const profile = getProfile();
    if (profile.sheetsUrl) {
        fetch(profile.sheetsUrl, {
            method: 'POST',
            body: JSON.stringify({ action: 'saveNutrition', key: profile.sheetsKey || '', date: dateStr, data: dayData })
        })
        .catch(err => console.error("Background saveNutrition failed: ", err));
    }
}

// --- Import/Export backups ---

export function importFullData(jsonData) {
    try {
        const parsed = JSON.parse(jsonData);
        if (parsed.profile) localStorage.setItem(KEYS.PROFILE, JSON.stringify(parsed.profile));
        if (parsed.times) localStorage.setItem(KEYS.TIMES, JSON.stringify(parsed.times));
        if (parsed.workouts) localStorage.setItem(KEYS.WORKOUTS, JSON.stringify(parsed.workouts));
        if (parsed.nutrition) localStorage.setItem(KEYS.NUTRITION, JSON.stringify(parsed.nutrition));
        
        window.dispatchEvent(new Event('profileChanged'));
        window.dispatchEvent(new Event('timesChanged'));
        window.dispatchEvent(new Event('workoutsChanged'));
        window.dispatchEvent(new Event('nutritionChanged'));
        return { success: true };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

export async function exportFullData() {
    const data = {
        profile: getProfile(),
        times: await getTimes(),
        workouts: await getWorkouts(),
        nutrition: getNutritionData()
    };
    return JSON.stringify(data, null, 2);
}

export async function importFromUsaSwimming(usasId) {
    const profile = getProfile();
    if (!profile.sheetsUrl) {
        alert("Please connect a Google Sheets Sync URL in your Swimmer Profile settings first. We need Google Sheets to execute this request safely bypassing browser CORS blocks.");
        return false;
    }
    
    try {
        const response = await fetch(profile.sheetsUrl, {
            method: 'POST',
            redirect: 'follow',
            body: JSON.stringify({
                action: 'importUsaSwimmingTimes',
                key: profile.sheetsKey || '',
                data: { usasId: usasId }
            })
        });
        const resJson = await response.json();
        if (resJson.success) {
            // Force download the newly updated sheet
            await syncFromSheets(true);
            return true;
        }
        throw new Error(resJson.error || "Unknown error during USA Swimming import");
    } catch (e) {
        console.error("USA Swimming import failed: ", e);
        alert("Import failed: " + e.message);
        return false;
    }
}
