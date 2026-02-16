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
 * Loads and parses Portsmouth parcel data from CSV file
 *
 * @param csvPath - Path to Portsmouth_Parcels.csv file
 * @returns Array of parsed and validated parcel records
 * @throws Error if file is missing, malformed, or contains invalid data
 */
export function loadParcels(csvPath: string): ParcelRecord[] {
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
  const errors: string[] = [];

  for (let i = 0; i < records.length; i++) {
    const row = records[i];
    if (!row) continue; // Skip undefined rows

    const rowNumber = i + 2; // +2 because: 1-indexed + header row

    // Validate required fields
    if (!row['displayid'] || row['displayid'].trim() === '') {
      errors.push(`Row ${rowNumber}: Missing required field 'displayid'`);
      continue;
    }

    if (!row['pid'] || row['pid'].trim() === '') {
      errors.push(`Row ${rowNumber}: Missing required field 'pid' (Parcel ID: ${row['displayid']})`);
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

  // If we have validation errors, throw with details
  if (errors.length > 0) {
    throw new Error(
      `CSV validation failed with ${errors.length} error(s):\n${errors.slice(0, 10).join('\n')}${
        errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : ''
      }`
    );
  }

  console.log(`✓ Loaded ${parcels.length} parcels from CSV`);
  return parcels;
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
