#!/usr/bin/env node

/**
 * Portsmouth Zoning Analysis - Main Entry Point
 *
 * This script orchestrates the complete data collection and enrichment pipeline
 * for Portsmouth parcel data. It combines information from multiple authoritative
 * sources to create a comprehensive dataset for zoning analysis.
 *
 * Data Flow:
 * 1. Load parcel records from State GIS CSV file
 * 2. Enrich each parcel with Map Geo API (geographic/property data)
 * 3. Enrich with VGSI API (building details and assessments)
 * 4. Validate data quality at each stage
 * 5. Output enriched dataset with error tracking
 *
 * Core Principles (from CLAUDE.md):
 * - Accuracy Above All: Data integrity over processing speed
 * - Thoroughness: Process every parcel, track all failures
 * - Certainty: Validate all API responses before incorporation
 *
 * Usage:
 *   npx tsx src/analyze.ts
 */

import { resolve } from 'path';
import { loadParcels } from './parsers/csv-parser.js';
import { EnrichmentPipeline } from './pipeline/enrichment.js';
import { writeAllOutputs } from './output/writer.js';

/**
 * Main analysis function
 *
 * Orchestrates the complete data enrichment pipeline:
 * - Loads source parcel data
 * - Configures parallel processing
 * - Runs enrichment with progress tracking
 * - Reports final results
 */
async function main(): Promise<void> {
  console.log('Portsmouth Zoning Analysis - TypeScript Implementation');
  console.log('======================================================\n');

  // ========================================================================
  // STAGE 1: Load Master Parcel List
  // ========================================================================
  // The Portsmouth_Parcels.csv file is the authoritative source for all
  // parcels in Portsmouth. This is our master list - every parcel here
  // MUST be accounted for in downstream processing.

  console.log('Stage 1: Loading master parcel list from State GIS...');

  const csvPath = resolve(process.cwd(), 'Portsmouth_Parcels.csv');
  let parcels;
  let malformedRows;

  try {
    const loadResult = loadParcels(csvPath);
    parcels = loadResult.parcels;
    malformedRows = loadResult.malformedRows;
    console.log(`✓ Loaded ${parcels.length} valid parcels from CSV`);

    // Report malformed rows but continue processing
    if (malformedRows.length > 0) {
      console.warn(
        `⚠️  ${malformedRows.length} malformed rows detected and will be tracked in output\n`
      );
    } else {
      console.log('');
    }
  } catch (error) {
    console.error('✗ Failed to load parcel data:');
    console.error(error instanceof Error ? error.message : String(error));
    console.error('\nPlease ensure Portsmouth_Parcels.csv exists in the project root.');
    process.exit(1);
  }

  // Validate we have parcels to process
  if (parcels.length === 0) {
    console.error('✗ No valid parcels found in CSV file.');
    if (malformedRows.length > 0) {
      console.error(
        `All ${malformedRows.length} rows in the CSV were malformed. Check CSV format and required fields.`
      );
    }
    console.error('Exiting.');
    process.exit(1);
  }

  // ========================================================================
  // STAGE 2: Configure Parallel Enrichment Pipeline
  // ========================================================================
  // The enrichment pipeline fetches data from the Map Geo API:
  //
  // 1. Map Geo API - Geographic and property information
  //    - Zoning codes, land use classifications
  //    - Property values, ownership
  //    - Parcel area and location data
  //
  // Note: VGSI API integration (building details and assessments) is disabled
  // and will be added in a future update.
  //
  // Configuration:
  // - batchSize: Number of concurrent API requests (higher = faster, but respect rate limits)
  // - maxRequestsPerSecond: Rate limiting to avoid overwhelming API
  // - maxRetries: Retry attempts for transient failures

  console.log('Stage 2: Configuring enrichment pipeline...');

  const pipeline = new EnrichmentPipeline({
    batchSize: 20, // Process 20 parcels concurrently (matches Python performance)
    maxRequestsPerSecond: 10, // Respect API rate limits
    maxRetries: 3, // Retry transient failures
  });

  console.log('✓ Pipeline configured\n');

  // ========================================================================
  // STAGE 3: Run Parallel Enrichment
  // ========================================================================
  // This is the core data collection process. For each parcel:
  //
  // 1. Fetch Map Geo data (REQUIRED)
  //    - If this fails, the parcel cannot be enriched
  //    - Failure is logged but doesn't stop pipeline
  //
  // 2. Combine and validate
  //    - Extract data from Map Geo API response
  //    - Calculate derived fields (parcel area in acres, etc.)
  //    - Validate final data structure
  //
  // 3. Track everything
  //    - Successful enrichments → results array
  //    - Failed enrichments → errors array
  //    - Progress logged throughout
  //
  // CRITICAL: The pipeline never silently drops parcels. Every input parcel
  // is either successfully enriched OR has an error record explaining why it failed.
  //
  // Note: Building data (footprint, living area) from VGSI API is not currently
  // integrated and will be added in a future update.

  console.log('Stage 3: Running parallel enrichment pipeline...');

  let enrichmentResult;

  try {
    enrichmentResult = await pipeline.enrichParcels(parcels);
  } catch (error) {
    console.error('\n✗ Fatal error during enrichment:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const { parcels: enrichedParcels, errors, summary } = enrichmentResult;

  // ========================================================================
  // STAGE 4: Validation and Quality Checks
  // ========================================================================
  // After enrichment, we perform comprehensive data quality checks:
  //
  // 1. Count Reconciliation
  //    Verify: successful + failed = total input parcels
  //    This ensures no parcels were silently lost during processing
  //
  // 2. Success Rate Analysis
  //    - High success rate (>95%) is expected for Map Geo data
  //    - Lower VGSI success rate is acceptable (not all parcels have buildings)
  //
  // 3. Error Pattern Analysis
  //    - Group errors by type (network, validation, missing data)
  //    - Identify problematic parcels for manual review

  console.log('\nStage 4: Validating results...');

  // Check 1: Count reconciliation
  // Total input = valid parcels + malformed rows from CSV
  const totalValidInput = parcels.length;
  const totalMalformedInput = malformedRows.length;
  const totalInput = totalValidInput + totalMalformedInput;
  const totalOutput = enrichedParcels.length + errors.length + totalMalformedInput;

  console.log(`Input summary:`);
  console.log(`  Valid CSV rows:      ${totalValidInput}`);
  console.log(`  Malformed CSV rows:  ${totalMalformedInput}`);
  console.log(`  Total input rows:    ${totalInput}`);

  if (totalOutput !== totalInput) {
    console.error(`\n⚠️  CRITICAL: Parcel count mismatch detected!`);
    console.error(`  Input rows:       ${totalInput}`);
    console.error(`  Output rows:      ${totalOutput}`);
    console.error(`  Missing rows:     ${totalInput - totalOutput}`);
    console.error(`\nThis indicates rows were lost during processing.`);
    console.error('Review error logs and pipeline code immediately.\n');
    process.exit(1);
  }

  console.log(
    `✓ Count reconciliation passed: ${totalInput} in = ${totalOutput} out (${enrichedParcels.length} enriched + ${errors.length} failed + ${totalMalformedInput} malformed)`
  );

  // Check 2: Success rate analysis (based on valid input parcels only)
  const successRate = (enrichedParcels.length / totalValidInput) * 100;
  console.log(`✓ Enrichment success rate: ${successRate.toFixed(1)}% (of valid parcels)`);

  if (successRate < 90) {
    console.warn(`\n⚠️  WARNING: Success rate below 90%`);
    console.warn('This may indicate API issues or data quality problems.');
    console.warn('Review errors below for patterns.\n');
  }

  // Check 3: Error pattern analysis
  if (errors.length > 0) {
    console.log(`\n📊 Error Summary (${errors.length} failures):`);

    // Group errors by type
    const errorsByType = new Map<string, number>();
    const errorsByStage = new Map<string, number>();

    for (const error of errors) {
      errorsByType.set(error.error_type, (errorsByType.get(error.error_type) || 0) + 1);
      errorsByStage.set(error.stage, (errorsByStage.get(error.stage) || 0) + 1);
    }

    console.log('\nBy Error Type:');
    for (const [type, count] of errorsByType.entries()) {
      console.log(`  - ${type}: ${count} (${((count / errors.length) * 100).toFixed(1)}%)`);
    }

    console.log('\nBy Pipeline Stage:');
    for (const [stage, count] of errorsByStage.entries()) {
      console.log(`  - ${stage}: ${count} (${((count / errors.length) * 100).toFixed(1)}%)`);
    }

    // Show sample of first few errors for debugging
    console.log('\nFirst 5 errors (for debugging):');
    for (const error of errors.slice(0, 5)) {
      console.log(`  - ${error.parcel_id}: [${error.stage}] ${error.message}`);
    }

    if (errors.length > 5) {
      console.log(`  ... and ${errors.length - 5} more errors`);
    }
  }

  // ========================================================================
  // STAGE 5: Output Results
  // ========================================================================
  // At this point we have:
  // - enrichedParcels: Array of successfully enriched parcels
  // - errors: Array of failed parcels with error details
  // - summary: Statistics about the enrichment process
  //
  // We write three output files:
  // 1. portsmouth_properties_full.json - Enriched parcel data
  // 2. enrichment_errors.json - Error report with grouping by type/stage
  // 3. analysis_summary.json - Statistics and metadata
  //
  // All files include timestamps for tracking when data was collected.
  // The output count (successful + failed) is validated to match input count.

  console.log('\nStage 5: Writing output files...');

  try {
    writeAllOutputs(enrichedParcels, errors, malformedRows, summary);
  } catch (error) {
    console.error('\n✗ Failed to write output files:');
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  console.log('\n======================================================');
  console.log('Portsmouth Zoning Analysis - Complete');
  console.log('======================================================\n');

  console.log('Results Summary:');
  console.log(`  Total CSV rows:        ${totalInput}`);
  console.log(`  Valid parcels:         ${summary.total_parcels}`);
  console.log(`  Successfully enriched: ${summary.successful_enrichments}`);
  console.log(`  Failed enrichments:    ${summary.failed_enrichments}`);
  console.log(`  Malformed CSV rows:    ${malformedRows.length}`);
  console.log(`  Processing time:       ${(summary.processing_time_ms / 1000).toFixed(2)}s`);
  console.log(`  Timestamp:             ${summary.timestamp}\n`);

  // Exit with appropriate code
  // - 0 if all valid parcels enriched successfully and no malformed rows
  // - 1 if some parcels failed or malformed rows exist
  const exitCode = errors.length > 0 || malformedRows.length > 0 ? 1 : 0;

  if (exitCode === 0) {
    console.log('✓ All parcels successfully enriched!');
  } else {
    const messages = [];
    if (errors.length > 0) {
      messages.push(`${errors.length} enrichment failures (see output/enrichment_errors.json)`);
    }
    if (malformedRows.length > 0) {
      messages.push(`${malformedRows.length} malformed CSV rows (see output/csv_malformed_rows.json)`);
    }
    console.log(`⚠️  Issues detected: ${messages.join(', ')}`);
  }

  process.exit(exitCode);
}

// ============================================================================
// Error Handling and Execution
// ============================================================================
// Catch any unhandled errors at the top level and report them clearly.
// This ensures no errors are silently swallowed.

main().catch((error) => {
  console.error('\n✗ Unhandled error in main:');
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
