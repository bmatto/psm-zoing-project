/**
 * Unit tests for data validation module
 *
 * Tests cover all validation rules with success and failure cases
 */

import { describe, it, expect } from 'vitest';
import {
  validateParcelId,
  validateCoordinates,
  validateParcelRecord,
  validateMapGeoResponse,
  validateVGSIResponse,
  validateEnrichedParcel,
} from './data-validator.ts';
import type { ParcelRecord } from '../types/index.ts';

describe('validateParcelId', () => {
  it('should return null for valid parcel ID', () => {
    const result = validateParcelId('0292-0135-0000');
    expect(result).toBeNull();
  });

  it('should reject null parcel ID', () => {
    const result = validateParcelId(null);
    expect(result).not.toBeNull();
    expect(result?.message).toContain('null or undefined');
  });

  it('should reject undefined parcel ID', () => {
    const result = validateParcelId(undefined);
    expect(result).not.toBeNull();
    expect(result?.message).toContain('null or undefined');
  });

  it('should reject non-string parcel ID', () => {
    const result = validateParcelId(12345);
    expect(result).not.toBeNull();
    expect(result?.message).toContain('must be a string');
  });

  it('should reject empty string parcel ID', () => {
    const result = validateParcelId('');
    expect(result).not.toBeNull();
    expect(result?.message).toContain('empty');
  });

  it('should reject whitespace-only parcel ID', () => {
    const result = validateParcelId('   ');
    expect(result).not.toBeNull();
    expect(result?.message).toContain('empty');
  });
});

describe('validateCoordinates', () => {
  it('should return null for valid Portsmouth coordinates', () => {
    // Center of Portsmouth approximately
    const result = validateCoordinates(43.07, -70.76, '0292-0135-0000');
    expect(result).toBeNull();
  });

  it('should accept coordinates at minimum bounds', () => {
    const result = validateCoordinates(43.0, -70.85, '0292-0135-0000');
    expect(result).toBeNull();
  });

  it('should accept coordinates at maximum bounds', () => {
    const result = validateCoordinates(43.1, -70.7, '0292-0135-0000');
    expect(result).toBeNull();
  });

  it('should reject latitude below minimum', () => {
    const result = validateCoordinates(42.9, -70.76, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('latitude');
    expect(result?.message).toContain('outside Portsmouth bounds');
  });

  it('should reject latitude above maximum', () => {
    const result = validateCoordinates(43.2, -70.76, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('latitude');
  });

  it('should reject longitude below minimum', () => {
    const result = validateCoordinates(43.07, -71.0, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('longitude');
    expect(result?.message).toContain('outside Portsmouth bounds');
  });

  it('should reject longitude above maximum', () => {
    const result = validateCoordinates(43.07, -70.5, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('longitude');
  });

  it('should reject non-numeric latitude', () => {
    const result = validateCoordinates('43.07' as any, -70.76, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('latitude');
    expect(result?.message).toContain('must be a valid number');
  });

  it('should reject non-numeric longitude', () => {
    const result = validateCoordinates(43.07, '-70.76' as any, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('longitude');
    expect(result?.message).toContain('must be a valid number');
  });

  it('should reject NaN latitude', () => {
    const result = validateCoordinates(NaN, -70.76, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('latitude');
  });

  it('should reject NaN longitude', () => {
    const result = validateCoordinates(43.07, NaN, '0292-0135-0000');
    expect(result).not.toBeNull();
    expect(result?.field).toBe('longitude');
  });
});

describe('validateParcelRecord', () => {
  const validRecord: ParcelRecord = {
    town: 'Portsmouth',
    slum: '',
    localnbc: '118',
    pid: '0292-0135-0000',
    townid: '178',
    nbc: '17',
    oid_1: '',
    sluc: '11',
    u_id: '178-32597',
    countyid: '8',
    name: 'CamaID: 0292-0135-0000',
    streetaddress: '17 WINCHESTER ST',
    parceloid: '483569',
    nh_gis_id: '08178-0292-0135-0000',
    displayid: '0292-0135-0000',
    SHAPE__Length: '349.04389828291',
    slu: '11',
    objectid: '177454',
    SHAPE__Area: '7404.93083891854',
  };

  it('should return empty array for valid record', () => {
    const errors = validateParcelRecord(validRecord);
    expect(errors).toHaveLength(0);
  });

  it('should detect missing displayid', () => {
    const record = { ...validRecord, displayid: '' };
    const errors = validateParcelRecord(record);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'parcel_id')).toBe(true);
  });

  it('should detect missing pid', () => {
    const record = { ...validRecord, pid: '' };
    const errors = validateParcelRecord(record);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'pid')).toBe(true);
  });

  it('should detect missing street address', () => {
    const record = { ...validRecord, streetaddress: '' };
    const errors = validateParcelRecord(record);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'streetaddress')).toBe(true);
  });

  it('should detect multiple missing fields', () => {
    const record = { ...validRecord, displayid: '', pid: '', streetaddress: '' };
    const errors = validateParcelRecord(record);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });
});

describe('validateMapGeoResponse', () => {
  it('should return empty array for valid response', () => {
    const response = {
      data: {
        propID: '0292-0135-0000',
        displayName: '17 WINCHESTER ST',
        zoningCode: 'R1',
        totalValue: 450000,
        landValue: 150000,
        parcelArea: 7404.93,
      },
    };
    const errors = validateMapGeoResponse(response, '0292-0135-0000');
    expect(errors).toHaveLength(0);
  });

  it('should accept string values for numeric fields', () => {
    const response = {
      data: {
        propID: '0292-0135-0000',
        totalValue: '450000',
        landValue: '150000',
        parcelArea: '7404.93',
      },
    };
    const errors = validateMapGeoResponse(response, '0292-0135-0000');
    expect(errors).toHaveLength(0);
  });

  it('should reject non-object response', () => {
    const errors = validateMapGeoResponse('invalid', '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('must be an object');
  });

  it('should reject null response', () => {
    const errors = validateMapGeoResponse(null, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject missing data field', () => {
    const response = { other: {} };
    const errors = validateMapGeoResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.field).toBe('data');
  });

  it('should reject non-object data field', () => {
    const response = { data: 'invalid' };
    const errors = validateMapGeoResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.field).toBe('data');
  });

  it('should detect propID mismatch', () => {
    const response = {
      data: {
        propID: '9999-9999-9999',
        totalValue: 450000,
      },
    };
    const errors = validateMapGeoResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'propID')).toBe(true);
  });

  it('should reject invalid type for numeric field', () => {
    const response = {
      data: {
        propID: '0292-0135-0000',
        totalValue: { invalid: true },
      },
    };
    const errors = validateMapGeoResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'totalValue')).toBe(true);
  });

  it('should allow optional fields to be missing', () => {
    const response = {
      data: {
        propID: '0292-0135-0000',
      },
    };
    const errors = validateMapGeoResponse(response, '0292-0135-0000');
    expect(errors).toHaveLength(0);
  });
});

describe('validateVGSIResponse', () => {
  it('should return empty array for valid response', () => {
    const response = {
      living_area_sqft: 2400,
      building_footprint_sqft: 1800,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors).toHaveLength(0);
  });

  it('should allow empty response object', () => {
    const response = {};
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors).toHaveLength(0);
  });

  it('should allow missing living_area_sqft', () => {
    const response = {
      building_footprint_sqft: 1800,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors).toHaveLength(0);
  });

  it('should allow missing building_footprint_sqft', () => {
    const response = {
      living_area_sqft: 2400,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors).toHaveLength(0);
  });

  it('should reject non-object response', () => {
    const errors = validateVGSIResponse('invalid', '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.message).toContain('must be an object');
  });

  it('should reject null response', () => {
    const errors = validateVGSIResponse(null, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should reject non-numeric living_area_sqft', () => {
    const response = {
      living_area_sqft: '2400' as any,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.field).toBe('living_area_sqft');
  });

  it('should reject NaN living_area_sqft', () => {
    const response = {
      living_area_sqft: NaN,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.field).toBe('living_area_sqft');
  });

  it('should reject negative living_area_sqft', () => {
    const response = {
      living_area_sqft: -2400,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('negative'))).toBe(true);
  });

  it('should reject non-numeric building_footprint_sqft', () => {
    const response = {
      building_footprint_sqft: '1800' as any,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]?.field).toBe('building_footprint_sqft');
  });

  it('should reject negative building_footprint_sqft', () => {
    const response = {
      building_footprint_sqft: -1800,
    };
    const errors = validateVGSIResponse(response, '0292-0135-0000');
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('negative'))).toBe(true);
  });
});

describe('validateEnrichedParcel', () => {
  const validParcel = {
    parcel_id: '0292-0135-0000',
    address: '17 WINCHESTER ST',
    zoning: 'R1',
    land_use_code: '11',
    land_use_desc: 'Residential',
    total_value: 450000,
    land_value: 150000,
    parcel_area_acres: 0.17,
    parcel_area_sqft: 7404.93,
    building_footprint_sqft: 1800,
    living_area_sqft: 2400,
    lot_coverage_pct: 24.3,
    owner: 'John Doe',
    account: '0292-0135-0000',
  };

  it('should return empty array for valid enriched parcel', () => {
    const errors = validateEnrichedParcel(validParcel);
    expect(errors).toHaveLength(0);
  });

  it('should reject missing parcel_id', () => {
    const parcel = { ...validParcel, parcel_id: '' };
    const errors = validateEnrichedParcel(parcel);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'parcel_id')).toBe(true);
  });

  it('should reject missing address', () => {
    const parcel = { ...validParcel, address: '' };
    const errors = validateEnrichedParcel(parcel);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'address')).toBe(true);
  });

  it('should reject non-numeric total_value', () => {
    const parcel = { ...validParcel, total_value: '450000' };
    const errors = validateEnrichedParcel(parcel);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'total_value')).toBe(true);
  });

  it('should reject negative total_value', () => {
    const parcel = { ...validParcel, total_value: -450000 };
    const errors = validateEnrichedParcel(parcel);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.message.includes('negative'))).toBe(true);
  });

  it('should reject NaN numeric field', () => {
    const parcel = { ...validParcel, parcel_area_acres: NaN };
    const errors = validateEnrichedParcel(parcel);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'parcel_area_acres')).toBe(true);
  });

  it('should allow negative lot_coverage_pct', () => {
    // lot_coverage_pct can be negative in error cases
    const parcel = { ...validParcel, lot_coverage_pct: -1 };
    const errors = validateEnrichedParcel(parcel);
    // Should not have an error for negative lot_coverage_pct
    expect(
      errors.some((e) => e.field === 'lot_coverage_pct' && e.message.includes('negative'))
    ).toBe(false);
  });

  it('should detect multiple validation errors', () => {
    const parcel = {
      ...validParcel,
      parcel_id: '',
      address: '',
      total_value: 'invalid' as any,
    };
    const errors = validateEnrichedParcel(parcel);
    expect(errors.length).toBeGreaterThanOrEqual(3);
  });

  it('should reject non-string parcel_id', () => {
    const parcel = { ...validParcel, parcel_id: 12345 };
    const errors = validateEnrichedParcel(parcel);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.field === 'parcel_id')).toBe(true);
  });
});
