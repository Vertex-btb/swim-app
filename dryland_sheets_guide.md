# AeroSwim Google Sheets - Pool vs. Dryland Workouts Guide

Your AeroSwim web application is designed to sync workouts seamlessly to your Google Sheets without requiring any changes to your Google Apps Script backend. This guide details how the data is structured in your sheet and how you can track it.

---

## 1. Spreadsheet Structure (Workouts Tab)

AeroSwim pushes all logs to a single sheet tab named **`Workouts`**. 
Here is a sample representation of how your Google Sheet will populate:

| ID | Date | Distance | Focus | Duration | Details | Notes |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `w_172140411` | `2026-07-19 08:00` | `3500` | `Endurance` | `90` | `Warmup: 400 choice...` | `Felt steady on main set.` |
| `w_172140455` | `2026-07-19 16:30` | `0` | `Dry Land - Day 1` | `20` | `Day 1: Rowing & Strength\nCompleted Exercises:\n☑ Warm-up: 2m light rowing\n☑ Rowing Intervals (5m)\n☑ Goblet Squats\n☐ Floor Press\n☐ Plank Finisher` | `Rowing intervals felt good.` |

### How Columns Map for Dryland:
1. **Date**: Contains the combined date and time of the workout (e.g. `2026-07-19 16:30`). Google Sheets naturally parses this as a standard date-time value.
2. **Distance**: Pushed as `0` for dryland practices.
3. **Focus**: Pushed as `"Dry Land - Day 1"`, `"Dry Land - Day 2"`, or `"Dry Land - Day 3"`.
4. **Duration**: Pushed as `20` minutes (which is the standard duration of the weekly dryland workouts).
5. **Details**: Contains a bulleted checklist of which exercises you checked off in the application (using `☑` for completed and `☐` for skipped).
6. **Notes**: Contains any text comments you typed at the bottom of the logger.

---

## 2. Analyzing Data in Google Sheets

Since both pool practices and dryland workouts are stored in the same table, you can easily separate them or build statistics using simple formulas:

### A. Total Pool Distance
To sum only your pool yardage (ignoring dryland workouts), enter this formula in any cell:
```excel
=SUM(C:C)
```
*(Since Dryland distance is `0`, this naturally sums only your pool yardage).*

### B. Total Workout Counts (Pool vs. Dry Land)
To count how many **Pool** practices you logged:
```excel
=COUNTIF(D:D, "<>Dry Land*") - 1
```
*(Subtracting 1 accounts for the header row).*

To count how many **Dry Land** sessions you logged:
```excel
=COUNTIF(D:D, "Dry Land*")
```

### C. Create a Pivot Table
1. Select columns **A** through **G** on the `Workouts` sheet.
2. Go to **Insert > Pivot table**.
3. Create the Pivot Table on a new sheet.
4. Set:
   - **Rows**: `Focus`
   - **Values**: `Duration` (summarized by SUM or AVERAGE)
This will immediately show you how much training time is split between endurance swimming, sprints, recovery, and Day 1/Day 2/Day 3 dryland regimens!
