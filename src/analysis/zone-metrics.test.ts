/**
 * Unit tests for zone metrics calculator
 */

import { describe, it, expect } from 'vitest';
import { calculateZoneMetrics } from './zone-metrics.js';
import { EnrichedParcel } from '../types/index.js';

describe('Zone Metrics Calculator', () => {
  describe('calculateZoneMetrics', () => {
    it('should calculate metrics for single zone', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.4,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 600000,
          land_value: 250000,
          parcel_area_acres: 0.30,
          parcel_area_sqft: 13068,
          building_footprint_sqft: 2500,
          lot_coverage_pct: 19.1,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(result.zones['GRA']).toBeDefined();
      expect(result.zones['GRA']?.zoneName).toBe('GRA');
      expect(result.zones['GRA']?.totalAcres).toBe(0.55);
      expect(result.zones['GRA']?.totalValue).toBe(1100000);
      expect(result.zones['GRA']?.parcelCount).toBe(2);
      expect(result.zones['GRA']?.revenueDensity).toBeCloseTo(2000000, 0);
      expect(result.zones['GRA']?.landUses).toHaveLength(1);
      expect(result.zones['GRA']?.landUses[0]?.landUse).toBe('single_family');
      expect(result.zones['GRA']?.landUses[0]?.count).toBe(2);
    });

    it('should calculate metrics for multiple zones', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.4,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Elm St',
          zoning: 'SRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 800000,
          land_value: 400000,
          parcel_area_acres: 1.0,
          parcel_area_sqft: 43560,
          building_footprint_sqft: 3000,
          lot_coverage_pct: 6.9,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(Object.keys(result.zones)).toHaveLength(2);
      expect(result.zones['GRA']).toBeDefined();
      expect(result.zones['SRA']).toBeDefined();
      expect(result.zones['GRA']?.parcelCount).toBe(1);
      expect(result.zones['SRA']?.parcelCount).toBe(1);
    });

    it('should identify most revenue-dense zone', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 1000000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.4,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Elm St',
          zoning: 'SRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 400000,
          parcel_area_acres: 1.0,
          parcel_area_sqft: 43560,
          building_footprint_sqft: 3000,
          lot_coverage_pct: 6.9,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(result.mostRevenueDenseZone).toBeDefined();
      expect(result.mostRevenueDenseZone?.zone).toBe('GRA');
      expect(result.mostRevenueDenseZone?.revenueDensity).toBe(4000000);
    });

    it('should group land uses within each zone', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.4,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Main St',
          zoning: 'GRA',
          land_use_code: '102',
          land_use_desc: 'MULTI FAM',
          total_value: 1200000,
          land_value: 300000,
          parcel_area_acres: 0.35,
          parcel_area_sqft: 15246,
          building_footprint_sqft: 4000,
          lot_coverage_pct: 26.2,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(result.zones['GRA']?.landUses).toHaveLength(2);
      const landUses = result.zones['GRA']?.landUses ?? [];
      const singleFam = landUses.find((lu) => lu.landUse === 'single_family');
      const multiFam = landUses.find((lu) => lu.landUse === 'multi_family');
      expect(singleFam?.count).toBe(1);
      expect(multiFam?.count).toBe(1);
    });

    it('should skip parcels with missing zoning', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: null,
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.4,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 600000,
          land_value: 250000,
          parcel_area_acres: 0.30,
          parcel_area_sqft: 13068,
          building_footprint_sqft: 2500,
          lot_coverage_pct: 19.1,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(Object.keys(result.zones)).toHaveLength(1);
      expect(result.zones['GRA']?.parcelCount).toBe(1);
    });

    it('should handle zero acres gracefully', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0,
          parcel_area_sqft: 0,
          building_footprint_sqft: 0,
          lot_coverage_pct: 0,
          owner: 'John Doe',
          account: 'A001',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(result.zones['GRA']?.revenueDensity).toBe(0);
    });

    it('should handle empty parcel array', () => {
      const result = calculateZoneMetrics([]);

      expect(Object.keys(result.zones)).toHaveLength(0);
      expect(result.mostRevenueDenseZone).toBeNull();
    });

    it('should handle parcels with zero values', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 0,
          land_value: 0,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.4,
          owner: 'John Doe',
          account: 'A001',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(result.zones['GRA']?.totalValue).toBe(0);
      expect(result.zones['GRA']?.revenueDensity).toBe(0);
    });

    it('should handle invalid zone codes', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'INVALID_ZONE',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 18.4,
          owner: 'John Doe',
          account: 'A001',
        },
      ];

      const result = calculateZoneMetrics(parcels);

      expect(result.zones['INVALID_ZONE']).toBeDefined();
      expect(result.zones['INVALID_ZONE']?.parcelCount).toBe(1);
    });
  });
});
