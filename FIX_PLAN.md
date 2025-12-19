# File Upload Bug Fix Plan

## Issue Identified
When uploading 3 files in combined view, one file gets lost/replaced and only 2 show as active instead of 3.

## Root Cause
The bug is in the `handleAddFiles` function in `/src/App.tsx`. When the backend returns file IDs, if some uploaded files are duplicates, it returns existing file IDs instead of new ones. The frontend then creates duplicate entries in the arrays.

### Current Problem Flow:
1. User uploads 3 files: [fileA, fileB, fileC]
2. Backend processes: fileA=duplicate (returns existing ID), fileB=new, fileC=duplicate (returns existing ID)
3. Frontend gets: [existingFile1, newFile2, existingFile1] 
4. Combined with existing: [oldFile1, oldFile2] + [existingFile1, newFile2, existingFile1]
5. Result: [oldFile1, oldFile2, existingFile1, newFile2, existingFile1] → loses track

## Fix Plan

### 1. Enhanced File Upload Logic
- **File**: `/src/App.tsx` 
- **Function**: `handleAddFiles`
- **Changes**: 
  - Add proper deduplication logic
  - Track which files are actually new vs duplicates
  - Ensure combined arrays have no duplicate file IDs

### 2. Duplicate Detection Improvements  
- **File**: `/src/App.tsx`
- **Changes**:
  - Add better logging for duplicate detection
  - Show user feedback when duplicates are ignored
  - Ensure file count display is accurate

### 3. State Management Fixes
- **Changes**:
  - Fix array deduplication logic
  - Ensure proper state updates
  - Fix localStorage synchronization

## Implementation Steps

### Step 1: Fix handleAddFiles function
```typescript
// Key changes needed:
- Deduplicate file IDs after combining
- Track duplicates vs new files separately  
- Better error handling for file processing
```

### Step 2: Add duplicate feedback
```typescript
// Add user notifications when duplicates are detected
- Show "X duplicate files ignored" message
- Display actual new files added count
```

### Step 3: Test the fix
```bash
# Test scenarios:
1. Upload 3 brand new files
2. Upload mix of new and duplicate files
3. Upload 3 duplicate files
4. Verify file count display accuracy
```

## Expected Outcome
✅ Users can upload unlimited files  
✅ Duplicate files are properly detected and ignored  
✅ File count shows correct number of active files  
✅ No files are lost during bulk uploads  
✅ Better user feedback for duplicate handling
