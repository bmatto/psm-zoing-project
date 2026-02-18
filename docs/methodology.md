# Portsmouth Zoning Analysis Methodology

**Version:** 2.0 (TypeScript Implementation)
**Last Updated:** 2026-02-16
**Project:** Portsmouth Zoning Analysis

---

## Table of Contents

1. [Overview](#overview)
2. [Data Sources](#data-sources)
3. [Data Enrichment Pipeline](#data-enrichment-pipeline)
4. [Calculations and Derived Fields](#calculations-and-derived-fields)
5. [Validation and Quality Assurance](#validation-and-quality-assurance)
6. [Output Format](#output-format)
7. [Error Handling](#error-handling)
8. [Code References](#code-references)

---

## Overview

This document describes the methodology used for collecting, enriching, and analyzing parcel data for the City of Portsmouth, NH. The analysis combines information from multiple authoritative sources to create a comprehensive dataset for zoning analysis.

### Technology Stack

- **Runtime**: Node.js 20+ (LTS)
- **Language**: TypeScript with strict type checking
- **Testing**: Vitest test framework
- **Entry Point**: `src/analyze.ts`

---

## Data Sources

### 1. Portsmouth_Parcels.csv - Master Parcel List

**Source:** State of New Hampshire GIS Database
**Location:** Project root directory
**Purpose:** Authoritative source for all parcels in Portsmouth

This CSV file is the **master parcel list** and defines the complete set of parcels to be processed. Every parcel in this file must be accounted for in the output (either successfully enriched or logged as failed).

**Key Fields:**
- `displayid` - Primary parcel identifier used throughout the system
- `pid` - Secondary parcel identifier
- `streetaddress` - Street address of the parcel
- `town` - Municipality (Portsmouth)
- Additional metadata fields (see [ParcelRecord interface](../src/types/index.ts))

**Loading:** Implemented in `src/parsers/csv-parser.ts` using the `csv-parse` library with UTF-8 BOM support.

### 2. Map Geo API - Geographic and Property Data

**Endpoint:** `https://portsmouthnh.mapgeo.io/api/ui/datasets/properties/{parcelId}`
**Purpose:** Primary source for geographic, zoning, and property valuation data
**Status:** Required - parcel cannot be enriched without this data

**Data Provided:**
- Zoning codes and land use classifications
- Property and land values
- Parcel area measurements
- Owner names
- Account numbers (required for VGSI lookups)

**Implementation:** `src/api/mapgeo-client.ts`
**Rate Limiting:** Configurable max requests per second (default: 10/sec)
**Retry Logic:** Exponential backoff (1s, 2s, 4s delays for 3 attempts)

**Response Structure:**
```typescript
{
  data: {
    propID?: string;
    zoningCode?: string;
    landUseCode?: string;
    totalValue?: number | string;
    landValue?: number | string;
    parcelArea?: number | string;
    ownerName?: string;
    account?: string;  // Required for VGSI lookup
  }
}
```

### 3. VGSI API - Building Details and Assessments

**Endpoint:** `http://gis.vgsi.com/PortsmouthNH/Parcel.aspx?Pid={accountNumber}`
**Purpose:** Detailed building measurements and assessment data
**Status:** Optional - not all parcels have building data (e.g., vacant lots)

**Data Provided:**
- Building footprint area (square feet)
- Living area (square feet)
- Detailed lot information

**Implementation:** `src/api/vgsi-client.ts`
**Data Format:** HTML pages (requires regex-based parsing)
**Rate Limiting:** Configurable max requests per second (default: 10/sec)
**Retry Logic:** Exponential backoff (1s, 2s, 4s delays for 3 attempts)

**HTML Parsing Patterns:**
The VGSI API returns HTML pages, not JSON. The client uses multiple regex patterns to extract building metrics:

```typescript
// Living area patterns
/Living Area[^:]*:\s*(\d+(?:,\d+)?)\s*(?:SF|sq\.?\s*ft\.?)/i

// Building footprint patterns (multiple variations)
/Building Footprint[^:]*:\s*(\d+(?:,\d+)?)\s*(?:SF|sq\.?\s*ft\.?)/i
/Total Building[^:]*:\s*(\d+(?:,\d+)?)\s*(?:SF|sq\.?\s*ft\.?)/i
/Gross Building[^:]*:\s*(\d+(?:,\d+)?)\s*(?:SF|sq\.?\s*ft\.?)/i
```

**Fallback Behavior:** If building footprint is not found but living area is present, living area is used as building footprint.

---

## Data Enrichment Pipeline

The enrichment pipeline processes parcels in parallel batches, combining data from all sources into enriched parcel objects.

### Pipeline Architecture

**Implementation:** `src/pipeline/enrichment.ts` - `EnrichmentPipeline` class

**Configuration Parameters:**
```typescript
{
  batchSize: 5,              // Concurrent parcel processing
  maxRequestsPerSecond: 10,  // API rate limiting
  maxRetries: 3              // Retry attempts for failures
}
```

### Processing Stages

#### Stage 1: Load Master Parcel List

1. Read `Portsmouth_Parcels.csv` from project root
2. Parse CSV with UTF-8 BOM handling
3. Validate required fields (displayid, pid)
4. Log count of loaded parcels
5. Exit if no parcels found

**Code:** `src/parsers/csv-parser.ts` - `loadParcels()` function

#### Stage 2: Configure Enrichment Pipeline

1. Initialize Map Geo API client with rate limiting
2. Initialize VGSI API client with rate limiting
3. Configure batch processing parameters

#### Stage 3: Parallel Enrichment

For each parcel in batches:

1. **Fetch Map Geo Data** (REQUIRED)
   - API call to Map Geo endpoint with parcel ID
   - Validate response structure
   - Extract geographic, zoning, and property data
   - If fails: Record error and skip to next parcel

2. **Fetch VGSI Data** (OPTIONAL)
   - Check if account number available from Map Geo
   - If yes: API call to VGSI endpoint with account number
   - Parse HTML response for building measurements
   - If fails: Log warning but continue (vacant lots won't have data)

3. **Combine Data**
   - Merge fields from CSV, Map Geo, and VGSI
   - Calculate derived fields (see next section)
   - Validate combined data structure

4. **Track Results**
   - Success: Add to enriched parcels array
   - Failure: Add to errors array with details

**Critical Invariant:** Every input parcel produces either:
- One enriched parcel object, OR
- One error record explaining the failure

#### Stage 4: Data Validation and Quality Checks

1. **Count Reconciliation**
   - Verify: `successful + failed = total input`
   - Exit with error if counts don't match (data loss detected)

2. **Success Rate Analysis**
   - Calculate: `(successful / total) * 100`
   - Warn if success rate < 90%

3. **Error Pattern Analysis**
   - Group errors by type (network, validation, missing data)
   - Group errors by stage (csv_parse, mapgeo_fetch, vgsi_fetch, validation)
   - Display top 5 errors for debugging

#### Stage 5: Output Generation

Write three output files:
1. `output/portsmouth_properties_full.json` - Enriched parcels
2. `output/enrichment_errors.json` - Error report
3. `output/analysis_summary.json` - Statistics

**Code:** `src/output/writer.ts`

---

## Calculations and Derived Fields

The enrichment pipeline calculates several derived fields that combine data from multiple sources.

### Parcel Area Conversions

**Input:** `parcelArea` from Map Geo API (square feet)
**Calculations:**
```typescript
parcel_area_sqft = parcelArea  // Direct from API
parcel_area_acres = parcelArea / 43560  // Convert sqft to acres
```

**Source:** Standard conversion factor (1 acre = 43,560 square feet)

### Lot Coverage Percentage

**Purpose:** Measure how much of the parcel is covered by buildings

**Formula:**
```typescript
lot_coverage_pct = (building_footprint_sqft / parcel_area_sqft) * 100
```

**Inputs:**
- `building_footprint_sqft` - From VGSI API HTML parsing
- `parcel_area_sqft` - From Map Geo API

**Special Cases:**
- If no building footprint available: Set to 0%
- If building footprint > parcel area: Allow negative values (indicates data quality issue but preserved for analysis)

### Property Value Handling

**Inputs:** Map Geo API returns values as either `number` or `string`

**Processing:**
```typescript
// If string: parse to number
// If number: use directly
// If missing/invalid: default to 0

total_value = parseFloat(String(totalValue)) || 0
land_value = parseFloat(String(landValue)) || 0
```

---

## Validation and Quality Assurance

The system implements multi-stage validation to ensure data accuracy.

### Validation Implementation

**Module:** `src/validators/data-validator.ts`

### Validation Stages

#### 1. Parcel ID Validation

**Function:** `validateParcelId()`

**Checks:**
- Not null or undefined
- Type is string
- Not empty or whitespace-only

**Rationale:** Parcel IDs are the primary key for all operations. Invalid IDs make data provenance impossible.

#### 2. Geographic Coordinate Validation

**Function:** `validateCoordinates()`

**Portsmouth Geographic Bounds:**
```typescript
Latitude:  43.0°N to 43.1°N
Longitude: -70.85°W to -70.7°W
```

**Checks:**
- Coordinates are valid numbers
- Latitude within Portsmouth bounds
- Longitude within Portsmouth bounds

**Rationale:** Catches data errors like transposed coordinates, wrong municipality, or malformed data.

#### 3. CSV Parcel Record Validation

**Function:** `validateParcelRecord()`

**Required Fields:**
- `displayid` (parcel identifier)
- `pid` (alternate identifier)
- `streetaddress` (location)

**Checks:**
- All required fields present
- Field values are non-empty strings
- Data types match expected schema

#### 4. Map Geo Response Validation

**Function:** `validateMapGeoResponse()`

**Validates:**
- Response has `data` object
- Response is an object (not array/primitive)
- Data types match expected schema

**Rationale:** API responses can be malformed. Validate before incorporating data.

#### 5. VGSI Response Validation

**Function:** `validateVGSIResponse()`

**Validates:**
- Building measurements are positive numbers
- Living area is valid if present
- Building footprint is valid if present

**Special Case:** Empty VGSI responses are valid (parcels without buildings)

#### 6. Enriched Parcel Validation

**Function:** `validateEnrichedParcel()`

**Validates:**
- All required fields present
- Numeric fields are valid numbers
- Parcel ID matches source data
- No data type mismatches

**Rationale:** Final validation before output ensures complete, valid dataset.

### Validation Error Reporting

All validation errors include:
```typescript
{
  parcel_id: string;    // Which parcel failed
  field: string;        // Which field has issue
  expected: string;     // What was expected
  actual: unknown;      // What was received
  message: string;      // Human-readable explanation
}
```

---

## Output Format

All output files are written to the `output/` directory in JSON format.

### 1. portsmouth_properties_full.json

Successfully enriched parcels with complete metadata.

**Structure:**
```json
{
  "metadata": {
    "description": "Portsmouth parcel data enriched from multiple sources",
    "generated_at": "2026-02-16T12:00:00.000Z",
    "parcel_count": 1234,
    "data_sources": [
      "Portsmouth_Parcels.csv (State GIS)",
      "Map Geo API (portsmouthnh.mapgeo.io)",
      "VGSI API (gis.vgsi.com)"
    ]
  },
  "parcels": [
    {
      "parcel_id": "123-45",
      "address": "123 Main St",
      "zoning": "GR-1",
      "land_use_code": "130",
      "land_use_desc": "Single Family",
      "total_value": 450000,
      "land_value": 150000,
      "parcel_area_acres": 0.25,
      "parcel_area_sqft": 10890,
      "building_footprint_sqft": 1800,
      "living_area_sqft": 2200,
      "lot_coverage_pct": 16.53,
      "owner": "Smith, John",
      "account": "001234"
    }
  ]
}
```

**Implementation:** `src/output/writer.ts` - `writeEnrichedParcels()`

### 2. enrichment_errors.json

Parcels that failed enrichment with error details grouped for analysis.

**Structure:**
```json
{
  "metadata": {
    "description": "Errors encountered during parcel enrichment",
    "generated_at": "2026-02-16T12:00:00.000Z",
    "total_errors": 10
  },
  "summary": {
    "by_type": {
      "APIFetchError": 7,
      "ValidationError": 3
    },
    "by_stage": {
      "mapgeo_fetch": 5,
      "vgsi_fetch": 2,
      "validation": 3
    }
  },
  "errors": [
    {
      "parcel_id": "456-78",
      "stage": "mapgeo_fetch",
      "error_type": "APIFetchError",
      "message": "Request timeout after 30000ms",
      "timestamp": "2026-02-16T12:00:15.000Z"
    }
  ]
}
```

**Error Stages:**
- `csv_parse` - Failed to parse CSV record
- `mapgeo_fetch` - Map Geo API request failed
- `vgsi_fetch` - VGSI API request failed
- `validation` - Data validation failed

**Implementation:** `src/output/writer.ts` - `writeErrorReport()`

### 3. analysis_summary.json

Processing statistics and metadata about the enrichment run.

**Structure:**
```json
{
  "metadata": {
    "description": "Summary statistics for parcel enrichment",
    "generated_at": "2026-02-16T12:00:00.000Z"
  },
  "statistics": {
    "total_parcels": 1244,
    "successful_enrichments": 1234,
    "failed_enrichments": 10,
    "success_rate_pct": 99.2,
    "processing_time_ms": 45230,
    "processing_time_sec": 45.23
  },
  "timestamp": "2026-02-16T12:00:00.000Z"
}
```

**Implementation:** `src/output/writer.ts` - `writeAnalysisSummary()`

---

## Error Handling

The system implements comprehensive error handling at every stage.

### Error Handling Principles

1. **Never Throw During Enrichment**: All errors caught and recorded
2. **Explicit Error Tracking**: Every failure generates an APIError object
3. **No Silent Failures**: Missing parcels trigger validation errors
4. **Detailed Error Context**: Each error includes parcel ID, stage, type, message, and timestamp

### Error Types

**APIFetchError**
- Network request failed
- Server returned error status
- Request timeout

**ValidationError**
- Response data failed validation checks
- Required fields missing
- Data type mismatches

**ParseError**
- CSV parsing failed
- HTML parsing failed (VGSI)
- JSON parsing failed

### Retry Logic

**API Clients** implement exponential backoff:
```typescript
Attempt 1: Immediate
Attempt 2: 1 second delay
Attempt 3: 2 second delay
Attempt 4: 4 second delay
```

**Formula:** `delay = Math.pow(2, attempt - 1) * 1000` milliseconds

After max retries (default: 3), error is recorded and processing continues with next parcel.

### Rate Limiting

Both API clients enforce rate limiting:
```typescript
maxRequestsPerSecond: 10  // Default
minRequestInterval: 1000 / maxRequestsPerSecond  // 100ms
```

**Implementation:** Track last request timestamp, delay if too soon:
```typescript
const timeSinceLastRequest = Date.now() - lastRequestTime;
if (timeSinceLastRequest < minRequestInterval) {
  await sleep(minRequestInterval - timeSinceLastRequest);
}
```

---

## Code References

### Type Definitions
- [src/types/index.ts](../src/types/index.ts) - All TypeScript interfaces

### Data Loading
- [src/parsers/csv-parser.ts](../src/parsers/csv-parser.ts) - CSV parsing logic
- [src/parsers/csv-parser.test.ts](../src/parsers/csv-parser.test.ts) - Parser tests

### API Clients
- [src/api/mapgeo-client.ts](../src/api/mapgeo-client.ts) - Map Geo API client
- [src/api/mapgeo-client.test.ts](../src/api/mapgeo-client.test.ts) - Map Geo tests
- [src/api/vgsi-client.ts](../src/api/vgsi-client.ts) - VGSI API client with HTML parsing
- [src/api/vgsi-client.test.ts](../src/api/vgsi-client.test.ts) - VGSI tests

### Data Validation
- [src/validators/data-validator.ts](../src/validators/data-validator.ts) - All validation logic
- [src/validators/data-validator.test.ts](../src/validators/data-validator.test.ts) - Validation tests (51 test cases)

### Pipeline
- [src/pipeline/enrichment.ts](../src/pipeline/enrichment.ts) - Main enrichment pipeline
- [src/pipeline/enrichment.test.ts](../src/pipeline/enrichment.test.ts) - Pipeline integration tests

### Output
- [src/output/writer.ts](../src/output/writer.ts) - Output file generation
- [src/output/writer.test.ts](../src/output/writer.test.ts) - Output tests

### Main Entry Point
- [src/analyze.ts](../src/analyze.ts) - Main script with comprehensive documentation

### Project Documentation
- [README.md](../README.md) - Project overview and setup instructions

---

## Running the Analysis

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure Portsmouth_Parcels.csv exists in project root
```

### Execution
```bash
# Run the analysis
npx tsx src/analyze.ts

# Exit codes:
#   0 = All parcels successfully enriched
#   1 = Some parcels failed (but pipeline completed)
```

### Output
Results written to `output/` directory:
- `portsmouth_properties_full.json` - Enriched data
- `enrichment_errors.json` - Error details
- `analysis_summary.json` - Statistics

### Testing
```bash
# Run all tests
npm test

# Current test coverage: 98 tests passing
# - CSV parser: 10 tests
# - Map Geo client: 17 tests
# - VGSI client: 20 tests
# - Validators: 51 tests
# - Pipeline: Integration tests
# - Output writer: 8 tests
```

---

**Document Version:** 2.0
**Implementation Version:** TypeScript Migration (ralph/typescript-migration branch)
**Last Reviewed:** 2026-02-16
