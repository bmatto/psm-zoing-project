/**
 * Output Writer for Portsmouth Zoning Analysis
 *
 * This module handles writing enriched parcel data, error reports, and
 * analysis summaries to the output directory. All output files include
 * timestamps for tracking when data was collected.
 *
 * Output Files:
 * - portsmouth_properties_full.json: Successfully enriched parcels
 * - enrichment_errors.json: Failed parcels with error details
 * - analysis_summary.json: Statistics and metadata about the run
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';
import type { EnrichedParcel, APIError, EnrichmentSummary } from '../types/index.js';
import type { LoadParcelsResult } from '../parsers/csv-parser.js';

/**
 * Ensure output directory exists
 * Creates the directory if it doesn't exist
 */
function ensureOutputDirectory(): string {
  const outputDir = resolve(process.cwd(), 'output');

  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  return outputDir;
}

/**
 * Write enriched parcels to JSON file
 *
 * @param parcels - Array of successfully enriched parcels
 * @param outputDir - Directory to write file to
 * @returns Path to written file
 */
export function writeEnrichedParcels(parcels: EnrichedParcel[], outputDir: string): string {
  const filePath = resolve(outputDir, 'portsmouth_properties_full.json');

  const output = {
    metadata: {
      description: 'Portsmouth parcel data enriched from State GIS, Map Geo API, and VGSI API',
      generated_at: new Date().toISOString(),
      parcel_count: parcels.length,
      data_sources: [
        'Portsmouth_Parcels.csv (State GIS)',
        'Map Geo API (portsmouthnh.mapgeo.io)',
        'VGSI API (gis.vgsi.com)',
      ],
    },
    parcels,
  };

  writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');

  return filePath;
}

/**
 * Write error report to JSON file
 *
 * @param errors - Array of API errors and failures
 * @param outputDir - Directory to write file to
 * @returns Path to written file
 */
export function writeErrorReport(errors: APIError[], outputDir: string): string {
  const filePath = resolve(outputDir, 'enrichment_errors.json');

  // Group errors by type and stage for easier analysis
  const errorsByType = new Map<string, APIError[]>();
  const errorsByStage = new Map<string, APIError[]>();

  for (const error of errors) {
    // Group by error type
    if (!errorsByType.has(error.error_type)) {
      errorsByType.set(error.error_type, []);
    }
    errorsByType.get(error.error_type)!.push(error);

    // Group by stage
    if (!errorsByStage.has(error.stage)) {
      errorsByStage.set(error.stage, []);
    }
    errorsByStage.get(error.stage)!.push(error);
  }

  const output = {
    metadata: {
      description: 'Errors encountered during parcel enrichment pipeline',
      generated_at: new Date().toISOString(),
      total_errors: errors.length,
    },
    summary: {
      by_type: Object.fromEntries(
        Array.from(errorsByType.entries()).map(([type, errs]) => [type, errs.length])
      ),
      by_stage: Object.fromEntries(
        Array.from(errorsByStage.entries()).map(([stage, errs]) => [stage, errs.length])
      ),
    },
    errors,
  };

  writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');

  return filePath;
}

/**
 * Write malformed CSV rows to JSON file
 *
 * @param malformedRows - Rows that failed CSV validation
 * @param outputDir - Directory to write file to
 * @returns Path to written file
 */
export function writeMalformedRows(
  malformedRows: LoadParcelsResult['malformedRows'],
  outputDir: string
): string {
  const filePath = resolve(outputDir, 'csv_malformed_rows.json');

  const output = {
    metadata: {
      description:
        'CSV rows that failed validation and were excluded from enrichment pipeline',
      generated_at: new Date().toISOString(),
      malformed_row_count: malformedRows.length,
    },
    summary: {
      total_malformed: malformedRows.length,
      note: 'These rows were missing required fields (displayid or pid) and could not be processed',
    },
    malformed_rows: malformedRows,
  };

  writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');

  return filePath;
}

/**
 * Write analysis summary to JSON file
 *
 * @param summary - Statistics from enrichment process
 * @param outputDir - Directory to write file to
 * @returns Path to written file
 */
export function writeAnalysisSummary(summary: EnrichmentSummary, outputDir: string): string {
  const filePath = resolve(outputDir, 'analysis_summary.json');

  const output = {
    ...summary,
    success_rate_pct: ((summary.successful_enrichments / summary.total_parcels) * 100).toFixed(2),
    failure_rate_pct: ((summary.failed_enrichments / summary.total_parcels) * 100).toFixed(2),
    processing_time_seconds: (summary.processing_time_ms / 1000).toFixed(2),
  };

  writeFileSync(filePath, JSON.stringify(output, null, 2), 'utf-8');

  return filePath;
}

/**
 * Write all output files (parcels, errors, malformed rows, summary)
 *
 * This is the main entry point for output generation.
 * Validates that output count matches input count (all rows accounted for).
 *
 * @param parcels - Successfully enriched parcels
 * @param errors - Failed parcels with error details
 * @param malformedRows - CSV rows that failed validation
 * @param summary - Statistics from enrichment process
 * @throws Error if output count doesn't match input count
 */
export function writeAllOutputs(
  parcels: EnrichedParcel[],
  errors: APIError[],
  malformedRows: LoadParcelsResult['malformedRows'],
  summary: EnrichmentSummary
): void {
  // Critical validation: ensure all rows are accounted for
  // Total = enriched + failed enrichment + malformed CSV rows
  const totalOutput = parcels.length + errors.length + malformedRows.length;
  const totalInput = summary.total_parcels + malformedRows.length;

  if (totalOutput !== totalInput) {
    throw new Error(
      `Output count mismatch: ${totalOutput} outputs (${parcels.length} enriched + ${errors.length} failed + ${malformedRows.length} malformed) != ${totalInput} input rows`
    );
  }

  // Ensure output directory exists
  const outputDir = ensureOutputDirectory();

  console.log('Writing output files...');

  // Write enriched parcels
  const parcelsPath = writeEnrichedParcels(parcels, outputDir);
  console.log(`✓ Enriched parcels written to: ${parcelsPath}`);

  // Write error report
  const errorsPath = writeErrorReport(errors, outputDir);
  console.log(`✓ Error report written to: ${errorsPath}`);

  // Write malformed rows
  if (malformedRows.length > 0) {
    const malformedPath = writeMalformedRows(malformedRows, outputDir);
    console.log(`✓ Malformed rows written to: ${malformedPath}`);
  }

  // Write analysis summary
  const summaryPath = writeAnalysisSummary(summary, outputDir);
  console.log(`✓ Analysis summary written to: ${summaryPath}`);

  console.log(`\nAll output files written to: ${outputDir}`);
}
