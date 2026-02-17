/**
 * Unit tests for zoning violations checker
 */

import { describe, it, expect } from 'vitest';
import { checkZoningViolations, analyzeViolations } from './violations.js';
import { EnrichedParcel } from '../types/index.js';
import { ZoneRules } from '../zoning/rules.js';

describe('Zoning Violations Checker', () => {
  describe('checkZoningViolations', () => {
    it('should detect undersized lot violation', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: 'GRA',
        land_use_code: '130',
        land_use_desc: 'SINGLE FAM',
        total_value: 500000,
        land_value: 200000,
        parcel_area_acres: 0.15,
        parcel_area_sqft: 6534,
        building_footprint_sqft: 1500,
        lot_coverage_pct: 23.0,
        owner: 'John Doe',
        account: 'A001',
      };

      const violations = checkZoningViolations(parcel);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.type).toBe('undersized_lot');
      expect(violations[0]?.severity).toBe('major');
      expect(violations[0]?.deficit).toBe(966);
    });

    it('should detect excess lot coverage violation', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: 'GRA',
        land_use_code: '130',
        land_use_desc: 'SINGLE FAM',
        total_value: 500000,
        land_value: 200000,
        parcel_area_acres: 0.25,
        parcel_area_sqft: 10890,
        building_footprint_sqft: 4000,
        lot_coverage_pct: 36.7,
        owner: 'John Doe',
        account: 'A001',
      };

      const violations = checkZoningViolations(parcel);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.type).toBe('excess_lot_coverage');
      expect(violations[0]?.severity).toBe('major');
      expect(violations[0]?.excess_pct).toBeCloseTo(11.7, 1);
    });

    it('should detect incompatible land use violation', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Commercial St',
        zoning: 'SRA',
        land_use_code: '340',
        land_use_desc: 'COMMERCIAL',
        total_value: 800000,
        land_value: 300000,
        parcel_area_acres: 1.0,
        parcel_area_sqft: 43560,
        building_footprint_sqft: 3000,
        lot_coverage_pct: 6.9,
        owner: 'Business LLC',
        account: 'B001',
      };

      const violations = checkZoningViolations(parcel);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.type).toBe('incompatible_use');
      expect(violations[0]?.severity).toBe('critical');
      expect(violations[0]?.current_use).toBe('commercial');
      expect(violations[0]?.allowed_uses).toContain('single_family');
    });

    it('should detect multiple violations on single parcel', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: 'GRA',
        land_use_code: '340',
        land_use_desc: 'COMMERCIAL',
        total_value: 500000,
        land_value: 200000,
        parcel_area_acres: 0.15,
        parcel_area_sqft: 6534,
        building_footprint_sqft: 3000,
        lot_coverage_pct: 45.9,
        owner: 'John Doe',
        account: 'A001',
      };

      const violations = checkZoningViolations(parcel);

      expect(violations.length).toBeGreaterThanOrEqual(2);
      const types = violations.map((v) => v.type);
      expect(types).toContain('undersized_lot');
      expect(types).toContain('excess_lot_coverage');
      expect(types).toContain('incompatible_use');
    });

    it('should return empty array for compliant parcel', () => {
      const parcel: EnrichedParcel = {
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
      };

      const violations = checkZoningViolations(parcel);

      expect(violations).toHaveLength(0);
    });

    it('should skip parcels with unknown zone', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: 'UNKNOWN_ZONE',
        land_use_code: '130',
        land_use_desc: 'SINGLE FAM',
        total_value: 500000,
        land_value: 200000,
        parcel_area_acres: 0.05,
        parcel_area_sqft: 2178,
        building_footprint_sqft: 2000,
        lot_coverage_pct: 91.8,
        owner: 'John Doe',
        account: 'A001',
      };

      const violations = checkZoningViolations(parcel);

      expect(violations).toHaveLength(0);
    });

    it('should skip parcels with null zoning', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: null,
        land_use_code: '130',
        land_use_desc: 'SINGLE FAM',
        total_value: 500000,
        land_value: 200000,
        parcel_area_acres: 0.05,
        parcel_area_sqft: 2178,
        building_footprint_sqft: 2000,
        lot_coverage_pct: 91.8,
        owner: 'John Doe',
        account: 'A001',
      };

      const violations = checkZoningViolations(parcel);

      expect(violations).toHaveLength(0);
    });

    it('should skip lot coverage check when lot_coverage_pct is zero', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: 'GRA',
        land_use_code: '130',
        land_use_desc: 'SINGLE FAM',
        total_value: 500000,
        land_value: 200000,
        parcel_area_acres: 0.25,
        parcel_area_sqft: 10890,
        building_footprint_sqft: 0,
        lot_coverage_pct: 0,
        owner: 'John Doe',
        account: 'A001',
      };

      const violations = checkZoningViolations(parcel);

      const coverageViolations = violations.filter((v) => v.type === 'excess_lot_coverage');
      expect(coverageViolations).toHaveLength(0);
    });

    it('should skip land use check for vacant land', () => {
      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: 'SRA',
        land_use_code: '132',
        land_use_desc: 'VACANT',
        total_value: 200000,
        land_value: 200000,
        parcel_area_acres: 1.0,
        parcel_area_sqft: 43560,
        building_footprint_sqft: 0,
        lot_coverage_pct: 0,
        owner: 'John Doe',
        account: 'A001',
      };

      const violations = checkZoningViolations(parcel);

      const useViolations = violations.filter((v) => v.type === 'incompatible_use');
      expect(useViolations).toHaveLength(0);
    });

    it('should use custom zone rules when provided', () => {
      const customRules: Record<string, ZoneRules> = {
        'TEST': {
          name: 'Test Zone',
          min_lot_size_sqft: 20000,
          min_frontage_ft: 100,
          max_lot_coverage_pct: 30,
          min_open_space_pct: 40,
          front_setback_ft: 20,
          side_setback_ft: 10,
          rear_setback_ft: 20,
          allowed_uses: ['single_family'],
        },
      };

      const parcel: EnrichedParcel = {
        parcel_id: '001',
        address: '123 Main St',
        zoning: 'TEST',
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
      };

      const violations = checkZoningViolations(parcel, customRules);

      expect(violations).toHaveLength(1);
      expect(violations[0]?.type).toBe('undersized_lot');
    });
  });

  describe('analyzeViolations', () => {
    it('should analyze violations across multiple parcels', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.15,
          parcel_area_sqft: 6534,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 30.6,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Elm St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 600000,
          land_value: 250000,
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2500,
          lot_coverage_pct: 23.0,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = analyzeViolations(parcels);

      expect(result.total_violations).toBeGreaterThan(0);
      expect(result.total_parcels_with_violations).toBe(1);
      expect(result.violations_by_zone['GRA']).toBeDefined();
      expect(result.violations_by_zone['GRA']?.parcels_with_violations).toContain('001');
    });

    it('should group violations by zone', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.15,
          parcel_area_sqft: 6534,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 30.6,
          owner: 'John Doe',
          account: 'A001',
        },
        {
          parcel_id: '002',
          address: '456 Elm St',
          zoning: 'SRA',
          land_use_code: '340',
          land_use_desc: 'COMMERCIAL',
          total_value: 800000,
          land_value: 400000,
          parcel_area_acres: 1.0,
          parcel_area_sqft: 43560,
          building_footprint_sqft: 3000,
          lot_coverage_pct: 6.9,
          owner: 'Business LLC',
          account: 'B001',
        },
      ];

      const result = analyzeViolations(parcels);

      expect(result.violations_by_zone['GRA']).toBeDefined();
      expect(result.violations_by_zone['SRA']).toBeDefined();
    });

    it('should count violation types correctly', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '130',
          land_use_desc: 'SINGLE FAM',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.15,
          parcel_area_sqft: 6534,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 30.6,
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
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 4000,
          lot_coverage_pct: 36.7,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = analyzeViolations(parcels);

      expect(result.violation_type_summary.undersized_lot).toBe(1);
      expect(result.violation_type_summary.excess_lot_coverage).toBe(2);
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
          parcel_area_acres: 0.05,
          parcel_area_sqft: 2178,
          building_footprint_sqft: 2000,
          lot_coverage_pct: 91.8,
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
          parcel_area_acres: 0.25,
          parcel_area_sqft: 10890,
          building_footprint_sqft: 2500,
          lot_coverage_pct: 23.0,
          owner: 'Jane Smith',
          account: 'A002',
        },
      ];

      const result = analyzeViolations(parcels);

      expect(result.skipped_parcels).toBe(1);
      expect(result.total_parcels_with_violations).toBe(0);
    });

    it('should skip parcels with missing parcel_area_sqft', () => {
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
          building_footprint_sqft: 2000,
          lot_coverage_pct: 0,
          owner: 'John Doe',
          account: 'A001',
        },
      ];

      const result = analyzeViolations(parcels);

      expect(result.skipped_parcels).toBe(1);
    });

    it('should handle empty parcel array', () => {
      const result = analyzeViolations([]);

      expect(result.total_violations).toBe(0);
      expect(result.total_parcels_with_violations).toBe(0);
      expect(Object.keys(result.violations_by_zone)).toHaveLength(0);
    });

    it('should handle all compliant parcels', () => {
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

      const result = analyzeViolations(parcels);

      expect(result.total_violations).toBe(0);
      expect(result.total_parcels_with_violations).toBe(0);
      expect(Object.keys(result.violations_by_zone)).toHaveLength(0);
    });

    it('should track violations per parcel correctly', () => {
      const parcels: EnrichedParcel[] = [
        {
          parcel_id: '001',
          address: '123 Main St',
          zoning: 'GRA',
          land_use_code: '340',
          land_use_desc: 'COMMERCIAL',
          total_value: 500000,
          land_value: 200000,
          parcel_area_acres: 0.15,
          parcel_area_sqft: 6534,
          building_footprint_sqft: 3000,
          lot_coverage_pct: 45.9,
          owner: 'John Doe',
          account: 'A001',
        },
      ];

      const result = analyzeViolations(parcels);

      expect(result.violations_by_zone['GRA']?.violations_by_parcel['001']).toBeDefined();
      expect(result.violations_by_zone['GRA']?.violations_by_parcel['001']?.length).toBeGreaterThan(1);
    });
  });
});
