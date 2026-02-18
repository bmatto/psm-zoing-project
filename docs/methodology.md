# Portsmouth Zoning Analysis Methodology

**Version:** 3.0 (TypeScript Implementation with Report Generation)
**Last Updated:** 2026-02-18
**Project:** Portsmouth Zoning Analysis

---

## Table of Contents

1. [Overview](#overview)
2. [Data Sources](#data-sources)
3. [Zoning Rules System](#zoning-rules-system)
4. [Data Enrichment Pipeline](#data-enrichment-pipeline)
5. [Calculations and Derived Fields](#calculations-and-derived-fields)
6. [Report Generation](#report-generation)
7. [Validation and Quality Assurance](#validation-and-quality-assurance)
8. [Output Format](#output-format)
9. [Error Handling](#error-handling)
10. [Code References](#code-references)

---

## Overview

This document describes the methodology used for collecting, enriching, and analyzing parcel data for the City of Portsmouth, NH. The system operates in two phases:

**Phase 1: Data Enrichment** - Combines information from multiple authoritative sources to create a comprehensive parcel dataset with geographic, zoning, and building data.

**Phase 2: Report Generation** - Analyzes enriched data to identify zoning violations, calculate infrastructure burden, and assess fiscal sustainability across different zoning districts.

### Technology Stack

- **Runtime**: Node.js 20+ (LTS)
- **Language**: TypeScript with strict type checking
- **Testing**: Vitest test framework
- **Data Enrichment Entry Point**: `src/analyze.ts`
- **Report Generation Entry Point**: `src/generate-reports.ts`

### Workflow

1. **Data Collection** (`npm run analyze`)
   - Load master parcel list from State GIS
   - Enrich with Map Geo API (zoning, values, ownership)
   - Enrich with VGSI API (building measurements)
   - Validate and write enriched data to JSON

2. **Analysis & Reporting** (`npm run report`)
   - Calculate zone-level metrics (land distribution, revenue)
   - Identify zoning violations (lot size, coverage, land use)
   - Calculate infrastructure burden and fiscal sustainability
   - Generate human-readable reports and structured JSON outputs

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

## Zoning Rules System

The project includes a comprehensive database of Portsmouth zoning ordinance rules that are used for violations checking and infrastructure burden analysis.

### Implementation

**Module:** `src/zoning/rules.ts`

**Source:** Portsmouth Zoning Ordinance (as amended through May 5, 2025)
- Tables 10.521 (Residential Zones)
- Tables 10.531 (Business/Industrial Zones)
- **Reference:** https://files.portsmouthnh.gov/files/planning/ZoningOrd-250505+ADOPTED.pdf

### Zoning Rules Data Structure

Each zoning district has the following dimensional requirements:

```typescript
interface ZoneRules {
  name: string;                      // Full zone name
  min_lot_size_sqft: number | null;  // Minimum lot size (square feet)
  min_frontage_ft: number | null;    // Minimum street frontage (feet)
  max_lot_coverage_pct: number | null; // Maximum building coverage (%)
  min_open_space_pct: number | null; // Minimum open space (%)
  front_setback_ft: number | null;   // Front setback requirement (feet)
  side_setback_ft: number | null;    // Side setback requirement (feet)
  rear_setback_ft: number | null;    // Rear setback requirement (feet)
  allowed_uses: LandUseType[];       // Permitted land uses
}
```

### Covered Zoning Districts

**Residential Districts:**
- `R` - Residential (5 acres, 5% max coverage)
- `SRA` - Single Residence A (1 acre, 10% max coverage)
- `SRB` - Single Residence B (15,000 sqft, 20% max coverage)
- `GRA` - General Residence A (7,500 sqft, 25% max coverage)
- `GRB` - General Residence B (5,000 sqft, 30% max coverage)
- `GRC` - General Residence C (3,500 sqft, 35% max coverage)
- `MRO` - Mixed Residential Office
- `MRB` - Mixed Residential Business
- `GA/MH` - Garden Apartment/Mobile Home Park

**Business/Commercial Districts:**
- `B` - Business
- `GB` - General Business
- `G1` - General Business 1
- `G2` - General Business 2
- `WB` - Waterfront Business
- Character Districts (CD4, CD4-L1, CD4-L2, CD4-W, CD5)
- Special Districts (ABC, AI, AIR, Civic, GW, TC)

**Industrial Districts:**
- `I` - Industrial
- `WI` - Waterfront Industrial
- `OR` - Office Research
- `LI` - Light Industrial

**Other Districts:**
- `M` - Municipal
- `NRP` - Natural Resource Protection
- `PI` - Public Institutional
- `E` - Education
- Various specialized zones

### Land Use Classification

**Function:** `classifyLandUse()`

Maps property descriptions to standardized land use types:

**Land Use Types:**
- `single_family` - Single-family residential
- `two_family` - Two-family residential
- `multi_family` - Multi-family residential, condos, apartments
- `accessory_dwelling` - Accessory dwelling units
- `commercial` - Commercial uses
- `retail` - Retail uses
- `office` - Office uses
- `industrial` - Industrial uses
- `manufacturing` - Manufacturing uses
- `municipal` - Municipal uses
- `public` - Public uses
- `mixed_use` - Mixed-use developments
- `mobile_home` - Mobile home parks
- `marine` - Marine/waterfront uses
- `research` - Research facilities
- `technology` - Technology facilities
- `conservation` - Conservation land
- `agriculture` - Agricultural uses
- `vacant` - Vacant parcels
- `other` - Other uses
- `unknown` - Unknown or unclassified

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

**Implementation:** `src/pipeline/enrichment.ts`

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

**Implementation:** `src/pipeline/enrichment.ts`

---

## Report Generation

After data enrichment completes, a separate report generation system analyzes the enriched data to produce comprehensive zoning analysis reports.

**Entry Point:** `src/generate-reports.ts`

### Report Generation Architecture

Report generation is **completely separate** from data enrichment:
- **Input:** Reads from `output/portsmouth_properties_full.json`
- **No API calls:** Works entirely with cached enriched data
- **Fast:** Generates reports in seconds without network requests
- **Repeatable:** Can re-run reports without re-fetching data

### Report Types

The system generates three types of reports that can be run individually or together:

#### 1. Zone Metrics Analysis

**Module:** `src/analysis/zone-metrics.ts`

Aggregates parcel data by zoning district to calculate:
- Total land area per zone (acres)
- Total assessed value per zone
- Revenue density (dollars per acre)
- Parcel count per zone
- Land use breakdown within each zone

**Output:** Used in comprehensive zoning report

#### 2. Zoning Violations Analysis

**Module:** `src/analysis/violations.ts`

Checks every parcel against Portsmouth zoning ordinance requirements to identify:

**Violation Types:**

1. **Undersized Lot** (Major)
   - Parcel area < minimum lot size for zone
   - Calculates deficit (how many sqft short)

2. **Excess Lot Coverage** (Major)
   - Building footprint percentage > maximum allowed
   - Calculates excess percentage over limit

3. **Incompatible Use** (Critical)
   - Current land use not permitted in zone
   - Identifies current use and allowed uses

**Analysis Output:**
- Total violations by type
- Violations grouped by zone
- Parcels with violations (with parcel IDs)
- Detailed violation descriptions

**Files Generated:**
- `violations_analysis.json` - Structured violations data
- Comprehensive report includes violations summary

**Implementation Details:**
- Uses `ZONING_RULES` from `src/zoning/rules.ts`
- Function: `checkZoningViolations()` - Validates single parcel
- Function: `analyzeViolations()` - Analyzes all parcels

#### 3. Infrastructure Burden Analysis

**Module:** `src/analysis/infrastructure-burden.ts`

Calculates the relationship between zoning density, tax revenue, and estimated municipal service costs.

**Key Insight:** Lower density zones require MORE infrastructure per capita (longer roads, utility lines, emergency service coverage) but generate LESS tax revenue per acre.

**Metrics Calculated:**

For each zone:
- Total acres and parcel count
- Average lot size (sqft and acres)
- Parcels per acre (density metric)
- Revenue per parcel
- Revenue per acre
- Estimated linear infrastructure (feet of road/utilities per parcel)
- Estimated infrastructure cost per parcel
- Density factor (inverse of parcels per acre)
- **Fiscal sustainability ratio** (revenue / infrastructure cost)

**Infrastructure Cost Estimation:**
```typescript
// Assumes $500/linear foot for roads + utilities (conservative)
estimated_cost = min_frontage_ft * 500

// For a parcel with 150ft frontage:
estimated_cost = 150 * 500 = $75,000
```

**Fiscal Sustainability Ratio:**
```typescript
fiscal_ratio = revenue_per_parcel / est_infrastructure_cost_per_parcel

// Higher is better:
// > 1.0 = Revenue exceeds infrastructure cost (fiscally positive)
// < 1.0 = Infrastructure cost exceeds revenue (fiscally negative)
```

**Aggregate Analysis:**

Compares single-family vs multi-family zones:
- **Single-family aggregate:** R, SRA, SRB zones
- **Multi-family aggregate:** GRA, GRB, GRC zones

**Files Generated:**
- `infrastructure_metrics.json` - Structured infrastructure data
- `Portsmouth_Infrastructure_Burden_[timestamp].txt` - Human-readable report

### Report Generation Modes

**Command:** `npm run report` or `npx tsx src/generate-reports.ts [options]`

**Modes:**

1. **All Reports (Default)**
   ```bash
   npm run report
   ```
   Generates:
   - Comprehensive zoning report (zone metrics + violations)
   - Infrastructure burden report
   - All JSON data files

2. **Infrastructure Only**
   ```bash
   npm run report:infrastructure
   ```
   Generates:
   - Infrastructure burden report
   - infrastructure_metrics.json

3. **Violations Only**
   ```bash
   npm run report:violations
   ```
   Generates:
   - Comprehensive zoning report (with violations)
   - violations_analysis.json

### Report Output Files

#### Comprehensive Zoning Report

**File:** `output/Portsmouth_Zoning_Report_[timestamp].txt`

**Format:** Human-readable text report

**Contents:**
1. **Header** - Report metadata and timestamp
2. **Zone Distribution** - Land area and parcel count by zone
3. **Revenue Analysis** - Total assessed value and revenue density by zone
4. **Land Use Analysis** - Breakdown of land uses within each zone
5. **Violations Summary** - Total violations by type and zone
6. **Detailed Violations** - Specific parcels with violations

**Implementation:** `src/reports/comprehensive-report.ts`

#### Infrastructure Burden Report

**File:** `output/Portsmouth_Infrastructure_Burden_[timestamp].txt`

**Format:** Human-readable text report

**Contents:**
1. **Header** - Report metadata and methodology explanation
2. **Zone Analysis** - Detailed metrics for each zone
3. **Fiscal Sustainability Rankings** - Zones ordered by fiscal ratio
4. **Single-Family vs Multi-Family Comparison** - Aggregate metrics
5. **Policy Implications** - Analysis of findings

**Implementation:** `src/reports/infrastructure-report.ts`

#### JSON Data Files

**1. violations_analysis.json**
```json
{
  "total_violations": 123,
  "total_parcels_with_violations": 98,
  "violations_by_zone": {
    "GRC": {
      "total_violations": 45,
      "undersized_lot_count": 30,
      "excess_coverage_count": 15,
      "incompatible_use_count": 0,
      "parcels_with_violations": ["123-45", "234-56"],
      "violations_by_parcel": {
        "123-45": [
          {
            "type": "undersized_lot",
            "severity": "major",
            "description": "Lot size 2800 sqft is below minimum 3500 sqft",
            "deficit": 700
          }
        ]
      }
    }
  },
  "violation_type_summary": {
    "undersized_lot": 80,
    "excess_lot_coverage": 35,
    "incompatible_use": 8
  }
}
```

**2. infrastructure_metrics.json**
```json
{
  "zones": {
    "SRA": {
      "zone_name": "Single Residence A",
      "total_acres": 1234.56,
      "parcel_count": 450,
      "total_value": 180000000,
      "avg_lot_size_sqft": 119592,
      "avg_lot_size_acres": 2.745,
      "parcels_per_acre": 0.36,
      "revenue_per_parcel": 400000,
      "revenue_per_acre": 145800,
      "min_frontage_ft": 150,
      "min_lot_size_sqft": 43560,
      "estimated_linear_infrastructure_ft": 67500,
      "est_infrastructure_cost_per_parcel": 75000,
      "density_factor": 2.747,
      "fiscal_sustainability_ratio": 5.33
    }
  },
  "single_family_aggregate": {
    "total_parcels": 1200,
    "total_acres": 3500,
    "total_revenue": 450000000,
    "revenue_per_parcel": 375000,
    "revenue_per_acre": 128571,
    "infrastructure_per_parcel": 150,
    "cost_per_parcel": 75000,
    "fiscal_ratio": 5.0
  },
  "multi_family_aggregate": {
    "total_parcels": 800,
    "total_acres": 500,
    "total_revenue": 280000000,
    "revenue_per_parcel": 350000,
    "revenue_per_acre": 560000,
    "infrastructure_per_parcel": 80,
    "cost_per_parcel": 40000,
    "fiscal_ratio": 8.75
  }
}
```

### Report Generation Workflow

1. **Read Enriched Data**
   - Load `output/portsmouth_properties_full.json`
   - Validate file format (supports both wrapped and array formats)
   - Filter out parcels with missing required fields

2. **Run Analysis Modules**
   - Calculate zone metrics (aggregation by zone)
   - Analyze violations (check against zoning rules)
   - Calculate infrastructure burden (fiscal sustainability)

3. **Generate Human-Readable Reports**
   - Format data into comprehensive text reports
   - Add timestamps and metadata
   - Write to output directory with timestamp in filename

4. **Write Structured JSON Files**
   - Export detailed analysis data as JSON
   - Enable programmatic access to results
   - Support further analysis or visualization

5. **Display Summary**
   - Show count of parcels analyzed
   - Display total violations found
   - List all generated files

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

The system generates two categories of output files in the `output/` directory:
1. **Enrichment Outputs** - Generated by `npm run analyze` (data enrichment)
2. **Report Outputs** - Generated by `npm run report` (analysis reports)

### Enrichment Output Files

Generated by the data enrichment pipeline (`src/analyze.ts`):

#### 1. portsmouth_properties_full.json

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

#### 2. enrichment_errors.json

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

#### 3. analysis_summary.json

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

### Report Output Files

Generated by the report generation system (`src/generate-reports.ts`):

#### 4. Portsmouth_Zoning_Report_[timestamp].txt

**Format:** Human-readable text report

**Purpose:** Comprehensive zoning analysis with zone metrics, land distribution, revenue analysis, and violations.

**Structure:**
```
PORTSMOUTH ZONING ANALYSIS REPORT
Generated: February 18, 2026, 10:30:45 AM
==================================================

ZONE DISTRIBUTION
--------------------------------------------------
Zone: SRA (Single Residence A)
  Total Area: 1,234.56 acres
  Parcel Count: 450
  Average Lot Size: 2.75 acres

REVENUE ANALYSIS
--------------------------------------------------
Zone: SRA
  Total Value: $180,000,000
  Revenue Density: $145,800/acre
  Revenue per Parcel: $400,000

VIOLATIONS SUMMARY
--------------------------------------------------
Total Violations: 123
Parcels Affected: 98

By Type:
  Undersized Lot: 80
  Excess Lot Coverage: 35
  Incompatible Use: 8

By Zone:
  GRC: 45 violations
  GRB: 30 violations
  ...
```

**Implementation:** `src/reports/comprehensive-report.ts` - `generateComprehensiveReport()`

#### 5. violations_analysis.json

**Format:** Structured JSON

**Purpose:** Machine-readable violations data for programmatic analysis.

**Contents:**
- Total violations count
- Total parcels with violations
- Violations grouped by zone (with parcel IDs and details)
- Violation type summary (undersized_lot, excess_coverage, incompatible_use)

See [Report Generation](#report-generation) section for detailed structure.

**Implementation:** `src/analysis/violations.ts` - `analyzeViolations()`

#### 6. Portsmouth_Infrastructure_Burden_[timestamp].txt

**Format:** Human-readable text report

**Purpose:** Infrastructure burden and fiscal sustainability analysis.

**Structure:**
```
PORTSMOUTH INFRASTRUCTURE BURDEN ANALYSIS
Generated: February 18, 2026, 10:30:45 AM
==================================================

METHODOLOGY
--------------------------------------------------
This analysis estimates the relationship between zoning
density, tax revenue, and municipal infrastructure costs.

Key assumption: $500/linear foot for roads and utilities
(conservative estimate including construction and maintenance)

ZONE ANALYSIS
--------------------------------------------------
Zone: SRA (Single Residence A)
  Parcels: 450
  Total Area: 1,234.56 acres
  Avg Lot Size: 2.75 acres (119,592 sqft)
  Min Frontage Required: 150 feet

  Revenue per Parcel: $400,000
  Revenue per Acre: $145,800

  Est. Infrastructure per Parcel: 150 ft
  Est. Cost per Parcel: $75,000

  Fiscal Sustainability Ratio: 5.33
  (Revenue is 5.33x infrastructure cost)

FISCAL SUSTAINABILITY RANKINGS
--------------------------------------------------
1. GRC: Ratio 8.75 (Most sustainable)
2. GRB: Ratio 7.20
3. GRA: Ratio 6.50
...

SINGLE-FAMILY vs MULTI-FAMILY COMPARISON
--------------------------------------------------
Single-Family Zones (R, SRA, SRB):
  Total Parcels: 1,200
  Revenue per Parcel: $375,000
  Cost per Parcel: $75,000
  Fiscal Ratio: 5.0

Multi-Family Zones (GRA, GRB, GRC):
  Total Parcels: 800
  Revenue per Parcel: $350,000
  Cost per Parcel: $40,000
  Fiscal Ratio: 8.75

Finding: Multi-family zones are more fiscally sustainable
despite lower per-parcel revenue due to shared infrastructure.
```

**Implementation:** `src/reports/infrastructure-report.ts` - `generateInfrastructureReport()`

#### 7. infrastructure_metrics.json

**Format:** Structured JSON

**Purpose:** Machine-readable infrastructure burden data.

**Contents:**
- Metrics for each zone (acres, revenue, infrastructure costs, fiscal ratios)
- Single-family aggregate metrics
- Multi-family aggregate metrics

See [Report Generation](#report-generation) section for detailed structure.

**Implementation:** `src/analysis/infrastructure-burden.ts` - `calculateInfrastructureMetrics()`

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

### Main Entry Points
- [src/analyze.ts](../src/analyze.ts) - Data enrichment entry point
- [src/generate-reports.ts](../src/generate-reports.ts) - Report generation entry point

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

### Zoning Rules System
- [src/zoning/rules.ts](../src/zoning/rules.ts) - Portsmouth zoning ordinance rules
  - Zone dimensional requirements (lot size, setbacks, coverage)
  - Land use classification system
  - Allowed uses by zone

### Analysis Modules
- [src/analysis/zone-metrics.ts](../src/analysis/zone-metrics.ts) - Zone-level aggregation
- [src/analysis/zone-metrics.test.ts](../src/analysis/zone-metrics.test.ts) - Zone metrics tests
- [src/analysis/violations.ts](../src/analysis/violations.ts) - Zoning violations checker
- [src/analysis/violations.test.ts](../src/analysis/violations.test.ts) - Violations tests
- [src/analysis/infrastructure-burden.ts](../src/analysis/infrastructure-burden.ts) - Infrastructure burden calculator
- [src/analysis/infrastructure-burden.test.ts](../src/analysis/infrastructure-burden.test.ts) - Infrastructure tests

### Report Generators
- [src/reports/comprehensive-report.ts](../src/reports/comprehensive-report.ts) - Comprehensive zoning report formatter
- [src/reports/infrastructure-report.ts](../src/reports/infrastructure-report.ts) - Infrastructure burden report formatter

### Data Validation
- [src/validators/data-validator.ts](../src/validators/data-validator.ts) - All validation logic
- [src/validators/data-validator.test.ts](../src/validators/data-validator.test.ts) - Validation tests (51 test cases)

### Pipeline
- [src/pipeline/enrichment.ts](../src/pipeline/enrichment.ts) - Main enrichment pipeline
- [src/pipeline/enrichment.test.ts](../src/pipeline/enrichment.test.ts) - Pipeline integration tests

### Output
- [src/output/writer.ts](../src/output/writer.ts) - Output file generation
- [src/output/writer.test.ts](../src/output/writer.test.ts) - Output tests

### Project Documentation
- [README.md](../README.md) - Project overview and setup instructions

---

## Running the Analysis

The analysis is run in two phases:

### Phase 1: Data Enrichment

**Command:** `npm run analyze`

**Purpose:** Collect and enrich parcel data from APIs

**Prerequisites:**
```bash
# Install dependencies
npm install

# Ensure Portsmouth_Parcels.csv exists in project root
```

**Execution:**
```bash
# Run the enrichment pipeline
npm run analyze

# Equivalent to:
npx tsx src/analyze.ts

# Exit codes:
#   0 = All parcels successfully enriched
#   1 = Some parcels failed (but pipeline completed)
```

**Output Files:**
- `output/portsmouth_properties_full.json` - Enriched parcel data
- `output/enrichment_errors.json` - Error details
- `output/analysis_summary.json` - Processing statistics

**Duration:** Varies based on parcel count and API response times (typically 5-15 minutes for ~5,000 parcels)

### Phase 2: Report Generation

**Command:** `npm run report [options]`

**Purpose:** Analyze enriched data and generate reports

**Prerequisites:**
```bash
# Must have run Phase 1 (data enrichment) first
# Requires output/portsmouth_properties_full.json
```

**Execution Options:**

```bash
# Generate all reports (default)
npm run report

# Generate infrastructure burden report only
npm run report:infrastructure

# Generate violations report only
npm run report:violations
```

**Output Files:**

**All Reports:**
- `output/Portsmouth_Zoning_Report_[timestamp].txt`
- `output/violations_analysis.json`
- `output/Portsmouth_Infrastructure_Burden_[timestamp].txt`
- `output/infrastructure_metrics.json`

**Infrastructure Only:**
- `output/Portsmouth_Infrastructure_Burden_[timestamp].txt`
- `output/infrastructure_metrics.json`

**Violations Only:**
- `output/Portsmouth_Zoning_Report_[timestamp].txt`
- `output/violations_analysis.json`

**Duration:** Fast (~1-5 seconds) - no API calls, works with cached data

### Complete Workflow Example

```bash
# 1. Install dependencies
npm install

# 2. Run data enrichment (fetches from APIs)
npm run analyze

# 3. Generate reports (analyzes cached data)
npm run report

# 4. Reports are now available in output/ directory
```

### Testing

```bash
# Run all tests
npm test

# Test with UI
npm run test:ui

# Current test coverage: 98+ tests passing
# - CSV parser: 10 tests
# - Map Geo client: 17 tests
# - VGSI client: 20 tests
# - Validators: 51 tests
# - Analysis modules: 15+ tests
# - Pipeline: Integration tests
# - Output writer: 8 tests
```

### Type Checking

```bash
# Type check all TypeScript files
npm run typecheck
```

---

## Migration History

### Previous Python Implementation (DEPRECATED)

This project was originally implemented in Python. The Python scripts have been **archived** to the `deprecated/` directory and **should not be used** for new analysis work.

**Reasons for TypeScript Migration:**
- Better type safety with strict TypeScript checking
- Faster development with modern tooling
- Comprehensive test coverage (98+ tests)
- Easier maintenance and extensibility
- Superior error handling and validation
- Report generation system separate from data collection

**Legacy Files:**
- `deprecated/*.py` - Original Python scripts (DO NOT USE)
- `deprecated/README.md` - Migration details and deprecation notice

**Current Implementation:**
- All active development uses TypeScript (`src/` directory)
- See [README.md](../README.md) for current usage instructions
- This methodology document reflects the TypeScript implementation only

---

**Document Version:** 3.0
**Implementation Version:** TypeScript with Report Generation
**Last Reviewed:** 2026-02-18
