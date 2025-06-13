# Column Data Types Feature

## Overview
Add data type support to table columns with validation, AI integration, and type-aware sorting.

## Goals
- Allow users to specify data types (Integer, Decimal, Text, Datetime, Enum, Boolean, Image URL) for columns
- Validate cell values based on column data type
- Integrate data types with AI operations for better generation
- Implement type-aware sorting

## Data Types
- **Text** (default): Any string value
- **Integer**: Whole numbers only (positive, negative, zero)
- **Decimal**: Numeric values with decimal places
- **Datetime**: Date and time values using ISO 8601 standard (handled via JavaScript Temporal API)
- **Enum**: Predefined list of allowed values (dropdown options)
- **Boolean**: True/false values (yes/no, true/false, 1/0, etc.)
- **Image URL**: Valid URLs pointing to images (jpg, png, gif, webp, svg, etc.)

## Technical Implementation Plan

### Phase 1: Core Data Structure Updates ✅
- [x] Update `ColumnDefinition` interface in `LiveTableDoc.ts`
  - Add `dataType: 'text' | 'integer' | 'decimal' | 'datetime' | 'enum' | 'boolean' | 'imageurl'` field
  - Set default to 'text' for backward compatibility
- [x] Update migration logic to handle existing columns
- [x] Add data type methods to `LiveTableDoc` class
  - `updateColumnDataType()` - Updates column data type with enum values support
  - `getColumnDataType()` - Gets current data type of a column
  - `getColumnEnumValues()` - Gets enum values for enum columns
- [x] Enhanced type-aware sorting in `sortRowsByColumn()` method
  - Added support for all data types including imageurl
  - Integer and decimal numeric sorting
  - Datetime chronological sorting
  - Boolean sorting (false before true)
  - Enum sorting based on enumValues order
  - Image URL and text alphabetical sorting
- [x] Set up JavaScript Temporal API polyfill if needed

### Phase 2: UI Components ✅
- [x] Update `TableHeader.tsx` dropdown menu
  - Add "Set Data Type" submenu
  - Display current data type indicator
- [x] Create data type selection component
- [x] Create enum values configuration UI
- [x] Create datetime picker/input component using Temporal API
- [x] Update column header visual indicators
- [x] Add boolean toggle/dropdown for cell editing
- [x] Add image URL cell preview and editing component

### Phase 3: Validation System
- [ ] Create validation utilities in `utils/validation.ts`
  - Integer validation (whole numbers only, handle formatting)
  - Decimal validation (floating-point numbers, currency formatting)
  - Datetime validation (ISO 8601 and common formats, using Temporal API)
  - Enum validation (value must be in allowed list)
  - Boolean validation (various true/false representations)
  - Image URL validation (valid URL format, image file extensions)
  - Text validation (always valid)
- [ ] Integrate validation in cell editing
- [ ] Add validation feedback UI

### Phase 4: AI Integration
- [ ] Update AI prompts in `generateSelectedCellsSuggestions.ts`
- [ ] Update AI prompts in `generateNewColumns.ts`
- [ ] Update AI prompts in `generateNewRows.ts`
- [ ] Include data type context in all AI operations

### Phase 5: Type-Aware Sorting ✅
- [x] Update `sortRowsByColumn` method in `LiveTableDoc.ts`
- [x] Implement integer sorting (parse formatted whole numbers)
- [x] Implement decimal sorting (parse formatted floating-point numbers)
- [x] Implement datetime sorting (parse using Temporal API, ISO 8601 standard)
- [x] Implement enum sorting (based on enumValues order)
- [x] Implement boolean sorting (false before true)
- [x] Implement image URL sorting (alphabetical by URL)
- [x] Handle mixed/invalid data gracefully
- [x] Added backward compatibility with auto-detection for existing columns

### Phase 6: Data Store Integration
- [x] Update data store hooks to support data types
- [x] Add hooks for data type operations
- [ ] Update selection and editing logic

## Implementation Details

### 1. ColumnDefinition Interface Update
```typescript
export interface ColumnDefinition {
  id: ColumnId;
  name: string;
  width: number;
  dataType: 'text' | 'integer' | 'decimal' | 'datetime' | 'enum' | 'boolean' | 'imageurl'; // NEW
  enumValues?: string[]; // NEW - for enum type only
}
```

### 2. Validation Rules
- **Integer**: Accept whole numbers only (positive, negative, zero), with optional formatting (commas)
- **Decimal**: Accept numbers with decimal places, formatted numbers (commas, currency symbols)
- **Datetime**: Accept ISO 8601 format and common formats, parse using Temporal API, store as ISO string
- **Enum**: Value must be one of the predefined options
- **Boolean**: Accept true/false, yes/no, 1/0, on/off (case-insensitive)
- **Image URL**: Valid URL format with image file extensions (jpg, jpeg, png, gif, webp, svg, bmp, ico, tiff)
- **Text**: No validation needed

### 3. Sorting Logic
- **Integer**: Parse as whole numbers and compare numerically
- **Decimal**: Parse as floating-point numbers and compare numerically
- **Datetime**: Parse using Temporal API and compare chronologically (ISO 8601 standard)
- **Enum**: Sort by the order defined in enumValues array
- **Boolean**: Sort false values before true values
- **Image URL**: Alphabetical comparison by URL string
- **Text**: String comparison (current behavior)

### 4. AI Integration Points
- Include column data types in system prompts
- Guide AI to generate type-appropriate values
- For datetime columns, specify ISO 8601 format requirements
- For image URL columns, guide AI to generate valid image URLs with proper extensions
- Validate AI-generated content against types

## Files to Modify

### Core Files
- `frontend/src/components/live-table/LiveTableDoc.ts`
- `frontend/src/components/live-table/TableHeader.tsx`
- `frontend/src/stores/dataStore.ts`

### AI Action Files
- `frontend/src/components/live-table/actions/generateSelectedCellsSuggestions.ts`
- `frontend/src/components/live-table/actions/generateNewColumns.ts`
- `frontend/src/components/live-table/actions/generateNewRows.ts`

### New Files to Create
- `frontend/src/utils/validation.ts`
- ✅ `frontend/src/components/live-table/DataTypeSelector.tsx`
- ✅ `frontend/src/components/live-table/BooleanCellEditor.tsx`
- ✅ `frontend/src/components/live-table/DatetimeCellEditor.tsx`
- ✅ `frontend/src/components/live-table/ImageUrlCellEditor.tsx`
- `frontend/src/utils/datetime-parsing.ts` (using Temporal API)
- `frontend/src/utils/boolean-parsing.ts`
- `frontend/src/utils/image-url-validation.ts`
- `frontend/src/utils/temporal-polyfill.ts` (if needed)

## Testing Strategy
- Unit tests for validation utilities
- Integration tests for data type operations
- AI generation tests with different data types
- Sorting tests with mixed data types

## Migration Strategy
- Existing columns default to 'text' type
- No breaking changes to existing data
- Gradual rollout with feature flags if needed

## Success Criteria
- [x] Users can set column data types via dropdown
- [x] Users can configure enum values for enum columns
- [ ] Cell values validate against column types
- [ ] Invalid values show clear error states
- [x] Boolean cells provide user-friendly input (toggles/dropdowns)
- [ ] Enum cells provide dropdown selection from allowed values
- [ ] Image URL cells display image previews and validate URLs
- [ ] AI operations respect and generate type-appropriate data
- [x] Sorting works correctly for all data types
- [x] No regression in existing functionality

## Timeline Estimate
- Phase 1: 2-3 days
- Phase 2: 2-3 days
- Phase 3: 3-4 days
- Phase 4: 2-3 days
- Phase 5: 2-3 days
- Phase 6: 2 days
- Testing & Polish: 2-3 days

**Total: ~2-3 weeks**

## Risks & Considerations
- Performance impact of validation on large tables
- JavaScript Temporal API browser support (may need polyfill)
- Datetime parsing complexity across different locales and formats
- AI model consistency with type constraints
- Migration of existing data without disruption
- Backend PostgreSQL datetime handling and timezone considerations
