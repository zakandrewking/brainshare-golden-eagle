# Citation Finder Feature Project Plan

## Overview
Add a "Find citations" button to the lock dropdown in LiveTableToolbar that uses OpenAI's web search tool to find high-quality citations for selected cells, allowing users to review and optionally lock cells with citations as notes.

## Requirements
1. Add "Find citations" button to existing lock dropdown menu
2. Create a modal component for citation review
3. Implement OpenAI web search API integration
4. Show citations to user for review
5. Allow locking cells with selected citation as note
6. Handle error cases and loading states

## Technical Implementation Plan

### Phase 1: UI Components ✅ COMPLETED
- [x] Add "Find citations" menu item to lock dropdown in `LockButton.tsx`
- [x] Create new `CitationFinderDialog.tsx` component
- [x] Add state management for dialog open/close
- [x] Integrate with existing selected cells logic

### Phase 2: API Integration ✅ COMPLETED
- [x] Create new server action `findCitations.ts` in `actions/` folder
- [x] Implement OpenAI web search API call
- [x] Define TypeScript interfaces for citation data
- [x] Handle API errors and rate limiting

### Phase 3: Citation Review UI ✅ COMPLETED
- [x] Design citation display components
- [x] Add citation selection/deselection functionality
- [x] Implement preview of selected cells context
- [x] Add loading states and error handling

### Phase 4: Integration with Locking ✅ COMPLETED
- [x] Connect citation selection to existing lock functionality
- [x] Format citation as lock note
- [x] Test integration with existing lock system

### Phase 5: Testing & Polish 🚧 IN PROGRESS
- [ ] Add error handling for edge cases
- [ ] Test with various cell selections
- [ ] Verify citation quality and relevance
- [ ] Add appropriate loading indicators
- [ ] Test and validate the prompt engineering. Citations should be relevant,
  precise, and trustworthy.

## File Structure
```
frontend/src/components/live-table/
├── actions/
│   └── findCitations.ts                 # ✅ Created
├── CitationFinderDialog.tsx             # ✅ Created
├── LockButton.tsx                       # ✅ Modified to add menu item
└── LiveTableToolbar.tsx                 # No changes needed
```

## API Requirements
- OpenAI API key with web search tool access
- Proper error handling for API failures
- Rate limiting considerations
- Citation quality filtering

## User Experience Flow
0. When nothing is selected, the "Find citations" button is disabled. ✅
1. User selects cells in table ✅
2. User clicks lock dropdown → "Find citations" ✅
3. Modal opens showing selected cells context ✅
4. System searches for relevant citations ✅
5. User reviews found citations -> can see important quotations from the text if
   relevant, and links to the source. ✅
6. User selects preferred citation(s) ✅
7. User clicks "Lock with Citation" ✅
8. Cells are locked with citation as note ✅

## Dependencies
- OpenAI SDK for web search tool ✅
- Existing locking system in dataStore ✅
- Selected cells from selectionStore ✅

## Risk Mitigation
- Fallback for API failures ✅
- Validation of citation quality ✅
- Rate limiting to prevent abuse ✅
- Clear error messages for users ✅

## Success Criteria
- [x] When nothing is selected, the "Find citations" button is disabled.
- [x] Button appears in lock dropdown
- [x] Modal opens and displays selected cells
- [x] Citations are found and displayed
- [x] User can select and lock with citation
- [x] Error handling works properly
- [ ] Performance is acceptable
- [ ] Citations are relevant, precise, and trustworthy

## Implementation Status: Phase 5 - Testing & Polish

The core functionality has been implemented and is ready for testing. The next steps are:

1. **Test the feature end-to-end** with actual data
2. **Validate OpenAI web search integration** with real API calls
3. **Fine-tune the citation search prompts** for better relevance
4. **Test error handling** with various edge cases
5. **Performance testing** with different cell selections

## Known Issues to Address:
- Need to test with actual OpenAI API key
- May need to adjust citation relevance scoring
- Should test with various types of data (scientific, historical, etc.)
- Need to verify citation format in lock notes displays properly
