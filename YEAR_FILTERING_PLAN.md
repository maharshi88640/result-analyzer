# Year-wise Filtering Implementation Plan

## Completed Features

### 1. YearSelector Component (`src/components/YearSelector.tsx`)
- Created a new React component for year selection
- Supports 5 options: All Years, 1st Year, 2nd Year, 3rd Year, 4th Year
- Clear description for each year: Semesters 1-2, 3-4, 5-6, 7-8
- Pass/fail criteria explanation displayed when year is selected
- Responsive design with visual feedback

### 2. App.tsx Integration
- Added YearSelector import and component
- Integrated into the data view between QueryBuilder and SemesterSelector
- Connected to existing selectedYear state management
- Proper prop passing to EnhancedDataTable

### 3. EnhancedDataTable Updates
- Extended filtering logic to work for all views (not just combined views)
- Implemented pass/fail criteria:
  - **1st Year**: Students must not have failed in both semesters 1 & 2
  - **2nd Year**: Students must not have failed in both semesters 3 & 4
  - **3rd Year**: Students must not have failed in both semesters 5 & 6
  - **4th Year**: Students must not have failed in both semesters 7 & 8

### 4. Pass/Fail Criteria Logic
- **Qualification Rules**: 
  - At least one semester from the selected year must be present
  - All present target semesters must show "Pass" result with 0 backlogs
  - Any failing row disqualifies that semester
- **Result Detection**: Looks for 'Pass', 'P', or '1' in result column
- **Backlog Detection**: Checks for numeric value > 0 in backlog columns

## How It Works

### Year-wise Filtering Process:
1. **Year Selection**: User selects a specific year (1st, 2nd, 3rd, or 4th)
2. **Data Grouping**: System groups data by student (MAP number)
3. **Semester Analysis**: For each student, analyzes performance in target semesters:
   - 1st Year → Semesters 1, 2
   - 2nd Year → Semesters 3, 4
   - 3rd Year → Semesters 5, 6
   - 4th Year → Semesters 7, 8
4. **Qualification Check**: Student qualifies if:
   - Has data for at least one semester in the target year
   - All present target semesters show Pass + 0 backlogs
5. **Data Filtering**: Shows only qualifying students and their target semester data

### UI Features:
- **Visual Feedback**: Selected year highlighted in blue
- **Criteria Display**: Explanation of filtering rules shown when year selected
- **Count Display**: Shows number of qualified students
- **Clear Labeling**: "Year Analysis" vs "Analysis" to distinguish modes

## Technical Implementation Details

### Column Detection:
- **Semester**: Searches for 'sem', 'semester', variations
- **Result**: Searches for 'result', 'status' columns
- **Backlog**: Searches for 'curr_bck', 'backlog', 'current backlog' variations
- **MAP Number**: For student grouping and deduplication

### Data Processing:
- Handles multiple data formats and column naming conventions
- Robust parsing of semester numbers from various text formats
- Safe numeric parsing with fallback to 0 for missing values
- Case-insensitive matching for result status

## Files Modified:
1. ✅ `src/components/YearSelector.tsx` - Created
2. ✅ `src/App.tsx` - Updated imports and integration
3. ✅ `src/components/EnhancedDataTable.tsx` - Extended filtering logic

## Testing Status:
- Frontend development server: Running on http://localhost:5173
- Backend server: Needs to be started on port 5002
- Component integration: Complete
- UI testing: Ready for browser testing