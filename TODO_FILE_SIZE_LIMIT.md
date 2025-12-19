# File Size Limit Implementation Plan

## Objective
Implement consistent 9MB file size limit across frontend and backend

## Current State
- Frontend (FileUpload.tsx): 100MB limit
- Server (services/index.ts): 16MB limit with MongoDB document constraints
- User requirement: 9MB limit

## Changes Required


### 1. Frontend Updates (FileUpload.tsx)
- [x] Update `validateFile` function to change maxSize from 100MB to 9MB
- [x] Update error message to reflect 9MB limit
- [x] Ensure consistent user experience

### 2. Backend Updates (services/index.ts)
- [x] Update `MAX_DOCUMENT_SIZE` constant from 16MB to 9MB
- [x] Update `CHUNK_THRESHOLD` to appropriate value (e.g., 7MB for buffer)
- [x] Update error message to reflect 9MB limit
- [x] Verify MongoDB compatibility with 9MB limit


### 3. Testing & Validation
- [x] Test file upload with files approaching 9MB limit
- [x] Test error messages display correctly
- [x] Verify no regression in existing functionality

## Implementation Steps
1. Update frontend file validation
2. Update server-side file size limits
3. Test the implementation
4. Verify error handling works correctly

## Expected Outcome
- Files larger than 9MB will be rejected at both frontend and backend
- Clear error messages indicating 9MB limit
- Consistent behavior across the application
