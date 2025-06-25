# File Upload Feature for Document Creation

## Overview

This project adds file upload functionality to the document creation page,
allowing users to upload CSV, Excel, and other common file formats to
automatically populate new documents with imported data.

## Goals

- Enable file upload on `/document/new` page
- Support CSV, Excel (.xlsx, .xls), XML, JSON, PDF, and folder uploads
- Parse uploaded files and extract tabular data
- Pre-populate new table documents with imported data
- Maintain existing document creation workflow as fallback
- Process files directly into Y-Sweet documents via trigger.dev

## Architecture Overview

- **Frontend**: File upload component with drag-and-drop support for files and
  folders
- **Backend**: File parsing handled by trigger.dev tasks using libraries like
  `papaparse`, `xlsx`, `pdf-parse`, and `fast-xml-parser`
- **Storage**: Data imported directly into Y-Sweet live table documents (no file
  storage)
- **Database**: Simplified schema without file storage requirements

## Phase 1: CSV Support (Priority 1) 📊

### 1.1 CSV Trigger.dev Task Setup

- [ ] Install dependencies: `papaparse`, `file-type`
- [ ] Create `processCSVUpload` trigger.dev task
- [ ] Set up CSV file type validation and error handling
- [ ] Configure task retry policies and timeouts

### 1.2 CSV Parsing Services (in trigger.dev)

- [ ] Create CSV parser using `papaparse` (comma-delimited only)
- [ ] Handle CSV encoding detection (UTF-8, UTF-16, etc.)
- [ ] Add robust error handling and logging
- [ ] Focus on standard comma-separated format

### 1.3 CSV Y-Sweet Document Integration
- [ ] Add CSV data population to Y-Sweet document creation
- [ ] Create helper functions for CSV table structure generation
- [ ] Implement CSV data validation and sanitization
- [ ] Add column type detection for CSV data (strings, numbers, dates)

## Phase 2: Excel Support (Priority 2) 📈

### 2.1 Excel Trigger.dev Task Setup
- [ ] Install dependencies: `xlsx`
- [ ] Create `processExcelUpload` trigger.dev task
- [ ] Set up Excel file type validation (.xlsx, .xls)
- [ ] Configure Excel-specific retry policies

### 2.2 Excel Parsing Services (in trigger.dev)
- [ ] Create Excel parser using `xlsx` library
- [ ] Handle multiple worksheet detection and selection
- [ ] Add Excel formula evaluation capabilities
- [ ] Handle Excel data types (dates, numbers, formulas)
- [ ] Add Excel-specific error handling

### 2.3 Excel Y-Sweet Document Integration
- [ ] Add Excel data population to Y-Sweet document creation
- [ ] Handle Excel multi-sheet scenarios (create multiple documents or combine)
- [ ] Preserve Excel formatting hints for data types
- [ ] Add Excel-specific column type detection

## Phase 3: UI Components 📱

### 3.1 File Upload Component
- [ ] Create `FileUploadDropzone` component using existing UI components
- [ ] Implement drag-and-drop functionality for files and folders
- [ ] Add file type validation and size limits (client-side)
- [ ] Show trigger.dev task progress and status
- [ ] Display parsing errors with clear messaging
- [ ] Add support for multiple file selection

### 3.2 Data Preview Component
- [ ] Create `FileDataPreview` component to show parsed data from trigger.dev
- [ ] Allow column name editing before document creation
- [ ] Show data type detection for columns
- [ ] Add option to skip rows or select data range
- [ ] Integrate with trigger.dev task status updates
- [ ] Handle multi-file/multi-sheet preview

### 3.3 Document Creation Form Enhancement
- [ ] Integrate file upload component into existing form
- [ ] Add conditional rendering: manual creation vs file upload
- [ ] Update form validation to handle trigger.dev workflow
- [ ] Show task progress and allow cancellation
- [ ] Maintain existing AI suggestions as fallback
- [ ] Add file type selection and options

## Phase 4: CSV Dialects & Variants (Priority 3) 📊

### 4.1 TSV and Other Delimited Formats
- [ ] Add TSV parser (tab-separated values)
- [ ] Add CSV dialect detection (semicolon, pipe delimiters)
- [ ] Handle custom delimiter detection
- [ ] Add support for quote character variations
- [ ] Test with various regional CSV formats

### 4.2 Advanced CSV Features
- [ ] Add support for multi-line CSV fields
- [ ] Handle CSV files with headers on multiple rows
- [ ] Add CSV validation and repair capabilities
- [ ] Support for CSV comments and metadata
- [ ] Handle malformed CSV recovery

## Phase 5: Extended File Types (Priority 4) 🗂️

### 5.1 XML Support
- [ ] Install dependencies: `fast-xml-parser`
- [ ] Create `processXMLUpload` trigger.dev task
- [ ] Add XML to table data conversion logic
- [ ] Handle XML attributes and nested structures
- [ ] Add XML schema detection and flattening

### 5.2 JSON Support
- [ ] Create `processJSONUpload` trigger.dev task
- [ ] Handle JSON array-of-objects format
- [ ] Add JSON schema detection and validation
- [ ] Support nested JSON flattening
- [ ] Handle various JSON structures (arrays, objects)

### 5.3 PDF Support
- [ ] Install dependencies: `pdf-parse`, `pdf2pic`
- [ ] Create `processPDFUpload` trigger.dev task
- [ ] Add PDF table extraction capabilities
- [ ] Handle PDF text parsing and table detection
- [ ] Add OCR support for scanned PDFs (optional)

### 5.4 Folder Support
- [ ] Create `processFolderUpload` trigger.dev task
- [ ] Add recursive file processing for folders
- [ ] Handle multiple file types in single folder
- [ ] Create unified document from folder contents
- [ ] Add folder structure preservation options

## Phase 6: Advanced Integration 🚀

### 6.1 Unified File Processing Task
- [ ] Create master `processFileUpload` trigger.dev task
- [ ] Route to appropriate parser based on file type
- [ ] Handle mixed file type scenarios
- [ ] Implement comprehensive error handling and retries
- [ ] Add file type detection and validation

### 6.2 Document Creation with File Data Task
- [ ] Create `createDocumentFromFile` trigger.dev task
- [ ] Pre-populate Y-Sweet document with parsed file data
- [ ] Generate appropriate column definitions for all file types
- [ ] Handle large datasets with chunking
- [ ] Maintain compatibility with existing creation flow

### 6.3 Frontend Integration
- [ ] Create trigger.dev task runner utilities
- [ ] Add task status polling and updates
- [ ] Implement task result handling
- [ ] Add task cancellation support
- [ ] Create error recovery mechanisms

## Phase 7: Testing & Polish ✅

### 7.1 Unit Tests
- [ ] Test CSV parsing functions with sample files
- [ ] Test Excel parsing with multi-sheet scenarios
- [ ] Test XML/JSON/PDF parsing functions
- [ ] Test folder processing logic
- [ ] Test trigger.dev tasks with mock data
- [ ] Test UI components with Jest/Vitest
- [ ] Test error handling scenarios for all file types

### 7.2 Integration Tests
- [ ] Test complete CSV to Y-Sweet workflow
- [ ] Test Excel multi-sheet document creation
- [ ] Test XML/JSON/PDF to table conversion
- [ ] Test folder upload and processing
- [ ] Test trigger.dev task execution and status updates
- [ ] Test task cancellation and error recovery

### 7.3 E2E Tests
- [ ] Test drag-and-drop for all supported file types
- [ ] Test folder drag-and-drop functionality
- [ ] Test data preview and editing for each file type
- [ ] Test document creation from uploaded files
- [ ] Test trigger.dev task progress tracking
- [ ] Test error states and recovery for all parsers

### 7.4 Performance & UX
- [ ] Optimize trigger.dev task execution for large files
- [ ] Add real-time task progress indicators
- [ ] Implement client-side file validation for all types
- [ ] Add helpful error messages and task status updates
- [ ] Optimize Y-Sweet document population performance
- [ ] Test folder processing performance

## Technical Specifications

### Supported File Formats (Priority Order)
1. **CSV** (Comma-separated values) - `.csv` (comma-delimited only)
2. **Excel** - `.xlsx`, `.xls`
3. **CSV Dialects** - `.tsv`, semicolon-delimited, other dialects
4. **XML** - `.xml` (with table structure extraction)
5. **JSON** - `.json` (array-of-objects format)
6. **PDF** - `.pdf` (with table extraction)
7. **Folders** - Support for folders containing any of the above file types

### File Size Limits
- Maximum file size: 10MB
- Maximum rows: 10,000 rows
- Maximum columns: 100 columns

### Data Type Detection
- **CSV/Excel**: Automatic detection of strings, numbers, dates, booleans
- **XML**: Attribute and element content type detection
- **JSON**: Native JSON type preservation (string, number, boolean, array)
- **PDF**: Text-based type detection from extracted tables
- **Fallback**: String type for ambiguous data
- **Override**: User capability to modify detected types in preview

### Data Flow Architecture
```
1. Frontend: File upload → Base64 encode
2. Trigger.dev: Receive file data → Parse → Extract table data
3. Y-Sweet: Create document → Populate with parsed data
4. Frontend: Show task progress → Navigate to created document
```

## Dependencies to Add
```json
{
  "papaparse": "^5.4.1",
  "xlsx": "^0.18.5",
  "fast-xml-parser": "^4.3.2",
  "pdf-parse": "^1.1.1",
  "pdf2pic": "^2.1.4",
  "file-type": "^19.0.0",
  "@types/papaparse": "^5.3.14",
  "@types/pdf-parse": "^1.1.3"
}
```

## Trigger.dev Task Structure
```typescript
// CSV processing task (Priority 1)
export const processCSVUpload = task({
  id: "process-csv-upload",
  run: async (payload: {
    fileData: string; // base64 encoded
    fileName: string;
    documentName: string;
    documentDescription?: string;
  }) => {
    // Parse CSV and return structured data
  }
});

// Excel processing task (Priority 2)
export const processExcelUpload = task({
  id: "process-excel-upload",
  run: async (payload: {
    fileData: string; // base64 encoded
    fileName: string;
    sheetName?: string; // optional sheet selection
    documentName: string;
    documentDescription?: string;
  }) => {
    // Parse Excel and return structured data
  }
});

// Extended file types (Priority 3)
export const processExtendedFileUpload = task({
  id: "process-extended-file-upload",
  run: async (payload: {
    fileData: string | string[]; // base64 encoded, array for folders
    fileName: string;
    fileType: 'xml' | 'json' | 'pdf' | 'folder';
    documentName: string;
    documentDescription?: string;
  }) => {
    // Route to appropriate parser based on fileType
  }
});
```

## Risk Mitigation
- **Large files**: Use trigger.dev task timeouts and chunking for large datasets
- **Memory usage**: Process files efficiently in trigger.dev environment
- **Security**: Validate file types on both client and trigger.dev task
- **Task failures**: Leverage trigger.dev retry mechanisms and error handling
- **User experience**: Real-time task status updates and clear error messages
- **Y-Sweet performance**: Optimize document population for large datasets

## Success Criteria
- [ ] Users can upload supported file formats via drag-and-drop
- [ ] Files are parsed correctly by trigger.dev tasks with 95%+ accuracy
- [ ] Document creation workflow remains intuitive with task progress
- [ ] All existing functionality continues to work
- [ ] Trigger.dev tasks handle files up to 10MB efficiently
- [ ] Real-time task status updates and clear error handling
- [ ] Data is populated directly into Y-Sweet documents seamlessly

## Future Enhancements (Out of Scope)
- Support for additional formats (PDF, Word, etc.)
- Real-time collaboration during file import
- Advanced data transformation options
- Batch file upload
- File format conversion capabilities
