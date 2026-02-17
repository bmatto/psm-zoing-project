/**
 * Integration tests for parallel enrichment pipeline
 *
 * Tests the complete data enrichment flow with sample data.
 * Note: VGSI integration is currently disabled.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EnrichmentPipeline } from './enrichment.js';
import type { ParcelRecord, MapGeoResponse } from '../types/index.js';
import { MapGeoClient } from '../api/mapgeo-client.js';

// Mock the API client
vi.mock('../api/mapgeo-client.js');

describe('EnrichmentPipeline', () => {
  let pipeline: EnrichmentPipeline;
  let mockMapGeoClient: any;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create pipeline instance
    pipeline = new EnrichmentPipeline({
      batchSize: 2,
      maxRequestsPerSecond: 10,
      maxRetries: 3,
    });

    // Get mock instance
    mockMapGeoClient = vi.mocked(MapGeoClient).mock.instances[0];
  });

  // Sample test data
  const createSampleParcel = (id: string): ParcelRecord => ({
    town: 'Portsmouth',
    slum: '',
    localnbc: '',
    pid: `PID-${id}`,
    townid: '001',
    nbc: '',
    oid_1: '',
    sluc: '',
    u_id: '',
    countyid: '005',
    name: `Owner ${id}`,
    streetaddress: `${id} Main Street`,
    parceloid: '',
    nh_gis_id: `NH-${id}`,
    displayid: id,
    SHAPE__Length: '100',
    slu: '',
    objectid: id,
    SHAPE__Area: '5000',
  });

  const createMapGeoResponse = (parcelId: string): MapGeoResponse => ({
    data: {
      propID: parcelId,
      id: parcelId,
      displayName: `${parcelId} Main Street`,
      zoningCode: 'R-1',
      landUseCode: '101',
      lndUseDesc: 'Single Family',
      totalValue: 500000,
      landValue: 200000,
      parcelArea: 10000,
      ownerName: 'John Doe',
      account: `ACC-${parcelId}`,
    },
  });

  it('should enrich parcels successfully with Map Geo data', async () => {
    // Arrange
    const parcels = [createSampleParcel('001'), createSampleParcel('002')];

    mockMapGeoClient.fetchParcelData = vi
      .fn()
      .mockImplementation(async (parcelId: string) => createMapGeoResponse(parcelId));

    // Act
    const result = await pipeline.enrichParcels(parcels);

    // Assert
    expect(result.parcels).toHaveLength(2);
    expect(result.errors).toHaveLength(0);
    expect(result.summary.total_parcels).toBe(2);
    expect(result.summary.successful_enrichments).toBe(2);
    expect(result.summary.failed_enrichments).toBe(0);

    // Verify first enriched parcel
    const enriched = result.parcels[0]!;
    expect(enriched.parcel_id).toBe('001');
    expect(enriched.address).toBe('001 Main Street');
    expect(enriched.zoning).toBe('R-1');
    expect(enriched.land_use_code).toBe('101');
    expect(enriched.total_value).toBe(500000);
    expect(enriched.land_value).toBe(200000);
    expect(enriched.parcel_area_sqft).toBe(10000);

    // Building data not available without VGSI
    expect(enriched.building_footprint_sqft).toBe(0);
    expect(enriched.living_area_sqft).toBeUndefined();
    expect(enriched.lot_coverage_pct).toBe(0);
  });

  it('should handle Map Geo API failures gracefully', async () => {
    // Arrange
    const parcels = [createSampleParcel('001'), createSampleParcel('002')];

    mockMapGeoClient.fetchParcelData = vi
      .fn()
      .mockImplementationOnce(async () => createMapGeoResponse('001'))
      .mockImplementationOnce(async () => {
        throw new Error('API request timeout');
      });

    // Act
    const result = await pipeline.enrichParcels(parcels);

    // Assert
    expect(result.parcels).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.summary.successful_enrichments).toBe(1);
    expect(result.summary.failed_enrichments).toBe(1);

    // Verify error details
    const error = result.errors[0]!;
    expect(error.parcel_id).toBe('002');
    expect(error.stage).toBe('mapgeo_fetch');
    expect(error.error_type).toBe('APIFetchError');
    expect(error.message).toContain('timeout');
  });

  it('should process parcels in parallel batches', async () => {
    // Arrange
    const parcels = [
      createSampleParcel('001'),
      createSampleParcel('002'),
      createSampleParcel('003'),
    ];

    const fetchOrder: string[] = [];

    mockMapGeoClient.fetchParcelData = vi
      .fn()
      .mockImplementation(async (parcelId: string) => {
        fetchOrder.push(parcelId);
        // Small delay to ensure we can observe parallel execution
        await new Promise(resolve => setTimeout(resolve, 10));
        return createMapGeoResponse(parcelId);
      });

    // Act
    await pipeline.enrichParcels(parcels);

    // Assert - with batch size of 2, we should see:
    // Batch 1: 001, 002 (processed in parallel)
    // Batch 2: 003
    expect(mockMapGeoClient.fetchParcelData).toHaveBeenCalledTimes(3);

    // First two parcels should be in first batch (order may vary due to parallel execution)
    expect(fetchOrder.slice(0, 2)).toContain('001');
    expect(fetchOrder.slice(0, 2)).toContain('002');
    expect(fetchOrder[2]).toBe('003');
  });

  it('should track all parcels and not lose any during processing', async () => {
    // Arrange
    const parcels = [
      createSampleParcel('001'),
      createSampleParcel('002'),
      createSampleParcel('003'),
      createSampleParcel('004'),
      createSampleParcel('005'),
    ];

    // Mix of successes and failures
    mockMapGeoClient.fetchParcelData = vi
      .fn()
      .mockImplementationOnce(async () => createMapGeoResponse('001'))
      .mockImplementationOnce(async () => {
        throw new Error('Failed');
      })
      .mockImplementationOnce(async () => createMapGeoResponse('003'))
      .mockImplementationOnce(async () => {
        throw new Error('Failed');
      })
      .mockImplementationOnce(async () => createMapGeoResponse('005'));

    // Act
    const result = await pipeline.enrichParcels(parcels);

    // Assert - ALL parcels must be accounted for
    const totalAccountedFor =
      result.summary.successful_enrichments + result.summary.failed_enrichments;

    expect(totalAccountedFor).toBe(5);
    expect(result.summary.total_parcels).toBe(5);
    expect(result.summary.successful_enrichments).toBe(3);
    expect(result.summary.failed_enrichments).toBe(2);
    expect(result.parcels).toHaveLength(3);
    expect(result.errors).toHaveLength(2);
  });

  it('should include timestamp and processing time in summary', async () => {
    // Arrange
    const parcels = [createSampleParcel('001')];

    mockMapGeoClient.fetchParcelData = vi
      .fn()
      .mockResolvedValue(createMapGeoResponse('001'));

    const startTime = Date.now();

    // Act
    const result = await pipeline.enrichParcels(parcels);

    // Assert
    expect(result.summary.processing_time_ms).toBeGreaterThanOrEqual(0);
    expect(result.summary.timestamp).toBeDefined();

    // Verify timestamp is recent (within last minute)
    const summaryTime = new Date(result.summary.timestamp).getTime();
    expect(summaryTime).toBeGreaterThanOrEqual(startTime);
    expect(summaryTime).toBeLessThanOrEqual(Date.now());
  });

  it('should handle string values for numeric fields in Map Geo response', async () => {
    // Arrange
    const parcels = [createSampleParcel('001')];

    const mapGeoResponse = createMapGeoResponse('001');
    // API sometimes returns strings with commas
    mapGeoResponse.data.totalValue = '500,000';
    mapGeoResponse.data.landValue = '200,000';
    mapGeoResponse.data.parcelArea = '10,000';

    mockMapGeoClient.fetchParcelData = vi.fn().mockResolvedValue(mapGeoResponse);

    // Act
    const result = await pipeline.enrichParcels(parcels);

    // Assert
    const enriched = result.parcels[0]!;
    expect(enriched.total_value).toBe(500000);
    expect(enriched.land_value).toBe(200000);
    expect(enriched.parcel_area_sqft).toBe(10000);
  });

  it('should set building data to defaults when VGSI is not integrated', async () => {
    // Arrange
    const parcels = [createSampleParcel('001')];

    mockMapGeoClient.fetchParcelData = vi
      .fn()
      .mockResolvedValue(createMapGeoResponse('001'));

    // Act
    const result = await pipeline.enrichParcels(parcels);

    // Assert
    expect(result.parcels).toHaveLength(1);
    expect(result.errors).toHaveLength(0);

    // Enriched parcel should have default building values (VGSI not integrated)
    const enriched = result.parcels[0]!;
    expect(enriched.building_footprint_sqft).toBe(0);
    expect(enriched.living_area_sqft).toBeUndefined();
    expect(enriched.lot_coverage_pct).toBe(0);
  });
});
