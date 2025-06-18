# Manual Testing Scripts for Live Table Actions

This directory contains manual testing scripts for evaluating AI-powered features with real API calls.

## Citation Finder Manual Test

### Purpose
Tests the `findCitations` function with real OpenAI API calls to evaluate the quality of citations found for selected table cells.

### Usage
```bash
# Set your OpenAI API key and run the manual test
OPENAI_API_KEY=your_api_key_here RUN_AI_TESTS=true npm test -- src/__tests__/components/live-table/actions/find-citations.manual.test.ts
```

### Test Cases
- **Hardcoded**: Fortune 500 companies with revenue data
- **JSON File**: Load additional test cases from `find-citations-test-cases.json`

### What to Evaluate
The test provides detailed output showing:
- Original table with selected cells marked
- Citations found with titles, URLs, snippets, and credibility assessments
- Source type categorization (government, academic, news, etc.)

Look for:
- Citations from authoritative sources (.gov, .edu, reputable news)
- Relevant snippets that relate to the selected data
- Proper URL formatting and accessibility
- Appropriate mix of source types

### Adding Test Cases
Add new test cases to `find-citations-test-cases.json`:

```json
[
  {
    "title": "Your Test Case Title",
    "description": "Description of the data being tested",
    "tableData": [
      {"Column1": "Value1", "Column2": "Value2"}
    ],
    "headers": ["Column1", "Column2"],
    "selectedCells": [
      {"rowIndex": 0, "colIndex": 1}
    ],
    "selectedCellsData": [
      ["Value2"]
    ],
    "expectedCitationTypes": [
      "Expected source types for this data"
    ]
  }
]
```

## AI Fill Selection Manual Test

### Purpose
Tests the `generateSelectedCellsSuggestions` function to evaluate AI-generated suggestions for selected cells.

### Usage
```bash
# Set your OpenAI API key and run the manual test
OPENAI_API_KEY=your_api_key_here RUN_AI_TESTS=true npm test -- src/__tests__/components/live-table/actions/ai-fill-selection.manual.test.ts
```

## General Guidelines

### Environment Variables
- `OPENAI_API_KEY`: Your OpenAI API key (required)
- `RUN_AI_TESTS=true`: Enable manual tests (required)

### Test Timeouts
Manual tests have extended timeouts (2-3 minutes) to accommodate API calls.

### Output
Tests provide rich console output with:
- Visual table representations
- Detailed results analysis
- Manual review checkpoints
- Basic validation

### Best Practices
- Review results manually - automated validation is limited
- Test with diverse data types and domains
- Verify source credibility and relevance
- Check for consistency and accuracy
- Add new test cases for edge cases or specific domains
