# File Upload Feature for Document Creation

## Overview

This project adds file upload functionality to the document creation page,
allowing users to upload CSV and TSV (Tab-Separated Values) files to
automatically populate new documents with imported data.

## Goals

- Enable file upload on `/document/new` page
- Support CSV and TSV files in the first version
- Parse uploaded files and extract tabular data
- Pre-populate new table documents with imported data
- Maintain existing document creation workflow as fallback
- Process files directly into Y-Sweet documents via trigger.dev

## Architecture Overview

- **Frontend**: File upload component with drag-and-drop support for CSV/TSV files
- **Backend**: File parsing handled by trigger.dev tasks using `papaparse` library
- **Storage**: Data imported directly into Y-Sweet live table documents (no file storage)
- **Database**: Simplified schema without file storage requirements

### Step 1: File upload component
- [x] Create file upload input component using existing UI components
- [x] add it to document/new in an expandable accordion section
- [x] initially, it will be non-functional and call a trigger.dev task that returns a message
- [x] restrict to CSV and TSV files only

### Step 2: CSV/TSV Trigger.dev Task Setup

- [ ] Install dependencies: `papaparse`, `file-type`
- [ ] Create `processCSVUpload` trigger.dev task that returns a message
- [ ] Set up CSV/TSV file type validation and error handling
- [ ] Configure task retry policies and timeouts

### Step 3: CSV/TSV Parsing Services (in trigger.dev)

- [ ] Create CSV parser using `papaparse` (comma and tab delimited)
- [ ] Handle CSV/TSV encoding detection (UTF-8, UTF-16, etc.)
- [ ] Add robust error handling and logging
- [ ] Focus on standard comma-separated and tab-separated formats
- [ ] Add delimiter auto-detection

### Step 4: CSV/TSV Y-Sweet Document Integration
- [ ] Add CSV/TSV data population to Y-Sweet document creation
- [ ] Create helper functions for CSV/TSV table structure generation
- [ ] Implement CSV/TSV data validation and sanitization
- [ ] Add column type detection for CSV/TSV data (strings, numbers, dates)

### Step 5: UI Components Polish
- [ ] Implement drag-and-drop functionality for CSV/TSV files
- [ ] Add file type validation and size limits (client-side)
- [ ] Show trigger.dev task progress and status
- [ ] Display parsing errors with clear messaging
- [ ] Add support for multiple file selection

### Step 6: Data Preview Component
- [ ] Create `FileDataPreview` component to show parsed CSV/TSV data from trigger.dev
- [ ] Allow column name editing before document creation
- [ ] Show data type detection for columns
- [ ] Add option to skip rows or select data range
- [ ] Integrate with trigger.dev task status updates

### Step 7: Document Creation Form Enhancement
- [ ] Integrate file upload component into existing form
- [ ] Add conditional rendering: manual creation vs file upload
- [ ] Update form validation to handle trigger.dev workflow
- [ ] Show task progress and allow cancellation
- [ ] Maintain existing AI suggestions as fallback

### Step 8: Advanced CSV/TSV Features
- [ ] Add CSV dialect detection (semicolon, pipe delimiters)
- [ ] Handle custom delimiter detection
- [ ] Add support for quote character variations
- [ ] Test with various regional CSV formats
- [ ] Add support for multi-line CSV fields
- [ ] Handle CSV files with headers on multiple rows
- [ ] Add CSV validation and repair capabilities
- [ ] Support for CSV comments and metadata
- [ ] Handle malformed CSV recovery

### Step 9: Document Creation with File Data Task
- [ ] Create `createDocumentFromFile` trigger.dev task
- [ ] Pre-populate Y-Sweet document with parsed CSV/TSV data
- [ ] Generate appropriate column definitions for CSV/TSV files
- [ ] Handle large datasets with chunking
- [ ] Maintain compatibility with existing creation flow

### Step 10: Frontend Integration
- [ ] Create trigger.dev task runner utilities
- [ ] Add task status polling and updates
- [ ] Implement task result handling
- [ ] Add task cancellation support
- [ ] Create error recovery mechanisms

## Future Enhancements (Post-MVP)

After the CSV/TSV implementation is complete and tested, these formats can be added:

### Excel Support
- [ ] Install dependencies: `xlsx`
- [ ] Create `processExcelUpload` trigger.dev task
- [ ] Handle multiple worksheet detection and selection
- [ ] Add Excel formula evaluation capabilities
- [ ] Handle Excel data types (dates, numbers, formulas)

### Other Formats
- [ ] XML Support using `fast-xml-parser`
- [ ] JSON Support for array-of-objects format
- [ ] PDF Support using `pdf-parse` for table extraction
- [ ] Folder Support for recursive processing

### Advanced Integration
- [ ] Create master `processFileUpload` trigger.dev task
- [ ] Route to appropriate parser based on file type
- [ ] Handle mixed file type scenarios
- [ ] Implement comprehensive error handling and retries
