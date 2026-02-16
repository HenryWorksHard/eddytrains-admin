# Schedule System Fix Plan

## Current Issues Identified

### 1. Stray Completion Record
- **Problem**: Feb 16 has a completion record that shouldn't exist
- **Evidence**: `completionsByDate` shows `2026-02-16: "4113fa49..."` 
- **Fix**: Delete via SQL, then investigate HOW it got created

### 2. Rest Days Showing as Yellow (Upcoming)
- **Problem**: Louis says there are only 4 workouts this week, but all 7 days show yellow
- **Possible Causes**:
  - A) Program data has 7 workouts when it should have 4
  - B) Week calculation showing week 1 instead of week 2
  - C) Fallback logic pulling week 1 data for empty week 2 days

### 3. Week Display Inconsistency
- **Problem**: "THIS WEEK" shows 7 workout names (Anterior, Volleyba, Posterio, etc.)
- **Evidence**: From screenshot, every day has a workout name truncated

---

## Data Flow Analysis

### Database Schema
```
programs
  └── program_workouts (has week_number, day_of_week)
        └── workout_exercises
              └── exercise_sets

client_programs (links user to program with start_date)

workout_completions (tracks: client_id, workout_id, scheduled_date, client_program_id)
```

### API Flow
1. Query `client_programs` for active programs
2. Join `programs` → `program_workouts` (includes week_number)
3. Query `workout_completions` for last 60 days
4. Build `scheduleByWeekAndDay[weekNum][dayOfWeek] = [workouts]`
5. Build `completionsByDateAndWorkout[date:workoutId:programId] = true`

### UI Flow
1. `getWeekForDate(date)` calculates which week based on program start
2. `getWorkoutsForDate(date)` returns workouts for that week+day
3. `getDateStatus(date)` returns completed/skipped/upcoming/rest
4. Calendar renders with appropriate colors

---

## Root Cause Analysis

### Checking Week Calculation
- Program start: 2026-02-09 (Monday)
- Today: 2026-02-16 (Monday)
- Days since start: 7
- Week calc: `floor(7/7) + 1 = 2`
- **Result**: Should be Week 2 ✓

### Checking Data Structure
Need to verify what's actually in `scheduleByWeekAndDay`:
- Does week 2 exist?
- What workouts are in week 2?
- Are empty days initialized as `[]`?

### Bug in Admin getWorkoutsForDate
```javascript
// Current code has problematic fallback:
if (scheduleByWeekAndDay[weekNum]?.[dayOfWeek]) {
  return scheduleByWeekAndDay[weekNum][dayOfWeek]
}
// Falls back to week 1 if week 2 array is empty
if (scheduleByWeekAndDay[1]?.[dayOfWeek]) {
  return scheduleByWeekAndDay[1][dayOfWeek]  // ← THIS IS WRONG
}
```

**Issue**: Empty array `[]` is truthy in JS, so this shouldn't trigger...
UNLESS `scheduleByWeekAndDay[2]` is undefined.

---

## Proposed Fixes

### Fix 1: Remove Week 1 Fallback in Admin
```javascript
const getWorkoutsForDate = (date: Date): WorkoutSchedule[] => {
  const weekNum = getWeekForDate(date)
  const dayOfWeek = date.getDay()
  
  // Return workouts for the specific week+day (may be empty array)
  return scheduleByWeekAndDay[weekNum]?.[dayOfWeek] || []
}
```

### Fix 2: Ensure All Weeks/Days Initialized in API
```javascript
// Initialize ALL weeks up to maxWeek with empty arrays
for (let w = 1; w <= maxWeek; w++) {
  if (!scheduleByWeekAndDay[w]) {
    scheduleByWeekAndDay[w] = {}
    for (let d = 0; d < 7; d++) {
      scheduleByWeekAndDay[w][d] = []
    }
  }
}
```

### Fix 3: Add Validation/Debug Output
Return which week is being calculated for each day so we can verify.

### Fix 4: Clean Up Stray Completion
```sql
DELETE FROM workout_completions 
WHERE scheduled_date = '2026-02-16'
AND workout_id = '4113fa49-cf28-418a-8175-7ee763987e8c';
```

---

## Questions to Verify

1. **What workouts should week 2 have?** 
   - Need to check program_workouts where week_number = 2

2. **Is the program set up correctly?**
   - Run: `SELECT name, day_of_week, week_number FROM program_workouts WHERE program_id = 'X' ORDER BY week_number, day_of_week`

3. **How did the Feb 16 completion get created?**
   - Check if user accidentally logged workout
   - Check for bugs in completion creation logic

---

## Implementation Order

1. ✅ Identify issues (done)
2. ⬜ Query database to see actual program structure
3. ⬜ Fix getWorkoutsForDate to not fallback to week 1
4. ⬜ Ensure API initializes all weeks properly
5. ⬜ Delete stray completion
6. ⬜ Test with Halley's account
7. ⬜ Remove debug logging
8. ⬜ Verify client app (eddytrains-app) has same logic
