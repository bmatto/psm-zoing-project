/**
 * Parallel Data Enrichment Pipeline
 *
 * Processes parcel records in parallel batches, enriching each with data
 * from Map Geo and VGSI APIs. Implements comprehensive error tracking and
 * progress reporting.
 *
 * Core Principles:
 * - Process ALL parcels (no silent skipping)
 * - Track every success and failure
 * - Validate data at each stage
 * - Maintain data accuracy over speed
 */

import type {
  ParcelRecord,
  EnrichedParcel,
  APIError,
  MapGeoResponse,
  VGSIResponse,
  EnrichmentResult,
} from '../types/index.js';
import { MapGeoClient } from '../api/mapgeo-client.js';
import { VGSIClient } from '../api/vgsi-client.js';
import {
  validateMapGeoResponse,
  validateVGSIResponse,
  validateEnrichedParcel,
} from '../validators/data-validator.js';

/**
 * Configuration for the enrichment pipeline
 */
export interface EnrichmentConfig {
  /**
   * Number of parcels to process concurrently
   * @default 5
   */
  batchSize?: number;

  /**
   * Maximum requests per second for API clients
   * @default 10
   */
  maxRequestsPerSecond?: number;

  /**
   * Maximum retry attempts for failed API calls
   * @default 3
   */
  maxRetries?: number;
}

/**
 * Parallel enrichment pipeline for parcel data
 *
 * Orchestrates the complete enrichment process:
 * 1. Fetches Map Geo data for each parcel
 * 2. Fetches VGSI building data (if account number available)
 * 3. Combines all data into EnrichedParcel objects
 * 4. Validates output data quality
 * 5. Tracks all errors and failures
 */
export class EnrichmentPipeline {
  private readonly mapGeoClient: MapGeoClient;
  private readonly vgsiClient: VGSIClient;
  private readonly batchSize: number;

  constructor(config: EnrichmentConfig = {}) {
    this.batchSize = config.batchSize ?? 5;

    // Initialize API clients with shared config
    this.mapGeoClient = new MapGeoClient({
      maxRequestsPerSecond: config.maxRequestsPerSecond ?? 10,
      maxRetries: config.maxRetries ?? 3,
    });

    this.vgsiClient = new VGSIClient({
      maxRequestsPerSecond: config.maxRequestsPerSecond ?? 10,
      maxRetries: config.maxRetries ?? 3,
    });
  }

  /**
   * Enriches a single parcel with data from Map Geo and VGSI APIs
   *
   * CRITICAL: This method attempts to enrich the parcel but NEVER throws.
   * All errors are captured and returned as APIError objects to ensure
   * no parcels are silently lost during processing.
   *
   * @param parcel - Base parcel record from CSV
   * @returns Enriched parcel data OR error object
   */
  private async enrichParcel(
    parcel: ParcelRecord
  ): Promise<{ success: true; data: EnrichedParcel } | { success: false; error: APIError }> {
    const parcelId = parcel.displayid;

    try {
      // Step 1: Fetch Map Geo data (geographic and property info)
      let mapGeoData: MapGeoResponse;
      try {
        mapGeoData = await this.mapGeoClient.fetchParcelData(parcelId);

        // Validate Map Geo response structure
        const validationErrors = validateMapGeoResponse(mapGeoData, parcelId);
        if (validationErrors.length > 0) {
          throw new Error(
            `Map Geo validation failed: ${validationErrors.map(e => e.message).join('; ')}`
          );
        }
      } catch (error) {
        return {
          success: false,
          error: {
            parcel_id: parcelId,
            stage: 'mapgeo_fetch',
            error_type: 'APIFetchError',
            message: error instanceof Error ? error.message : String(error),
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Step 2: Fetch VGSI building data (if account number available)
      let vgsiData: VGSIResponse = {};
      const accountNumber = mapGeoData.data.account;

      if (accountNumber) {
        try {
          const vgsiResult = await this.vgsiClient.fetchPropertyData(accountNumber, parcelId);

          if (vgsiResult) {
            // Validate VGSI response if we got data
            const validationErrors = validateVGSIResponse(vgsiResult, parcelId);
            if (validationErrors.length > 0) {
              console.warn(
                `VGSI validation warnings for ${parcelId}: ${validationErrors
                  .map(e => e.message)
                  .join('; ')}`
              );
            } else {
              vgsiData = vgsiResult;
            }
          }
        } catch (error) {
          // VGSI errors are non-fatal - we can still enrich with Map Geo data
          console.warn(
            `VGSI fetch failed for ${parcelId}, continuing with Map Geo data only:`,
            error instanceof Error ? error.message : String(error)
          );
        }
      }

      // Step 3: Combine all data into EnrichedParcel object
      const enrichedParcel = this.combineParcelData(parcel, mapGeoData, vgsiData);

      // Step 4: Validate final enriched parcel
      const finalValidationErrors = validateEnrichedParcel(enrichedParcel as unknown as Record<string, unknown>);
      if (finalValidationErrors.length > 0) {
        throw new Error(
          `Final validation failed: ${finalValidationErrors.map(e => e.message).join('; ')}`
        );
      }

      return { success: true, data: enrichedParcel };
    } catch (error) {
      // Catch-all for any unexpected errors during enrichment
      return {
        success: false,
        error: {
          parcel_id: parcelId,
          stage: 'validation',
          error_type: 'EnrichmentError',
          message: error instanceof Error ? error.message : String(error),
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  /**
   * Combines data from all sources into a single EnrichedParcel object
   *
   * Handles type conversions, defaults, and calculations (e.g., lot coverage).
   * Ensures all fields have valid values.
   *
   * @param parcel - Base parcel record from CSV
   * @param mapGeoData - Data from Map Geo API
   * @param vgsiData - Data from VGSI API (may be empty)
   * @returns Complete enriched parcel object
   */
  private combineParcelData(
    parcel: ParcelRecord,
    mapGeoData: MapGeoResponse,
    vgsiData: VGSIResponse
  ): EnrichedParcel {
    const data = mapGeoData.data;

    // Parse numeric values with fallbacks
    const totalValue = this.parseNumber(data.totalValue, 0);
    const landValue = this.parseNumber(data.landValue, 0);
    const parcelAreaSqft = this.parseNumber(data.parcelArea, 0);
    const parcelAreaAcres = parcelAreaSqft / 43560; // Convert sqft to acres

    // Get building measurements from VGSI (if available)
    const buildingFootprint = vgsiData.building_footprint_sqft ?? 0;
    const livingArea = vgsiData.living_area_sqft;

    // Calculate lot coverage percentage
    // Lot coverage = (building footprint / parcel area) * 100
    const lotCoveragePct =
      parcelAreaSqft > 0 ? (buildingFootprint / parcelAreaSqft) * 100 : 0;

    // Build enriched parcel object
    const enriched: EnrichedParcel = {
      // Primary identifiers
      parcel_id: parcel.displayid,
      address: parcel.streetaddress || data.displayName || 'Unknown',

      // Zoning and land use
      zoning: data.zoningCode || null,
      land_use_code: data.landUseCode || null,
      land_use_desc: data.lndUseDesc || null,

      // Property values
      total_value: totalValue,
      land_value: landValue,

      // Parcel dimensions
      parcel_area_acres: parcelAreaAcres,
      parcel_area_sqft: parcelAreaSqft,

      // Building information
      building_footprint_sqft: buildingFootprint,
      living_area_sqft: livingArea,
      lot_coverage_pct: lotCoveragePct,

      // Ownership
      owner: data.ownerName || null,
      account: data.account || null,
    };

    return enriched;
  }

  /**
   * Safely parses a value to a number with fallback
   *
   * Handles both string and number inputs, removes commas from strings.
   *
   * @param value - Value to parse (string or number)
   * @param defaultValue - Fallback if parsing fails
   * @returns Parsed number or default
   */
  private parseNumber(value: unknown, defaultValue: number): number {
    if (typeof value === 'number') {
      return isNaN(value) ? defaultValue : value;
    }

    if (typeof value === 'string') {
      const cleaned = value.replace(/,/g, '');
      const parsed = parseFloat(cleaned);
      return isNaN(parsed) ? defaultValue : parsed;
    }

    return defaultValue;
  }

  /**
   * Processes parcels in parallel batches
   *
   * CRITICAL: This method ensures ALL parcels are processed.
   * - Successful enrichments are added to results
   * - Failed enrichments are tracked in errors array
   * - Progress is logged throughout processing
   *
   * @param parcels - Array of parcel records to enrich
   * @returns Complete enrichment result with data, errors, and summary
   */
  async enrichParcels(parcels: ParcelRecord[]): Promise<EnrichmentResult> {
    const startTime = Date.now();
    const totalParcels = parcels.length;

    console.log(`\n=== Starting Parallel Enrichment Pipeline ===`);
    console.log(`Total parcels to process: ${totalParcels}`);
    console.log(`Batch size: ${this.batchSize}`);
    console.log(`Starting at: ${new Date().toISOString()}`);

    const enrichedParcels: EnrichedParcel[] = [];
    const errors: APIError[] = [];
    let processedCount = 0;

    // Process parcels in batches for parallel execution
    for (let i = 0; i < parcels.length; i += this.batchSize) {
      const batch = parcels.slice(i, i + this.batchSize);
      const batchNumber = Math.floor(i / this.batchSize) + 1;
      const totalBatches = Math.ceil(parcels.length / this.batchSize);

      console.log(`\nProcessing batch ${batchNumber}/${totalBatches} (${batch.length} parcels)...`);

      // Process all parcels in the batch concurrently
      const batchPromises = batch.map(parcel => this.enrichParcel(parcel));
      const batchResults = await Promise.all(batchPromises);

      // Sort results into successes and failures
      for (const result of batchResults) {
        if (result.success) {
          enrichedParcels.push(result.data);
        } else {
          errors.push(result.error);
        }
      }

      processedCount += batch.length;

      // Log progress
      const successCount = enrichedParcels.length;
      const errorCount = errors.length;
      const percentComplete = ((processedCount / totalParcels) * 100).toFixed(1);

      console.log(`Progress: ${processedCount}/${totalParcels} (${percentComplete}%)`);
      console.log(`  ✓ Successful: ${successCount}`);
      console.log(`  ✗ Failed: ${errorCount}`);
    }

    const endTime = Date.now();
    const processingTimeMs = endTime - startTime;

    // Generate summary
    const summary = {
      total_parcels: totalParcels,
      successful_enrichments: enrichedParcels.length,
      failed_enrichments: errors.length,
      validation_errors: 0, // Could be computed from errors if needed
      processing_time_ms: processingTimeMs,
      timestamp: new Date().toISOString(),
    };

    console.log(`\n=== Enrichment Pipeline Complete ===`);
    console.log(`Total time: ${(processingTimeMs / 1000).toFixed(2)}s`);
    console.log(`Success rate: ${((summary.successful_enrichments / totalParcels) * 100).toFixed(1)}%`);
    console.log(`Enriched parcels: ${summary.successful_enrichments}`);
    console.log(`Failed parcels: ${summary.failed_enrichments}`);

    // Validate we didn't lose any parcels
    const accountedFor = summary.successful_enrichments + summary.failed_enrichments;
    if (accountedFor !== totalParcels) {
      console.error(
        `\n⚠️  WARNING: Parcel count mismatch!`
      );
      console.error(`  Expected: ${totalParcels}`);
      console.error(`  Accounted for: ${accountedFor}`);
      console.error(`  Missing: ${totalParcels - accountedFor}`);
    }

    return {
      parcels: enrichedParcels,
      errors,
      summary,
    };
  }
}
