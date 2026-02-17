# PRD: Zoning Analysis and Reporting Features

## Introduction

Complete the Python-to-TypeScript migration by porting the zoning analysis and reporting functionality. The Node.js implementation currently handles data collection and enrichment but lacks the analysis layer that generates comprehensive zoning reports, violation analysis, and infrastructure burden assessments.

This feature will enable users to run fast, repeatable analysis on previously-enriched data without re-fetching from APIs, improving iteration speed and separating concerns between data collection and analysis.

## Goals

- Port all Python analysis functionality to TypeScript with improved formatting
- Maintain complete separation between enrichment (slow, API calls) and analysis (fast, file I/O)
- Enable running analysis multiple times on the same enriched dataset
- Generate comprehensive text reports with additional insights beyond Python version
- Provide modular architecture for adding 2-3 future report types
- Handle data quality issues gracefully without failing entire analysis

## User Stories

### US-001: Port zoning rules to TypeScript
**Description:** As a developer, I need Portsmouth zoning rules defined in TypeScript so the analysis can validate parcels against dimensional requirements.

**Acceptance Criteria:**
- [ ] Create `src/zoning/rules.ts` with all zone definitions from Python
- [ ] Include dimensional requirements (lot size, coverage, setbacks, frontage)
- [ ] Include allowed uses per zone
- [ ] Export `ZONING_RULES` constant and `classifyLandUse()` helper function
- [ ] Export TypeScript interfaces for `ZoneRules` and `LandUseType`
- [ ] Typecheck passes

### US-002: Create zone metrics calculator
**Description:** As a developer, I need to calculate zone-level metrics so reports can show land distribution and revenue analysis.

**Acceptance Criteria:**
- [ ] Create `src/analysis/zone-metrics.ts`
- [ ] Calculate total acres per zone
- [ ] Calculate total property value per zone
- [ ] Calculate revenue density (value per acre)
- [ ] Calculate parcel count per zone
- [ ] Group land uses within each zone
- [ ] Identify most revenue-dense zone
- [ ] Export `calculateZoneMetrics()` function
- [ ] Typecheck passes

### US-003: Create zoning violations checker
**Description:** As an analyst, I want to check parcels for zoning violations so I can identify non-conforming properties.

**Acceptance Criteria:**
- [ ] Create `src/analysis/violations.ts`
- [ ] Check for undersized lots (below minimum lot size)
- [ ] Check for excess lot coverage (above maximum coverage)
- [ ] Check for incompatible land uses (not in allowed uses list)
- [ ] Return violation objects with type, severity, description, and deficit/excess
- [ ] Export `checkZoningViolations()` function
- [ ] Export `analyzeViolations()` function that processes all parcels
- [ ] Skip parcels with missing required fields and log them
- [ ] Typecheck passes

### US-004: Create infrastructure burden calculator
**Description:** As a policy analyst, I want to calculate infrastructure burden per zone so I can assess fiscal sustainability.

**Acceptance Criteria:**
- [ ] Create `src/analysis/infrastructure-burden.ts`
- [ ] Calculate estimated linear infrastructure per parcel (based on frontage)
- [ ] Calculate infrastructure cost estimates ($500/linear foot)
- [ ] Calculate fiscal sustainability ratio (revenue ÷ infrastructure cost)
- [ ] Calculate density factors (parcels per acre)
- [ ] Compare single-family zones (R, SRA, SRB) vs multi-family zones (GRA, GRB, GRC)
- [ ] Export `calculateInfrastructureMetrics()` function
- [ ] Typecheck passes

### US-005: Create comprehensive report generator
**Description:** As a user, I want to generate a comprehensive zoning report so I can understand land use patterns and violations.

**Acceptance Criteria:**
- [ ] Create `src/reports/comprehensive-report.ts`
- [ ] Generate text report with land distribution section
- [ ] Generate text report with tax revenue analysis section
- [ ] Generate text report with violations analysis section (improved formatting from Python)
- [ ] Include summary statistics at end of report
- [ ] Add visual separators and improved readability
- [ ] Export `generateComprehensiveReport()` function returning string
- [ ] Typecheck passes

### US-006: Create infrastructure report generator
**Description:** As a user, I want to generate an infrastructure burden report so I can assess fiscal impacts of zoning decisions.

**Acceptance Criteria:**
- [ ] Create `src/reports/infrastructure-report.ts`
- [ ] Generate text report with infrastructure burden per zone
- [ ] Include fiscal sustainability ratios
- [ ] Include single-family vs multi-family comparison section
- [ ] Include key findings section with interpretations
- [ ] Add methodology notes section
- [ ] Export `generateInfrastructureReport()` function returning string
- [ ] Typecheck passes

### US-007: Create main report generation script
**Description:** As a user, I want to run report generation from the CLI so I can analyze enriched data without re-running enrichment.

**Acceptance Criteria:**
- [ ] Create `src/generate-reports.ts` as main entry point
- [ ] Read enriched parcels from `output/portsmouth_properties_full.json`
- [ ] Call zone metrics calculator
- [ ] Call violations analyzer
- [ ] Call infrastructure burden calculator
- [ ] Call report generators
- [ ] Write comprehensive report to `output/Portsmouth_Zoning_Report_[timestamp].txt`
- [ ] Write violations JSON to `output/violations_analysis.json`
- [ ] Write infrastructure report to `output/Portsmouth_Infrastructure_Burden_[timestamp].txt`
- [ ] Write infrastructure JSON to `output/infrastructure_metrics.json`
- [ ] Handle missing enriched data file gracefully with clear error message
- [ ] Skip parcels with missing required fields and log count
- [ ] Print summary of reports generated
- [ ] Typecheck passes

### US-008: Add npm scripts for report generation
**Description:** As a user, I want convenient npm commands so I can generate reports easily.

**Acceptance Criteria:**
- [ ] Add `"report": "tsx src/generate-reports.ts"` to package.json scripts
- [ ] Add `"report:infrastructure": "tsx src/generate-reports.ts --infrastructure-only"` to package.json scripts
- [ ] Add `"report:violations": "tsx src/generate-reports.ts --violations-only"` to package.json scripts
- [ ] Update CLI flag handling in `src/generate-reports.ts` to support `--infrastructure-only` and `--violations-only`
- [ ] Update README.md with new npm scripts
- [ ] Typecheck passes

### US-009: Add unit tests for calculations
**Description:** As a developer, I want unit tests for core calculation logic so I can ensure accuracy.

**Acceptance Criteria:**
- [ ] Create `src/analysis/zone-metrics.test.ts` with tests for revenue calculations
- [ ] Create `src/analysis/violations.test.ts` with tests for violation detection
- [ ] Create `src/analysis/infrastructure-burden.test.ts` with tests for fiscal ratio calculations
- [ ] Test edge cases (missing data, zero values, invalid zones)
- [ ] All tests pass
- [ ] Typecheck passes

## Functional Requirements

**Data Loading:**
- FR-1: The system must read enriched parcel data from `output/portsmouth_properties_full.json`
- FR-2: The system must gracefully handle missing or corrupted enriched data file with clear error message
- FR-3: The system must skip parcels with missing required fields (zoning, parcel_area_sqft, etc.) and report count

**Zoning Rules:**
- FR-4: The system must define all Portsmouth zoning districts from the official ordinance
- FR-5: The system must include dimensional requirements: min lot size, max coverage, setbacks, frontage
- FR-6: The system must define allowed land uses for each zone

**Zone Metrics Calculation:**
- FR-7: The system must calculate total acres per zone
- FR-8: The system must calculate total property value per zone
- FR-9: The system must calculate revenue density (dollars per acre) per zone
- FR-10: The system must calculate parcel count per zone
- FR-11: The system must identify the most revenue-dense zone

**Violation Detection:**
- FR-12: The system must check each parcel's lot size against zone minimum
- FR-13: The system must check each parcel's lot coverage against zone maximum (when VGSI data available)
- FR-14: The system must check each parcel's land use against allowed uses for its zone
- FR-15: The system must classify violations by severity (major, critical)
- FR-16: The system must track violation counts by zone and by type

**Infrastructure Burden Analysis:**
- FR-17: The system must estimate linear infrastructure per parcel based on minimum frontage requirements
- FR-18: The system must calculate infrastructure cost at $500/linear foot
- FR-19: The system must calculate fiscal sustainability ratio (revenue ÷ infrastructure cost)
- FR-20: The system must compare single-family zones (R, SRA, SRB) vs multi-family zones (GRA, GRB, GRC)
- FR-21: The system must calculate net fiscal impact per parcel

**Report Generation:**
- FR-22: The system must generate comprehensive text report with land distribution, revenue analysis, and violations
- FR-23: The system must generate infrastructure burden text report with fiscal sustainability analysis
- FR-24: The system must include timestamps in all report filenames
- FR-25: The system must improve formatting over Python version (better visual separators, clearer sections)
- FR-26: The system must add new insights: most revenue-dense zone, net fiscal impact comparisons

**Output Files:**
- FR-27: The system must write comprehensive report to `output/Portsmouth_Zoning_Report_[timestamp].txt`
- FR-28: The system must write violations data to `output/violations_analysis.json`
- FR-29: The system must write infrastructure report to `output/Portsmouth_Infrastructure_Burden_[timestamp].txt`
- FR-30: The system must write infrastructure metrics to `output/infrastructure_metrics.json`

**CLI Commands:**
- FR-31: `npm run report` must generate all reports
- FR-32: `npm run report:infrastructure` must generate infrastructure report only
- FR-33: `npm run report:violations` must generate violations report only

**Error Handling:**
- FR-34: The system must continue processing when individual parcels have missing data
- FR-35: The system must log count of skipped parcels in console output
- FR-36: The system must include skipped parcel count in report summary

## Non-Goals

- No web UI or interactive report viewer (CLI only)
- No real-time analysis during enrichment (must be separate process)
- No report customization or filtering by zone/date (future enhancement)
- No automatic email/notification of reports (future enhancement)
- No database storage of analysis results (file-based output only)
- No comparison across multiple time periods (single snapshot analysis)
- No GIS/mapping visualization (text reports only)
- No PDF export (text and JSON only)

## Design Considerations

### Module Structure
```
src/
├── zoning/
│   └── rules.ts              # Zone definitions and dimensional requirements
├── analysis/
│   ├── zone-metrics.ts        # Land distribution and revenue calculations
│   ├── violations.ts          # Zoning violation detection
│   └── infrastructure-burden.ts # Fiscal sustainability analysis
├── reports/
│   ├── comprehensive-report.ts # Main zoning report generator
│   └── infrastructure-report.ts # Infrastructure burden report generator
└── generate-reports.ts        # CLI entry point
```

### Data Flow
1. User runs `npm run analyze` → generates `output/portsmouth_properties_full.json` (slow)
2. User runs `npm run report` → reads JSON, generates reports (fast)
3. User can re-run `npm run report` multiple times without re-enriching data

### Report Format Improvements
- Add clear visual separators (`===` and `---`)
- Use consistent indentation for hierarchical data
- Add summary boxes for key findings
- Include interpretation text for complex metrics
- Use color-coded symbols (✓, ⚠, ✗) for status indicators

## Technical Considerations

### Dependencies
- No new dependencies required (use existing TypeScript, Node.js fs module)
- Reuse existing type definitions from `src/types/index.ts`

### Type Safety
- All zone rules must be strongly typed
- All metrics must have explicit return types
- Use discriminated unions for violation types

### Error Handling Strategy
- **Tolerant**: Skip parcels with missing required fields
- Log skipped parcel count to console
- Include skipped count in report summary
- Do NOT fail entire analysis for individual parcel errors

### Performance
- Analysis should complete in < 5 seconds for 3,000 parcels
- Use efficient loops, avoid nested iterations where possible
- Read enriched JSON once, pass data to analysis functions

### Modularity
- Each analysis module should export pure functions
- Report generators should accept calculated metrics as input
- Design for easy addition of 2-3 future report types:
  - Density gradient analysis
  - Affordable housing analysis
  - Environmental impact assessment

### Testing Strategy
- Unit tests for calculation functions (zone metrics, violations, infrastructure)
- Test with sample data (5-10 parcels with known expected outputs)
- Test edge cases: missing fields, zero values, invalid zones
- No integration tests needed (simple file I/O)

## Success Metrics

- All Python report functionality successfully ported to TypeScript
- Analysis runs independently from enrichment process
- Reports generated in < 5 seconds for full Portsmouth dataset
- Zero data loss: all parcels accounted for (enriched + skipped)
- Improved readability: reports easier to interpret than Python version
- Unit tests achieve >80% coverage of calculation functions
- npm scripts work correctly and print clear success messages

## Open Questions

1. Should we add a `--output-dir` flag to customize output location?
2. Should we generate a single combined JSON with all analysis data?
3. Should we include comparison to previous runs if historical data exists?
4. Should violation severity levels be configurable (e.g., adjust thresholds)?
5. Should we add a `--verbose` flag for detailed logging during analysis?

---

**Next Steps:**
1. Review PRD with stakeholders
2. Confirm Python report output format requirements
3. Begin implementation with US-001 (port zoning rules)
4. Iterate on report formatting based on initial output
