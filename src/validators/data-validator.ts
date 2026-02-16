/**
 * Data Validation Module for Portsmouth Zoning Analysis
 *
 * Validates data quality throughout the enrichment pipeline to ensure
 * accuracy and reliability of analysis results.
 *
 * Core Principle: Never trust external data - validate everything.
 */

import type {
  ParcelRecord,
  ValidationError,
} from '../types/index.ts';

/**
 * Portsmouth, NH geographic boundaries for coordinate validation
 * Source: Approximate bounds of Portsmouth city limits
 *
 * These bounds are used to verify that parcel coordinates fall within
 * the expected geographic area and catch data errors.
 */
const PORTSMOUTH_BOUNDS = {
  // Latitude range (North-South)
  MIN_LAT: 43.0,
  MAX_LAT: 43.1,

  // Longitude range (East-West)
  MIN_LNG: -70.85,
  MAX_LNG: -70.7,
} as const;

/**
 * Validates a parcel ID is present and non-empty
 *
 * Parcel IDs are the primary key for all data operations.
 * Missing or empty IDs make it impossible to track data provenance.
 *
 * @param parcelId - The parcel ID to validate
 * @returns ValidationError if invalid, null if valid
 */
export function validateParcelId(parcelId: unknown): ValidationError | null {
  // Check for null/undefined
  if (parcelId == null) {
    return {
      parcel_id: 'UNKNOWN',
      field: 'parcel_id',
      expected: 'non-null string',
      actual: parcelId,
      message: 'Parcel ID is null or undefined',
    };
  }

  // Check type
  if (typeof parcelId !== 'string') {
    return {
      parcel_id: String(parcelId),
      field: 'parcel_id',
      expected: 'string',
      actual: typeof parcelId,
      message: `Parcel ID must be a string, got ${typeof parcelId}`,
    };
  }

  // Check for empty string
  if (parcelId.trim() === '') {
    return {
      parcel_id: parcelId,
      field: 'parcel_id',
      expected: 'non-empty string',
      actual: parcelId,
      message: 'Parcel ID is empty or whitespace-only',
    };
  }

  return null;
}

/**
 * Validates geographic coordinates are within Portsmouth bounds
 *
 * This check catches data quality issues like:
 * - Transposed lat/lng values
 * - Coordinates from wrong municipality
 * - Malformed coordinate data
 *
 * @param latitude - Latitude value to validate
 * @param longitude - Longitude value to validate
 * @param parcelId - Parcel ID for error reporting
 * @returns ValidationError if invalid, null if valid
 */
export function validateCoordinates(
  latitude: unknown,
  longitude: unknown,
  parcelId: string
): ValidationError | null {
  // Validate latitude type
  if (typeof latitude !== 'number' || isNaN(latitude)) {
    return {
      parcel_id: parcelId,
      field: 'latitude',
      expected: 'number',
      actual: latitude,
      message: `Latitude must be a valid number, got ${typeof latitude}`,
    };
  }

  // Validate longitude type
  if (typeof longitude !== 'number' || isNaN(longitude)) {
    return {
      parcel_id: parcelId,
      field: 'longitude',
      expected: 'number',
      actual: longitude,
      message: `Longitude must be a valid number, got ${typeof longitude}`,
    };
  }

  // Check latitude bounds
  if (latitude < PORTSMOUTH_BOUNDS.MIN_LAT || latitude > PORTSMOUTH_BOUNDS.MAX_LAT) {
    return {
      parcel_id: parcelId,
      field: 'latitude',
      expected: `between ${PORTSMOUTH_BOUNDS.MIN_LAT} and ${PORTSMOUTH_BOUNDS.MAX_LAT}`,
      actual: latitude,
      message: `Latitude ${latitude} is outside Portsmouth bounds`,
    };
  }

  // Check longitude bounds
  if (longitude < PORTSMOUTH_BOUNDS.MIN_LNG || longitude > PORTSMOUTH_BOUNDS.MAX_LNG) {
    return {
      parcel_id: parcelId,
      field: 'longitude',
      expected: `between ${PORTSMOUTH_BOUNDS.MIN_LNG} and ${PORTSMOUTH_BOUNDS.MAX_LNG}`,
      actual: longitude,
      message: `Longitude ${longitude} is outside Portsmouth bounds`,
    };
  }

  return null;
}

/**
 * Validates required fields in a ParcelRecord
 *
 * Ensures the CSV parser loaded all critical fields needed for
 * downstream processing and enrichment.
 *
 * @param record - Parcel record from CSV
 * @returns Array of validation errors (empty if valid)
 */
export function validateParcelRecord(record: ParcelRecord): ValidationError[] {
  const errors: ValidationError[] = [];

  // Validate parcel ID (displayid)
  const idError = validateParcelId(record.displayid);
  if (idError) {
    errors.push(idError);
  }

  // Validate PID field (alternative ID)
  if (!record.pid || record.pid.trim() === '') {
    errors.push({
      parcel_id: record.displayid || 'UNKNOWN',
      field: 'pid',
      expected: 'non-empty string',
      actual: record.pid,
      message: 'PID field is required but empty',
    });
  }

  // Validate street address (needed for human-readable output)
  if (!record.streetaddress || record.streetaddress.trim() === '') {
    errors.push({
      parcel_id: record.displayid || 'UNKNOWN',
      field: 'streetaddress',
      expected: 'non-empty string',
      actual: record.streetaddress,
      message: 'Street address is required but empty',
    });
  }

  return errors;
}

/**
 * Validates Map Geo API response structure and required fields
 *
 * The Map Geo API provides geographic and zoning data. This validation
 * ensures we received a well-formed response before attempting to
 * extract values.
 *
 * @param response - API response to validate
 * @param parcelId - Parcel ID for error reporting
 * @returns Array of validation errors (empty if valid)
 */
export function validateMapGeoResponse(
  response: unknown,
  parcelId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check response is an object
  if (typeof response !== 'object' || response === null) {
    errors.push({
      parcel_id: parcelId,
      field: 'response',
      expected: 'object',
      actual: typeof response,
      message: 'Map Geo response must be an object',
    });
    return errors; // Can't validate further
  }

  const resp = response as Record<string, unknown>;

  // Check data field exists and is an object
  if (!resp['data'] || typeof resp['data'] !== 'object') {
    errors.push({
      parcel_id: parcelId,
      field: 'data',
      expected: 'object',
      actual: typeof resp['data'],
      message: 'Map Geo response must contain a data object',
    });
    return errors; // Can't validate further
  }

  const data = resp['data'] as Record<string, unknown>;

  // Validate parcel ID matches if present (data integrity check)
  if (data['propID'] && data['propID'] !== parcelId) {
    errors.push({
      parcel_id: parcelId,
      field: 'propID',
      expected: parcelId,
      actual: data['propID'],
      message: `Response propID ${data['propID']} does not match requested parcel ${parcelId}`,
    });
  }

  // Validate numeric fields are actually numbers if present
  const numericFields = ['totalValue', 'landValue', 'parcelArea'];
  for (const field of numericFields) {
    const value = data[field];
    if (value !== undefined && value !== null) {
      // Allow string or number (will be converted later)
      if (typeof value !== 'number' && typeof value !== 'string') {
        errors.push({
          parcel_id: parcelId,
          field,
          expected: 'number or string',
          actual: typeof value,
          message: `Field ${field} must be a number or string, got ${typeof value}`,
        });
      }
    }
  }

  return errors;
}

/**
 * Validates VGSI API response structure and data types
 *
 * The VGSI API provides building measurements extracted from HTML.
 * This validation ensures extracted values are valid numbers.
 *
 * @param response - API response to validate
 * @param parcelId - Parcel ID for error reporting
 * @returns Array of validation errors (empty if valid)
 */
export function validateVGSIResponse(
  response: unknown,
  parcelId: string
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Check response is an object
  if (typeof response !== 'object' || response === null) {
    errors.push({
      parcel_id: parcelId,
      field: 'response',
      expected: 'object',
      actual: typeof response,
      message: 'VGSI response must be an object',
    });
    return errors; // Can't validate further
  }

  const resp = response as Record<string, unknown>;

  // Validate living_area_sqft is a number if present
  if (resp['living_area_sqft'] !== undefined) {
    const livingArea = resp['living_area_sqft'];
    if (typeof livingArea !== 'number' || isNaN(livingArea)) {
      errors.push({
        parcel_id: parcelId,
        field: 'living_area_sqft',
        expected: 'number',
        actual: livingArea,
        message: `living_area_sqft must be a valid number, got ${typeof livingArea}`,
      });
    } else if (livingArea < 0) {
      errors.push({
        parcel_id: parcelId,
        field: 'living_area_sqft',
        expected: 'positive number',
        actual: livingArea,
        message: `living_area_sqft cannot be negative: ${livingArea}`,
      });
    }
  }

  // Validate building_footprint_sqft is a number if present
  if (resp['building_footprint_sqft'] !== undefined) {
    const footprint = resp['building_footprint_sqft'];
    if (typeof footprint !== 'number' || isNaN(footprint)) {
      errors.push({
        parcel_id: parcelId,
        field: 'building_footprint_sqft',
        expected: 'number',
        actual: footprint,
        message: `building_footprint_sqft must be a valid number, got ${typeof footprint}`,
      });
    } else if (footprint < 0) {
      errors.push({
        parcel_id: parcelId,
        field: 'building_footprint_sqft',
        expected: 'positive number',
        actual: footprint,
        message: `building_footprint_sqft cannot be negative: ${footprint}`,
      });
    }
  }

  return errors;
}

/**
 * Validates all data types in an enriched parcel object
 *
 * Final validation before writing output to ensure all fields
 * have correct types and reasonable values.
 *
 * @param parcel - Enriched parcel to validate
 * @returns Array of validation errors (empty if valid)
 */
export function validateEnrichedParcel(
  parcel: Record<string, unknown>
): ValidationError[] {
  const errors: ValidationError[] = [];
  const parcelId = String(parcel['parcel_id'] || 'UNKNOWN');

  // Validate required string fields
  const stringFields = ['parcel_id', 'address'];
  for (const field of stringFields) {
    const value = parcel[field];
    if (typeof value !== 'string' || value.trim() === '') {
      errors.push({
        parcel_id: parcelId,
        field,
        expected: 'non-empty string',
        actual: value,
        message: `Field ${field} must be a non-empty string`,
      });
    }
  }

  // Validate required numeric fields
  const numericFields = [
    'total_value',
    'land_value',
    'parcel_area_acres',
    'parcel_area_sqft',
    'building_footprint_sqft',
    'lot_coverage_pct',
  ];

  for (const field of numericFields) {
    const value = parcel[field];
    if (typeof value !== 'number' || isNaN(value)) {
      errors.push({
        parcel_id: parcelId,
        field,
        expected: 'number',
        actual: value,
        message: `Field ${field} must be a valid number, got ${typeof value}`,
      });
    } else if (value < 0 && field !== 'lot_coverage_pct') {
      // lot_coverage_pct can be negative in error cases, others shouldn't be
      errors.push({
        parcel_id: parcelId,
        field,
        expected: 'non-negative number',
        actual: value,
        message: `Field ${field} cannot be negative: ${value}`,
      });
    }
  }

  return errors;
}
