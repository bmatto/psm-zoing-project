/**
 * Tests for output writer module
 *
 * Validates that output files are written correctly with proper structure,
 * validation, and error handling.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeAllOutputs, writeEnrichedParcels, writeErrorReport, writeAnalysisSummary } from './writer.js';
import type { EnrichedParcel, APIError, EnrichmentSummary } from '../types/index.js';
import { existsSync, readFileSync, rmSync, mkdirSync } from 'fs';
import { resolve } from 'path';

// Test output directory
const TEST_OUTPUT_DIR = resolve(process.cwd(), 'test-output');

// Clean up test directory before and after each test
beforeEach(() => {
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true });
  }
  mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
});

afterEach(() => {
  if (existsSync(TEST_OUTPUT_DIR)) {
    rmSync(TEST_OUTPUT_DIR, { recursive: true });
  }
});

describe('Output Writer', () => {
  describe('writeEnrichedParcels', () => {
    it('writes enriched parcels with metadata', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: 'R001-001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '101',
          land_use_desc: 'Single Family',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          living_area_sqft: 1800,
          lot_coverage_pct: 18.37,
          owner: 'John Doe',
          account: '12345',
        },
      ];

      const filePath = writeEnrichedParcels(parcels, TEST_OUTPUT_DIR);

      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(readFileSync(filePath, 'utf-8'));

      // Validate structure
      expect(content).toHaveProperty('metadata');
      expect(content).toHaveProperty('parcels');

      // Validate metadata
      expect(content.metadata.parcel_count).toBe(1);
      expect(content.metadata.data_sources).toHaveLength(3);
      expect(content.metadata.generated_at).toBeDefined();

      // Validate parcels
      expect(content.parcels).toHaveLength(1);
      expect(content.parcels[0].parcel_id).toBe('R001-001');
    });

    it('handles empty parcel array', () => {
      const filePath = writeEnrichedParcels([], TEST_OUTPUT_DIR);

      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content.metadata.parcel_count).toBe(0);
      expect(content.parcels).toHaveLength(0);
    });
  });

  describe('writeErrorReport', () => {
    it('writes errors with grouping by type and stage', () => {
      const errors: APIError[] = [
        {
          parcel_id: 'R001-002',
          stage: 'mapgeo_fetch',
          error_type: 'NetworkError',
          message: 'Connection timeout',
          timestamp: new Date().toISOString(),
        },
        {
          parcel_id: 'R001-003',
          stage: 'vgsi_fetch',
          error_type: 'NetworkError',
          message: 'Connection timeout',
          timestamp: new Date().toISOString(),
        },
        {
          parcel_id: 'R001-004',
          stage: 'validation',
          error_type: 'ValidationError',
          message: 'Missing required field',
          timestamp: new Date().toISOString(),
        },
      ];

      const filePath = writeErrorReport(errors, TEST_OUTPUT_DIR);

      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(readFileSync(filePath, 'utf-8'));

      // Validate structure
      expect(content).toHaveProperty('metadata');
      expect(content).toHaveProperty('summary');
      expect(content).toHaveProperty('errors');

      // Validate metadata
      expect(content.metadata.total_errors).toBe(3);

      // Validate summary grouping
      expect(content.summary.by_type.NetworkError).toBe(2);
      expect(content.summary.by_type.ValidationError).toBe(1);
      expect(content.summary.by_stage.mapgeo_fetch).toBe(1);
      expect(content.summary.by_stage.vgsi_fetch).toBe(1);
      expect(content.summary.by_stage.validation).toBe(1);

      // Validate errors array
      expect(content.errors).toHaveLength(3);
    });

    it('handles empty errors array', () => {
      const filePath = writeErrorReport([], TEST_OUTPUT_DIR);

      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(readFileSync(filePath, 'utf-8'));
      expect(content.metadata.total_errors).toBe(0);
      expect(content.errors).toHaveLength(0);
    });
  });

  describe('writeAnalysisSummary', () => {
    it('writes summary with calculated percentages', () => {
      const summary: EnrichmentSummary = {
        total_parcels: 100,
        successful_enrichments: 95,
        failed_enrichments: 5,
        validation_errors: 2,
        processing_time_ms: 45000,
        timestamp: new Date().toISOString(),
      };

      const filePath = writeAnalysisSummary(summary, TEST_OUTPUT_DIR);

      expect(existsSync(filePath)).toBe(true);

      const content = JSON.parse(readFileSync(filePath, 'utf-8'));

      // Validate all fields present
      expect(content.total_parcels).toBe(100);
      expect(content.successful_enrichments).toBe(95);
      expect(content.failed_enrichments).toBe(5);

      // Validate calculated fields
      expect(content.success_rate_pct).toBe('95.00');
      expect(content.failure_rate_pct).toBe('5.00');
      expect(content.processing_time_seconds).toBe('45.00');
    });
  });

  describe('writeAllOutputs', () => {
    it('writes all three output files', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: 'R001-001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '101',
          land_use_desc: 'Single Family',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          living_area_sqft: 1800,
          lot_coverage_pct: 18.37,
          owner: 'John Doe',
          account: '12345',
        },
      ];

      const errors: APIError[] = [
        {
          parcel_id: 'R001-002',
          stage: 'mapgeo_fetch',
          error_type: 'NetworkError',
          message: 'Connection timeout',
          timestamp: new Date().toISOString(),
        },
      ];

      const summary: EnrichmentSummary = {
        total_parcels: 2,
        successful_enrichments: 1,
        failed_enrichments: 1,
        validation_errors: 0,
        processing_time_ms: 1000,
        timestamp: new Date().toISOString(),
      };

      // Mock the output directory to use test directory
      // We'll need to create output/ in the current directory
      const realOutputDir = resolve(process.cwd(), 'output');
      if (existsSync(realOutputDir)) {
        rmSync(realOutputDir, { recursive: true });
      }

      const malformedRows: never[] = [];
      writeAllOutputs(parcels, errors, malformedRows, summary);

      // Check all three files exist
      expect(existsSync(resolve(realOutputDir, 'portsmouth_properties_full.json'))).toBe(true);
      expect(existsSync(resolve(realOutputDir, 'enrichment_errors.json'))).toBe(true);
      expect(existsSync(resolve(realOutputDir, 'analysis_summary.json'))).toBe(true);

      // Cleanup
      rmSync(realOutputDir, { recursive: true });
    });

    it('validates output count matches input count', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: 'R001-001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '101',
          land_use_desc: 'Single Family',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.37,
          owner: 'John Doe',
          account: '12345',
        },
      ];

      const errors: APIError[] = [];
      const malformedRows: never[] = [];

      // Summary says 2 parcels but we only have 1 - should throw
      const summary: EnrichmentSummary = {
        total_parcels: 2,
        successful_enrichments: 1,
        failed_enrichments: 0,
        validation_errors: 0,
        processing_time_ms: 1000,
        timestamp: new Date().toISOString(),
      };

      expect(() => writeAllOutputs(parcels, errors, malformedRows, summary)).toThrow(
        'Output count mismatch'
      );
    });

    it('creates output directory if it does not exist', () => {
      const outputDir = resolve(process.cwd(), 'output');
      if (existsSync(outputDir)) {
        rmSync(outputDir, { recursive: true });
      }

      const parcels: EnrichedParcel[] = [];
      const errors: APIError[] = [];
      const malformedRows: never[] = [];
      const summary: EnrichmentSummary = {
        total_parcels: 0,
        successful_enrichments: 0,
        failed_enrichments: 0,
        validation_errors: 0,
        processing_time_ms: 0,
        timestamp: new Date().toISOString(),
      };

      writeAllOutputs(parcels, errors, malformedRows, summary);

      expect(existsSync(outputDir)).toBe(true);

      // Cleanup
      rmSync(outputDir, { recursive: true });
    });
  });
});
