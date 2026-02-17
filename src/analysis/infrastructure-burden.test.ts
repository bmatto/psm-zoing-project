/**
 * Unit tests for infrastructure burden calculator
 */

import { describe, it, expect } from 'vitest';
import { calculateInfrastructureMetrics } from './infrastructure-burden.js';
import { EnrichedParcel } from '../types/index.js';
import { ZONING_RULES } from '../zoning/rules.js';

describe('Infrastructure Burden Calculator', () => {
  describe('calculateInfrastructureMetrics', () => {
    it('should calculate infrastructure metrics for single zone', () => {
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

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);

      expect(result.zones['GRA']).toBeDefined();
      expect(result.zones['GRA']?.zone_name).toBe('General Residence A');
      expect(result.zones['GRA']?.parcel_count).toBe(2);
      expect(result.zones['GRA']?.total_acres).toBe(0.55);
      expect(result.zones['GRA']?.total_value).toBe(1100000);
    });

    it('should calculate fiscal sustainability ratio', () => {
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
      ];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);
      const graMetrics = result.zones['GRA'];

      expect(graMetrics?.est_infrastructure_cost_per_parcel).toBeGreaterThan(0);
      expect(graMetrics?.fiscal_sustainability_ratio).toBeGreaterThan(0);
      if (graMetrics) {
        expect(graMetrics.fiscal_sustainability_ratio).toBe(
          Math.round((graMetrics.revenue_per_parcel / graMetrics.est_infrastructure_cost_per_parcel) * 100) / 100
        );
      }
    });

    it('should estimate linear infrastructure based on frontage', () => {
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
      ];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);
      const graRules = ZONING_RULES['GRA'];

      expect(result.zones['GRA']?.estimated_linear_infrastructure_ft).toBe(graRules?.min_frontage_ft ?? 0);
      expect(result.zones['GRA']?.est_infrastructure_cost_per_parcel).toBe((graRules?.min_frontage_ft ?? 0) * 500);
    });

    it('should calculate density factors', () => {
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

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);
      const graMetrics = result.zones['GRA'];

      expect(graMetrics?.parcels_per_acre).toBeGreaterThan(0);
      expect(graMetrics?.density_factor).toBeGreaterThan(0);
      if (graMetrics) {
        expect(graMetrics.density_factor).toBe(
          Math.round((1.0 / graMetrics.parcels_per_acre) * 1000) / 1000
        );
      }
    });

    it('should compare single-family vs multi-family zones', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'SRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 800000,
          land_value: 400000,
          parcel_area_acres: 1.0,
          parcel_area_sqft: 43560,
          building_footprint_sqft: 3000,
          lot_coverage_pct: 6.9,
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

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);

      expect(result.single_family_aggregate).toBeDefined();
      expect(result.multi_family_aggregate).toBeDefined();
      expect(result.single_family_aggregate.total_parcels).toBe(1);
      expect(result.multi_family_aggregate.total_parcels).toBe(1);
    });

    it('should calculate aggregate metrics correctly', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'SRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 800000,
          land_value: 400000,
          parcel_area_acres: 1.0,
          parcel_area_sqft: 43560,
          building_footprint_sqft: 3000,
          lot_coverage_pct: 6.9,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Oak St',
          zoning: 'SRB',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 600000,
          land_value: 300000,
          parcel_area_acres: 0.5,
          parcel_area_sqft: 21780,
          building_footprint_sqft: 2500,
          lot_coverage_pct: 11.5,
          owner: 'Bob Jones',
          account: 'A003',
        },
      ];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);
      const sfAggregate = result.single_family_aggregate;

      expect(sfAggregate.total_parcels).toBe(2);
      expect(sfAggregate.total_acres).toBe(1.5);
      expect(sfAggregate.total_revenue).toBe(1400000);
      expect(sfAggregate.revenue_per_parcel).toBe(700000);
      expect(sfAggregate.revenue_per_acre).toBeCloseTo(933333, 0);
    });

    it('should calculate net fiscal impact', () => {
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
      ];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);
      const mfAggregate = result.multi_family_aggregate;

      expect(mfAggregate.net_fiscal_impact_per_parcel).toBeDefined();
      expect(mfAggregate.net_fiscal_impact_per_parcel).toBe(
        mfAggregate.revenue_per_parcel - mfAggregate.cost_per_parcel
      );
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

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);

      expect(result.zones['GRA']?.parcel_count).toBe(1);
      expect(Object.keys(result.zones)).not.toContain('null');
    });

    it('should skip zones not in zone rules', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'UNKNOWN_ZONE',
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

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);

      expect(result.zones['UNKNOWN_ZONE']).toBeUndefined();
    });

    it('should handle zones with null frontage requirements', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Municipal St',
          zoning: 'M',
          land_use_code: '901',
          land_use_desc: 'MUNICIPAL',
          total_value: 2000000,
          land_value: 1000000,
          parcel_area_acres: 5.0,
          parcel_area_sqft: 217800,
          building_footprint_sqft: 50000,
          lot_coverage_pct: 23.0,
          owner: 'City of Portsmouth',
          account: 'M001',
        },
      ];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);

      expect(result.zones['M']?.estimated_linear_infrastructure_ft).toBe(0);
      expect(result.zones['M']?.est_infrastructure_cost_per_parcel).toBe(0);
      expect(result.zones['M']?.fiscal_sustainability_ratio).toBe(0);
    });

    it('should handle empty parcel array', () => {
      const result = calculateInfrastructureMetrics([], ZONING_RULES);

      expect(Object.keys(result.zones)).toHaveLength(0);
      expect(result.single_family_aggregate.total_parcels).toBe(0);
      expect(result.multi_family_aggregate.total_parcels).toBe(0);
    });

    it('should handle zero acres in zone', () => {
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

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);

      expect(result.zones['GRA']).toBeUndefined();
    });

    it('should handle zero parcel count in zone', () => {
      const parcels: EnrichedParcel[] = [];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);

      expect(Object.keys(result.zones)).toHaveLength(0);
    });

    it('should round values appropriately', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500123.456,
          land_value: 200000,
          parcel_area_acres: 0.256789,
          parcel_area_sqft: 11185,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 17.9,
          owner: 'John Doe',
          account: 'A001',
        },
      ];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);
      const graMetrics = result.zones['GRA'];

      expect(graMetrics?.total_acres).toBe(0.26);
      expect(graMetrics?.avg_lot_size_acres).toBe(0.257);
      expect(graMetrics?.parcels_per_acre).toBe(3.89);
      expect(Number.isInteger(graMetrics?.revenue_per_parcel ?? 0)).toBe(true);
      expect(Number.isInteger(graMetrics?.revenue_per_acre ?? 0)).toBe(true);
    });

    it('should calculate infrastructure per acre for aggregates', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
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
        {
          parcel_id: '002',
          address: '456 Main St',
          zoning: 'GRB',
          land_use_code: '102',
          land_use_desc: 'MULTI FAM',
          total_value: 1000000,
          land_value: 250000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 3000,
          lot_coverage_pct: 27.5,
          owner: 'Bob Jones',
          account: 'A003',
        },
      ];

      const result = calculateInfrastructureMetrics(parcels, ZONING_RULES);
      const mfAggregate = result.multi_family_aggregate;

      expect(mfAggregate.infrastructure_per_acre).toBeGreaterThan(0);
      expect(mfAggregate.infrastructure_per_acre).toBe(
        Math.round(mfAggregate.total_infrastructure_ft / mfAggregate.total_acres)
      );
    });
  });
});
