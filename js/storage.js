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

// Default seeds
const DEFAULT_PROFILE = { name: "Leo", age: 14, gender: "Boys", team: "Aero Swim Club", sheetsUrl: "", sheetsKey: "" };

const DEFAULT_TIMES = [
    { id: 't1', date: '2026-05-10', location: 'YMCA Aquatic Center', event: '50-free', course: 'SCY', time: '25.98' },
    { id: 't2', date: '2026-05-10', location: 'YMCA Aquatic Center', event: '100-back', course: 'SCY', time: '01:04.22' },
    { id: 't3', date: '2026-05-11', location: 'YMCA Aquatic Center', event: '50-back', course: 'SCY', time: '29.80' },
    { id: 't4', date: '2026-06-14', location: 'EAC Swim Complex', event: '50-free', course: 'LCM', time: '29.12' },
    { id: 't5', date: '2026-06-14', location: 'EAC Swim Complex', event: '100-back', course: 'LCM', time: '01:11.80' },
    { id: 't6', date: '2026-06-15', location: 'EAC Swim Complex', event: '50-fly', course: 'LCM', time: '31.45' },
    { id: 't7', date: '2026-07-04', location: 'Community Pool', event: '50-free', course: 'SCY', time: '24.95' },
    { id: 't8', date: '2026-07-04', location: 'Community Pool', event: '100-back', course: 'SCY', time: '01:01.89' },
    { id: 't9', date: '2026-07-05', location: 'Community Pool', event: '50-back', course: 'SCY', time: '28.14' },
    { id: 't10', date: '2026-07-05', location: 'Community Pool', event: '100-IM', course: 'SCY', time: '01:03.12' }
];

const DEFAULT_WORKOUTS = [
    { id: 'w1', date: '2026-07-15', distance: 3800, focus: 'Endurance', duration: 90, details: 'Warmup:\n400 Choice, 4x100 IM Drill on 1:45\n\nMain Set:\n3x (4x100 Free on 1:25, 200 Pull active recovery on 3:00)\n\nCooldown:\n200 Choice Easy', notes: 'Felt highly aerobic today. Maintained a steady pace on the 100s.' },
    { id: 'w2', date: '2026-07-16', distance: 3000, focus: 'Sprint', duration: 75, details: 'Warmup:\n300 choice, 6x50 Kick on 1:10\n\nMain Set:\n12x50 Free/Fly Sprint on 1:15 (Max Effort!)\n8x25 Start & Turn work\n\nCooldown:\n200 easy back', notes: 'Coach said reaction time off the block was much better. Target fly finish was solid.' },
    { id: 'w3', date: '2026-07-17', distance: 3500, focus: 'Technique', duration: 90, details: 'Warmup:\n500 Choice\n\nMain Set:\n10x100 Back/Breast Stroke count drill on 1:45\n8x50 Underwaters (no breath past 15m)\n\nCooldown:\n300 choice', notes: 'Focused on tight streamline off the walls. Streamline should stay under 5m minimum.' }
];

const DEFAULT_NUTRITION = {
    history: {
        '2026-07-17': { waterCups: 6, meals: { breakfast: "Oatmeal with sliced bananas, blueberries, and honey", lunch: "Turkey and swiss wrap, baby carrots, apple slices", dinner: "Grilled chicken breast, brown rice, steamed broccoli", snacks: "Greek yogurt with granola, pre-workout protein shake" }, calories: 2600 },
        '2026-07-18': { waterCups: 8, meals: { breakfast: "Scrambled eggs, whole wheat toast, orange juice", lunch: "Quinoa salad with mixed vegetables and grilled salmon", dinner: "Whole grain pasta with marinara sauce, lean beef meatballs, mixed greens", snacks: "Mixed nuts, fruit smoothie, pre-workout amino energy" }, calories: 2900 }
    }
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
        cachedDb = null; // Clear remote cache
        return;
    }
    
    if (isSyncing && !force) return;
    isSyncing = true;
    
    try {
        console.log("Syncing from Google Sheets in background...");
        
        const delimiter = profile.sheetsUrl.includes('?') ? '&' : '?';
        const syncUrl = `${profile.sheetsUrl}${delimiter}key=${encodeURIComponent(profile.sheetsKey || '')}`;
        
        const response = await fetch(syncUrl);
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
        
    } catch (err) {
        console.error("Sheets sync failed: ", err);
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
