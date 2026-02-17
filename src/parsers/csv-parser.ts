/**
 * CSV Parser for Portsmouth Parcel Data
 *
 * Reads and parses the Portsmouth_Parcels.csv file from the State GIS database,
 * returning a typed array of parcel records with validation.
 */

import { parse } from 'csv-parse/sync';
import { readFileSync } from 'fs';
import { ParcelRecord } from '../types/index.js';

/**
 * Result from loading parcels with validation tracking
 */
export interface LoadParcelsResult {
  /** Successfully parsed and validated parcels */
  parcels: ParcelRecord[];
  /** Rows that failed validation with error details */
  malformedRows: Array<{
    rowNumber: number;
    error: string;
    rawData?: Record<string, string>;
  }>;
}

/**
 * Loads and parses Portsmouth parcel data from CSV file
 *
 * @param csvPath - Path to Portsmouth_Parcels.csv file
 * @returns Object with valid parcels and malformed row information
 * @throws Error only if file is missing or completely unparseable
 */
export function loadParcels(csvPath: string): LoadParcelsResult {
  console.log(`Loading parcels from: ${csvPath}`);

  // Read the CSV file
  let fileContent: string;
  try {
    fileContent = readFileSync(csvPath, { encoding: 'utf-8' });
  } catch (error) {
    throw new Error(
      `Failed to read CSV file at ${csvPath}: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Parse CSV with csv-parse library
  let records: Record<string, string>[];
  try {
    records = parse(fileContent, {
      columns: true, // Use first row as column names
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle BOM (Byte Order Mark) in UTF-8 files
    });
  } catch (error) {
    throw new Error(
      `Failed to parse CSV file: ${error instanceof Error ? error.message : String(error)}`
    );
  }

  // Validate and transform records
  const parcels: ParcelRecord[] = [];
  const malformedRows: Array<{
    rowNumber: number;
    error: string;
    rawData?: Record<string, string>;
  }> = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (!row) continue; // Skip undefined rows

    const rowNumber = i + 2; // +2 because: 1-indexed + header row

    // Validate required fields
    if (!row['displayid'] || row['displayid'].trim() === '') {
      malformedRows.push({
        rowNumber,
        error: "Missing required field 'displayid'",
        rawData: row,
      });
      continue;
    }

    if (!row['pid'] || row['pid'].trim() === '') {
      malformedRows.push({
        rowNumber,
        error: `Missing required field 'pid' (Parcel ID: ${row['displayid']})`,
        rawData: row,
      });
      continue;
    }

    // Create typed parcel record
    const parcel: ParcelRecord = {
      town: row['town'] || '',
      slum: row['slum'] || '',
      localnbc: row['localnbc'] || '',
      pid: row['pid'] || '',
      townid: row['townid'] || '',
      nbc: row['nbc'] || '',
      oid_1: row['oid_1'] || '',
      sluc: row['sluc'] || '',
      u_id: row['u_id'] || '',
      countyid: row['countyid'] || '',
      name: row['name'] || '',
      streetaddress: row['streetaddress'] || '',
      parceloid: row['parceloid'] || '',
      nh_gis_id: row['nh_gis_id'] || '',
      displayid: row['displayid'] || '',
      SHAPE__Length: row['SHAPE__Length'] || '',
      slu: row['slu'] || '',
      objectid: row['objectid'] || '',
      SHAPE__Area: row['SHAPE__Area'] || '',
    };

    parcels.push(parcel);
  }

  // Report on parsing results - track malformed rows but don't fail
  const totalRows = records.length;
  console.log(`✓ Loaded ${parcels.length} valid parcels from ${totalRows} CSV rows`);

  if (malformedRows.length > 0) {
    console.warn(`⚠️  Warning: ${malformedRows.length} malformed rows skipped`);
    console.warn(`  First few errors:`);
    for (const malformed of malformedRows.slice(0, 5)) {
      console.warn(`    Row ${malformed.rowNumber}: ${malformed.error}`);
    }
    if (malformedRows.length > 5) {
      console.warn(`    ... and ${malformedRows.length - 5} more malformed rows`);
    }
  }

  return {
    parcels,
    malformedRows,
  };
}

/**
 * Validates that a parcel record has the minimum required data
 *
 * @param parcel - Parcel record to validate
 * @returns true if parcel is valid, false otherwise
 */
export function isValidParcel(parcel: ParcelRecord): boolean {
  // Must have display ID (primary identifier)
  if (!parcel.displayid || parcel.displayid.trim() === '') {
    return false;
  }

  // Must have parcel ID
  if (!parcel.pid || parcel.pid.trim() === '') {
    return false;
  }

  return true;
}
