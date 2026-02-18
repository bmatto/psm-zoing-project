# Portsmouth Zoning Analysis

Zoning analysis for the City of Portsmouth, NH, combining data from multiple authoritative sources to create an accurate, validated parcel dataset.

## Overview

This project collects, enriches, and analyzes parcel data for Portsmouth by:
1. Loading parcel records from State GIS database (Portsmouth_Parcels.csv)
2. Enriching with geographic and zoning data from Map Geo API
3. Adding building details from VGSI API
4. Validating data quality at every stage
5. Generating comprehensive reports with error tracking

## Quick Start

### Prerequisites

- Node.js 20+ (LTS)
- Portsmouth_Parcels.csv in project root

### Installation

```bash
npm install
```

### Run Analysis

```bash
npm run analyze
```

The analysis will:
- Load parcels from Portsmouth_Parcels.csv
- Enrich with Map Geo API (geographic/zoning data)
- Enrich with VGSI API (building details)
- Validate data quality
- Write results to `output/` directory

### Generate Reports

After enriching the data, generate analysis reports:

```bash
# Generate all reports (comprehensive + infrastructure)
npm run report

# Generate infrastructure burden report only
npm run report:infrastructure

# Generate violations report only
npm run report:violations
```

Reports are generated from the enriched data in `output/portsmouth_properties_full.json` without re-fetching from APIs. Generated files:
- `Portsmouth_Zoning_Report_[timestamp].txt` - Comprehensive analysis with land distribution, revenue, and violations
- `violations_analysis.json` - Structured violations data
- `Portsmouth_Infrastructure_Burden_[timestamp].txt` - Infrastructure burden and fiscal sustainability analysis
- `infrastructure_metrics.json` - Structured infrastructure metrics

### Run Tests

```bash
npm test
```

Current test coverage: **98+ tests passing**

### Type Checking

```bash
npm run typecheck
```

## Project Structure

```
zoning-project/
├── src/                          # TypeScript source code
│   ├── analyze.ts               # Main entry point
│   ├── types/                   # Type definitions
│   │   └── index.ts            # All TypeScript interfaces
│   ├── parsers/                 # Data parsing
│   │   ├── csv-parser.ts       # CSV loading logic
│   │   └── csv-parser.test.ts  # Parser tests
│   ├── api/                     # External API clients
│   │   ├── mapgeo-client.ts    # Map Geo API client
│   │   ├── mapgeo-client.test.ts
│   │   ├── vgsi-client.ts      # VGSI API client (HTML parsing)
│   │   └── vgsi-client.test.ts
│   ├── validators/              # Data validation
│   │   ├── data-validator.ts   # All validation logic
│   │   └── data-validator.test.ts
│   ├── pipeline/                # Enrichment pipeline
│   │   ├── enrichment.ts       # Parallel processing
│   │   └── enrichment.test.ts
│   └── output/                  # Output generation
│       ├── writer.ts            # File writing
│       └── writer.test.ts
├── output/                       # Generated analysis files
│   ├── portsmouth_properties_full.json
│   ├── enrichment_errors.json
│   └── analysis_summary.json
├── docs/                         # Documentation
│   └── methodology.md           # Complete methodology
├── deprecated/                   # Old Python scripts (DO NOT USE)
│   ├── README.md               # Migration status
│   └── *.py                    # Archived Python files
├── Portsmouth_Parcels.csv       # Master parcel list (State GIS)
├── package.json                 # Node.js dependencies
├── tsconfig.json               # TypeScript configuration
└── vitest.config.ts            # Test configuration
```

## Data Sources

### 1. Portsmouth_Parcels.csv
- **Source**: State of New Hampshire GIS Database
- **Role**: Master parcel list (authoritative source)
- **Location**: Project root

### 2. Map Geo API
- **Endpoint**: `https://portsmouthnh.mapgeo.io/api/ui/datasets/properties/{parcelId}`
- **Provides**: Zoning codes, land use, property values, ownership, account numbers
- **Status**: Required for enrichment

### 3. VGSI API
- **Endpoint**: `http://gis.vgsi.com/PortsmouthNH/Parcel.aspx?Pid={accountNumber}`
- **Provides**: Building footprints, living area, detailed lot information
- **Status**: Optional (not all parcels have buildings)
- **Format**: HTML pages (requires parsing)

## Output Files

The analysis generates three files in the `output/` directory:

### 1. portsmouth_properties_full.json
Successfully enriched parcels with complete data:
```json
{
  "metadata": {
    "description": "Portsmouth parcel data enriched from multiple sources",
    "generated_at": "2026-02-16T12:00:00.000Z",
    "parcel_count": 1234,
    "data_sources": [...]
  },
  "parcels": [
    {
      "parcel_id": "123-45",
      "address": "123 Main St",
      "zoning": "GR-1",
      "total_value": 450000,
      "parcel_area_acres": 0.25,
      "building_footprint_sqft": 1800,
      "lot_coverage_pct": 16.53,
      ...
    }
  ]
}
```

### 2. enrichment_errors.json
Failed parcels with error details grouped by type and stage

### 3. analysis_summary.json
Processing statistics and metadata

## Documentation

- **[docs/methodology.md](docs/methodology.md)** - Complete methodology documentation
  - Data sources and API endpoints
  - Enrichment pipeline (5 stages)
  - Calculation methodologies
  - Validation rules
  - Output format specifications
  - Error handling strategies

## Development

### Running the Analysis

```bash
# Run with npx
npx tsx src/analyze.ts

# Exit codes:
#   0 = All parcels successfully enriched
#   1 = Some parcels failed (but pipeline completed)
```

### Running Tests

```bash
# All tests
npm test

# Watch mode
npm test -- --watch

# Specific test file
npm test -- src/parsers/csv-parser.test.ts
```

### Type Checking

```bash
# Check all TypeScript files
npm run typecheck

# Equivalent to:
npx tsc --noEmit
```

## Testing

The project has comprehensive test coverage:

- **CSV Parser**: 10 tests (UTF-8 BOM, validation, error handling)
- **Map Geo Client**: 17 tests (API calls, retries, rate limiting, validation)
- **VGSI Client**: 20 tests (HTML parsing, retries, rate limiting)
- **Validators**: 51 tests (all validation rules, edge cases)
- **Pipeline**: Integration tests (parallel processing, error tracking)
- **Output Writer**: 8 tests (file generation, validation)

**Total: 98+ tests passing**

## Configuration

The enrichment pipeline can be configured in `src/analyze.ts`:

```typescript
const pipeline = new EnrichmentPipeline({
  batchSize: 5,              // Concurrent parcel processing
  maxRequestsPerSecond: 10,  // API rate limiting
  maxRetries: 3              // Retry attempts for failures
});
```

## Error Handling

The system implements comprehensive error handling:

- **Retry Logic**: Exponential backoff (1s, 2s, 4s delays)
- **Rate Limiting**: Configurable requests per second
- **Validation**: Multi-stage validation with detailed error messages
- **Tracking**: Every parcel is either enriched OR has an error record
- **Reporting**: Errors grouped by type and stage for analysis

## Migration from Python

This project was originally implemented in Python. The Python scripts have been archived to the `deprecated/` directory and **should not be used for new analysis**.

See [deprecated/README.md](deprecated/README.md) for migration details and why the TypeScript implementation is preferred.

## Contributing

When working on this project:

1. Read [docs/methodology.md](docs/methodology.md) for technical details
2. Run tests before committing: `npm test`
3. Run typecheck before committing: `npm run typecheck`
4. Follow existing code patterns (see `src/` for examples)

## License

This project is for the City of Portsmouth, NH zoning analysis.

## Questions?

- **Methodology**: See [docs/methodology.md](docs/methodology.md)
