# PRD: Node.js/TypeScript Migration for Portsmouth Zoning Analysis

## Introduction

Migrate the Portsmouth zoning analysis project from Python to Node.js/TypeScript to improve maintainability, tooling, and developer experience. The project currently uses Python scripts to collect parcel data from state GIS databases and enrich it with Map Geo and VGSI APIs. This migration will adopt modern TypeScript tooling while maintaining data accuracy, thoroughness in parcel processing, and certainty in data enrichment.

## Goals

- Complete big-bang migration of all Python scripts to TypeScript
- Establish modern Node.js development environment with tsx and vitest
- Reorganize project structure with clear separation of source, output, and configuration
- Maintain or improve data accuracy and processing performance
- Create comprehensive documentation of methodology and calculations
- Ensure well-commented codebase for future maintenance

## User Stories

### US-001: Setup TypeScript project infrastructure
**Description:** As a developer, I need a properly configured TypeScript project so I can write type-safe code with modern tooling.

**Acceptance Criteria:**
- [ ] package.json created with Node.js LTS compatibility
- [ ] tsconfig.json configured with strict type checking
- [ ] tsx installed as TypeScript runner
- [ ] vitest installed and configured for testing
- [ ] src/ directory created for source code
- [ ] output/ directory created for analysis results
- [ ] .gitignore updated to exclude node_modules/ and output/
- [ ] Typecheck passes with `npx tsc --noEmit`

### US-002: Define TypeScript types for data models
**Description:** As a developer, I need TypeScript interfaces for parcels and API responses so data structures are type-safe throughout the application.

**Acceptance Criteria:**
- [ ] ParcelRecord interface matching Portsmouth_Parcels.csv structure
- [ ] MapGeoResponse interface for Map Geo API responses
- [ ] VGSIResponse interface for VGSI API responses
- [ ] EnrichedParcel interface for combined data structure
- [ ] APIError and ValidationError types for error handling
- [ ] All types exported from src/types/index.ts
- [ ] Typecheck passes

### US-003: Implement CSV parsing for parcel data
**Description:** As a developer, I need to read and parse Portsmouth_Parcels.csv so the system can load the master parcel list.

**Acceptance Criteria:**
- [ ] CSV parser reads Portsmouth_Parcels.csv
- [ ] Returns typed ParcelRecord[] array
- [ ] Validates required fields (parcel ID, location)
- [ ] Logs count of loaded parcels
- [ ] Throws descriptive error if file missing or malformed
- [ ] Unit test verifies parsing with sample CSV
- [ ] Typecheck passes

### US-004: Create Map Geo API client
**Description:** As a developer, I need a client for the Map Geo API so I can fetch geographic data for parcels.

**Acceptance Criteria:**
- [ ] MapGeoClient class with typed methods
- [ ] Fetches geographic data for a parcel ID
- [ ] Returns typed MapGeoResponse
- [ ] Implements error handling with retries (3 attempts)
- [ ] Hard-coded rate limiting (configurable max requests/second)
- [ ] Validates API responses match expected schema
- [ ] Unit test with mocked API responses
- [ ] Typecheck passes

### US-005: Create VGSI API client
**Description:** As a developer, I need a client for the VGSI API so I can fetch property assessment and lot information.

**Acceptance Criteria:**
- [ ] VGSIClient class with typed methods
- [ ] Fetches property data using VGSI_BASE_URL pattern
- [ ] Returns typed VGSIResponse
- [ ] Implements error handling with retries (3 attempts)
- [ ] Hard-coded rate limiting (configurable max requests/second)
- [ ] Validates parcel ID in response matches request
- [ ] Unit test with mocked API responses
- [ ] Typecheck passes

### US-006: Implement parallel data enrichment pipeline
**Description:** As a developer, I need to process parcels in parallel so large datasets are processed efficiently.

**Acceptance Criteria:**
- [ ] Processes parcels concurrently (configurable batch size)
- [ ] Enriches each parcel with Map Geo and VGSI data
- [ ] Combines data into EnrichedParcel objects
- [ ] Tracks success/failure for each parcel
- [ ] Logs progress (X of Y parcels processed)
- [ ] Returns array of enriched parcels + error report
- [ ] Integration test validates pipeline with sample data
- [ ] Typecheck passes

### US-007: Implement data validation logic
**Description:** As a developer, I need validation to ensure data quality so the analysis is accurate and reliable.

**Acceptance Criteria:**
- [ ] Validates parcel ID present and non-empty
- [ ] Validates geographic coordinates within Portsmouth bounds
- [ ] Validates required fields in API responses
- [ ] Checks for data type mismatches
- [ ] Returns validation errors with parcel ID and field name
- [ ] Well-commented validation rules
- [ ] Unit tests for each validation rule
- [ ] Typecheck passes

### US-008: Create main analysis script with comprehensive comments
**Description:** As a developer, I need a well-commented main script so the data collection and analysis logic is clear and maintainable.

**Acceptance Criteria:**
- [ ] src/analyze.ts as main entry point
- [ ] Comments explain each stage of the pipeline
- [ ] Comments document API interactions
- [ ] Comments explain calculation methodologies
- [ ] Comments describe data validation logic
- [ ] Comments clarify error handling strategies
- [ ] Executable via `npx tsx src/analyze.ts`
- [ ] Typecheck passes

### US-009: Implement output generation
**Description:** As a developer, I need to write enriched data to the output directory so results are available for analysis.

**Acceptance Criteria:**
- [ ] Writes enriched parcels to output/portsmouth_properties_full.json
- [ ] Writes error report to output/enrichment_errors.json
- [ ] Writes summary statistics to output/analysis_summary.json
- [ ] Creates output/ directory if it doesn't exist
- [ ] Includes timestamp in output files
- [ ] Validates output count matches input count (all parcels accounted for)
- [ ] Typecheck passes

### US-010: Create methodology documentation
**Description:** As a developer, I need comprehensive methodology documentation so the data sources, calculations, and validation approach are clearly documented.

**Acceptance Criteria:**
- [ ] docs/methodology.md created in repository
- [ ] Documents all data sources (State GIS, Map Geo API, VGSI API)
- [ ] Explains data enrichment pipeline step-by-step
- [ ] Details specific calculation approaches
- [ ] Describes validation and quality assurance steps
- [ ] Documents output format specifications
- [ ] Includes example data structures
- [ ] Links to relevant code sections

### US-011: Archive Python scripts
**Description:** As a developer, I need the old Python scripts archived so they're available for reference but clearly deprecated.

**Acceptance Criteria:**
- [ ] deprecated/ folder created at project root
- [ ] analyze_parallel.py moved to deprecated/
- [ ] All other Python scripts moved to deprecated/
- [ ] deprecated/README.md explains migration status
- [ ] deprecated/README.md links to new TypeScript implementation
- [ ] Main README.md updated to reference new src/ structure

### US-012: Create test suite for critical paths
**Description:** As a developer, I need tests for critical functionality so data accuracy is validated automatically.

**Acceptance Criteria:**
- [ ] Tests for CSV parsing with sample data
- [ ] Tests for API client error handling
- [ ] Tests for data validation rules
- [ ] Tests for parcel count reconciliation
- [ ] Tests run via `npm test`
- [ ] All tests passing
- [ ] Typecheck passes

### US-013: Update project documentation
**Description:** As a developer, I need updated README and setup instructions so the new TypeScript project is easy to understand and run.

**Acceptance Criteria:**
- [ ] README.md updated with Node.js setup instructions
- [ ] Installation steps (npm install)
- [ ] Running instructions (npx tsx src/analyze.ts)
- [ ] Testing instructions (npm test)
- [ ] Documents new src/ and output/ structure
- [ ] Links to docs/methodology.md
- [ ] References CLAUDE.md for project principles

## Functional Requirements

### Project Structure
- FR-1: All TypeScript source code must reside in src/ directory
- FR-2: All analysis outputs must be written to output/ directory
- FR-3: Configuration files (tsconfig.json, package.json) must be at project root
- FR-4: Python scripts must be moved to deprecated/ folder

### Technology Stack
- FR-5: Project must use Node.js LTS version (v20+)
- FR-6: Project must use TypeScript with strict type checking
- FR-7: Scripts must be executable via tsx runner (npx tsx src/analyze.ts)
- FR-8: Tests must use vitest framework

### Data Processing
- FR-9: System must read Portsmouth_Parcels.csv as authoritative parcel source
- FR-10: System must enrich parcels with Map Geo API geographic data
- FR-11: System must enrich parcels with VGSI API property assessment data
- FR-12: System must process parcels in parallel for efficiency
- FR-13: System must implement rate limiting for API calls (hard-coded limits)
- FR-14: System must validate all API responses before incorporation
- FR-15: System must verify enriched data matches correct parcel ID
- FR-16: System must implement retry logic (3 attempts) for API failures

### Data Quality
- FR-17: System must validate parcel IDs are present and non-empty
- FR-18: System must validate geographic coordinates are within Portsmouth bounds
- FR-19: System must validate required fields in all API responses
- FR-20: System must track and report all validation failures
- FR-21: System must ensure all input parcels are accounted for in output or error report

### Output
- FR-22: System must write enriched parcels to output/portsmouth_properties_full.json
- FR-23: System must write error report to output/enrichment_errors.json
- FR-24: System must write summary statistics to output/analysis_summary.json
- FR-25: Output files must include timestamps

### Code Quality
- FR-26: Main analyze script must include comprehensive inline comments
- FR-27: Comments must explain data source interactions
- FR-28: Comments must explain API response handling
- FR-29: Comments must explain calculation methodologies
- FR-30: Comments must explain data validation logic
- FR-31: Comments must explain error handling strategies

### Documentation
- FR-32: docs/methodology.md must document all data sources
- FR-33: docs/methodology.md must explain specific calculation approaches
- FR-34: docs/methodology.md must describe data enrichment pipeline
- FR-35: docs/methodology.md must detail validation and QA steps
- FR-36: docs/methodology.md must specify output formats

### Testing
- FR-37: Test suite must cover CSV parsing functionality
- FR-38: Test suite must cover API client error handling
- FR-39: Test suite must cover data validation rules
- FR-40: Test suite must verify parcel count reconciliation
- FR-41: All tests must be executable via npm test

## Non-Goals (Out of Scope)

- No changes to data sources or APIs (continue using existing State GIS, Map Geo, VGSI)
- No changes to analysis methodology or calculations (maintain compatibility)
- No new features beyond migration (feature parity only)
- No migration to cloud infrastructure or serverless architecture
- No real-time processing or streaming capabilities
- No web interface or visualization tools
- No database storage (continue using JSON file output)
- No incremental migration (big bang approach chosen)
- No maintaining Python scripts long-term (archive only)

## Technical Considerations

### Dependencies
- Use csv-parse or papaparse for CSV parsing
- Use node-fetch or axios for HTTP requests
- Use p-limit or similar for parallel processing with concurrency control
- Use zod or joi for runtime schema validation

### Type Safety
- Enable strict mode in tsconfig.json
- Use interfaces for all data structures
- Validate API responses at runtime (don't trust external data)
- Prefer explicit types over `any`

### Error Handling
- Use try-catch blocks around all API calls
- Implement exponential backoff for retries
- Log errors with context (parcel ID, API endpoint, error message)
- Never silently ignore errors
- Generate comprehensive error reports

### Performance
- Process parcels in batches to manage memory
- Implement rate limiting to respect API constraints
- Use streaming for large file operations if needed
- Monitor and log processing time

### Code Organization
```
zoning-project/
├── src/
│   ├── types/           # TypeScript interfaces
│   ├── clients/         # API clients (MapGeo, VGSI)
│   ├── parsers/         # CSV parsing
│   ├── validators/      # Data validation
│   ├── pipeline/        # Enrichment pipeline
│   ├── analyze.ts       # Main entry point
│   └── utils/           # Shared utilities
├── output/              # Analysis results (gitignored)
├── docs/
│   └── methodology.md   # Methodology documentation
├── tests/               # Vitest test files
├── deprecated/          # Archived Python scripts
├── Portsmouth_Parcels.csv
├── package.json
├── tsconfig.json
└── README.md
```

## Success Metrics

- All parcels from Portsmouth_Parcels.csv are processed (100% coverage)
- Output data is identical or improved compared to Python version
- Processing time is equal to or better than Python version
- Zero silent failures (all errors logged and reported)
- TypeScript compilation succeeds with zero errors
- All critical path tests passing
- Documentation is complete and clear
- Code is well-commented and maintainable

## Open Questions

- Should we add progress bar/spinner for long-running operations?
- Should we implement caching for API responses to avoid redundant calls?
- Should we add CLI arguments for configuration (input file, output directory)?
- Should we generate additional output formats (CSV, Excel)?
- Should we include data quality metrics in the summary output?
- Should we set up CI/CD pipeline for automated testing?
