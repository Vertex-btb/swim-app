/* ==========================================================================
   AeroSwim Nutrition & Hydration Companion
   ========================================================================== */

import { getNutritionForDate, saveNutritionForDate } from './storage.js';

// --- HTML Template for Nutrition View ---

const NUTRITION_VIEW_HTML = `
<!-- Main Upper Grid -->
<div class="nutrition-grid">
    <!-- Daily Meals Logger -->
    <div class="card">
        <div class="card-header">
            <h2 class="card-title">
                <i data-lucide="apple"></i>
                <span>Daily Meal Logger</span>
            </h2>
            <div style="display: flex; align-items: center; gap: 8px;">
                <label for="nutrition-date" style="font-size: 11px; font-weight: 600; text-transform: uppercase; color: var(--text-secondary);">Date:</label>
                <input type="date" id="nutrition-date" style="padding: 6px 10px; font-size: 13px;">
            </div>
        </div>
        
        <form id="nutrition-form" style="display: flex; flex-direction: column; gap: 14px;">
            <div class="form-group" style="margin-bottom: 0;">
                <label for="diet-breakfast">Breakfast</label>
                <input type="text" id="diet-breakfast" placeholder="e.g. Oatmeal, banana, eggs">
            </div>
            
            <div class="form-group" style="margin-bottom: 0;">
                <label for="diet-lunch">Lunch</label>
                <input type="text" id="diet-lunch" placeholder="e.g. Chicken wrap, apple, salad">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
                <label for="diet-dinner">Dinner</label>
                <input type="text" id="diet-dinner" placeholder="e.g. Salmon, sweet potato, broccoli">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
                <label for="diet-snacks">Snacks & Supplements</label>
                <input type="text" id="diet-snacks" placeholder="e.g. Protein shake, energy bar">
            </div>

            <div class="form-group" style="margin-bottom: 0;">
                <label for="diet-calories">Estimated Calories (kcal)</label>
                <input type="number" id="diet-calories" placeholder="e.g. 2800" min="0">
            </div>

            <button type="submit" class="btn btn-primary" style="margin-top: 10px; width: 100%;">
                <i data-lucide="check-circle-2"></i>
                <span>Save Daily Diet Log</span>
            </button>
        </form>
    </div>

    <!-- Hydration Tracker & Tips -->
    <div style="display: flex; flex-direction: column; gap: 24px;">
        <!-- Water counter -->
        <div class="card text-center" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 220px;">
            <div class="card-header" style="width: 100%; justify-content: center; margin-bottom: 8px;">
                <h3 class="card-title" style="font-size: 16px;">
                    <i data-lucide="droplet" style="color: var(--accent-cyan);"></i>
                    <span>Hydration Tracker</span>
                </h3>
            </div>
            <p style="font-size: 13px; color: var(--text-secondary);">Click a cup to log water intake (8 oz / 250ml per cup)</p>
            
            <!-- Cup Indicators -->
            <div class="water-cups-row" id="hydration-cups-container">
                <!-- SVG cups loaded dynamically -->
            </div>

            <div style="font-size: 18px; font-weight: 700; color: var(--text-primary); font-family: 'Outfit', sans-serif;" id="hydration-count-text">
                0 / 8 Cups
            </div>
            <p style="font-size: 11px; color: var(--accent-green); margin-top: 4px; font-weight: 600; display: none;" id="hydration-goal-msg">
                🎉 Daily Hydration Target Reached!
            </p>
        </div>

        <!-- Pre-Race Guidelines -->
        <div class="card">
            <div class="card-header" style="margin-bottom: 12px;">
                <h3 class="card-title" style="font-size: 16px;">
                    <i data-lucide="sparkles" style="color: var(--accent-gold);"></i>
                    <span>Pre-Meet Diet Guidelines</span>
                </h3>
            </div>
            <div class="premeet-tips">
                <div class="tip-item">
                    <h5>24 Hours Prior</h5>
                    <p style="color: var(--text-secondary); line-height: 1.4;">Focus on complex carbs (pasta, brown rice, oatmeal) to top off glycogen stores. Keep hydration high and avoid greasy or spicy foods.</p>
                </div>
                <div class="tip-item">
                    <h5>2-3 Hours Before</h5>
                    <p style="color: var(--text-secondary); line-height: 1.4;">Eat a light, easily digestible carb meal (e.g. banana with toast, oatmeal, yogurt). Avoid heavy fiber or excessive fat which slows digestions.</p>
                </div>
                <div class="tip-item">
                    <h5>During the Meet</h5>
                    <p style="color: var(--text-secondary); line-height: 1.4;">Sip water/electrolytes. Nibble on quick carb snacks between races: orange slices, grapes, honey packets, or fig bars.</p>
                </div>
            </div>
        </div>
    </div>
</div>
`;

let currentSelectedDate = '';

/**
 * Loads values for selected date and renders input fields and cups
 */
function loadNutritionDataForSelectedDate() {
    const dayData = getNutritionForDate(currentSelectedDate);
    
    // Fill Meal Inputs
    document.getElementById('diet-breakfast').value = dayData.meals.breakfast || '';
    document.getElementById('diet-lunch').value = dayData.meals.lunch || '';
    document.getElementById('diet-dinner').value = dayData.meals.dinner || '';
    document.getElementById('diet-snacks').value = dayData.meals.snacks || '';
    document.getElementById('diet-calories').value = dayData.calories || '';

    // Render Hydration UI
    renderHydrationCups(dayData.waterCups || 0);
}

/**
 * Renders 8 cups using Lucide or inline SVGs and wires click event listeners
 */
function renderHydrationCups(count) {
    const container = document.getElementById('hydration-cups-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Draw 8 cups
    for (let i = 0; i < 8; i++) {
        const isFilled = i < count;
        
        const cup = document.createElement('div');
        cup.className = `cup-icon ${isFilled ? 'filled' : ''}`;
        cup.setAttribute('data-idx', i);
        cup.style.cursor = 'pointer';
        
        // Custom cup SVG structure
        cup.innerHTML = `
            <svg width="28" height="36" viewBox="0 0 24 24" fill="${isFilled ? 'var(--accent-cyan)' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-glass-water">
                <path d="M15.2 22H8.8a2 2 0 0 1-2-1.79L5 3h14l-1.81 17.21A2 2 0 0 1 15.2 22Z"/>
                <path d="M6 12a5 5 0 0 1 6 0 5 5 0 0 0 6 0"/>
            </svg>
        `;
        
        // Click to toggle hydration state
        cup.addEventListener('click', () => {
            const idx = parseInt(cup.getAttribute('data-idx'));
            let newCount = idx + 1;
            
            // If they click on the currently active top cup, decrease by 1 (toggle logic)
            if (newCount === count) {
                newCount = count - 1;
            }
            
            updateHydrationCount(newCount);
        });

        container.appendChild(cup);
    }
    
    // Update labels
    document.getElementById('hydration-count-text').innerText = `${count} / 8 Cups`;
    
    const goalMsg = document.getElementById('hydration-goal-msg');
    if (count >= 8) {
        goalMsg.style.display = 'block';
    } else {
        goalMsg.style.display = 'none';
    }
}

/**
 * Saves water cup counts for active date
 */
function updateHydrationCount(newCount) {
    const dayData = getNutritionForDate(currentSelectedDate);
    dayData.waterCups = newCount;
    
    saveNutritionForDate(currentSelectedDate, dayData);
    renderHydrationCups(newCount);
}

// --- Main View Hook ---

export function initNutritionView() {
    const container = document.getElementById('main-viewport');
    container.innerHTML = NUTRITION_VIEW_HTML;
    
    // Default to current local date
    const dateInput = document.getElementById('nutrition-date');
    currentSelectedDate = new Date().toISOString().slice(0, 10);
    dateInput.value = currentSelectedDate;
    
    // Switch date listener
    dateInput.addEventListener('change', (e) => {
        currentSelectedDate = e.target.value;
        loadNutritionDataForSelectedDate();
    });

    // Form save listener
    const form = document.getElementById('nutrition-form');
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        
        const breakfast = document.getElementById('diet-breakfast').value.trim();
        const lunch = document.getElementById('diet-lunch').value.trim();
        const dinner = document.getElementById('diet-dinner').value.trim();
        const snacks = document.getElementById('diet-snacks').value.trim();
        const calories = parseInt(document.getElementById('diet-calories').value) || 0;
        
        const dayData = getNutritionForDate(currentSelectedDate);
        dayData.meals = { breakfast, lunch, dinner, snacks };
        dayData.calories = calories;
        
        saveNutritionForDate(currentSelectedDate, dayData);
        alert("Daily diet log successfully saved!");
    });

    // Load initial values
    loadNutritionDataForSelectedDate();
    
    lucide.createIcons();
}
