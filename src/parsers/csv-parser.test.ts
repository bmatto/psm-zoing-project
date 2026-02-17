/**
 * Unit tests for CSV parser
 */

import { describe, it, expect } from 'vitest';
import { writeFileSync, unlinkSync, mkdirSync } from 'fs';
import { join } from 'path';
import { loadParcels, isValidParcel } from './csv-parser.js';
import { ParcelRecord } from '../types/index.js';

const TEST_DATA_DIR = join(process.cwd(), 'test-data');
const TEST_CSV_PATH = join(TEST_DATA_DIR, 'test-parcels.csv');

describe('CSV Parser', () => {
  describe('loadParcels', () => {
    it('should parse valid CSV with UTF-8 BOM', () => {
      // Create test CSV with BOM (Byte Order Mark)
      const csvContent = '\ufefftown,slum,localnbc,pid,townid,nbc,oid_1,sluc,u_id,countyid,name,streetaddress,parceloid,nh_gis_id,displayid,SHAPE__Length,slu,objectid,SHAPE__Area\n' +
        'Portsmouth,,118,0292-0135-0000,178,17,,11,178-32597,8,CamaID: 0292-0135-0000,17 WINCHESTER ST,483569,08178-0292-0135-0000,0292-0135-0000,349.04389828291,11,177454,7404.93083891854\n' +
        'Portsmouth,,118,0292-0108-0000,178,17,,11,178-32570,8,CamaID: 0292-0108-0000,54 WINCHESTER ST,483570,08178-0292-0108-0000,0292-0108-0000,499.920910878677,11,177455,15122.0173889917';

      mkdirSync(TEST_DATA_DIR, { recursive: true });
      writeFileSync(TEST_CSV_PATH, csvContent, 'utf-8');

      const result = loadParcels(TEST_CSV_PATH);

      expect(result.parcels).toHaveLength(2);
      expect(result.malformedRows).toHaveLength(0);
      expect(result.parcels[0]?.displayid).toBe('0292-0135-0000');
      expect(result.parcels[0]?.streetaddress).toBe('17 WINCHESTER ST');
      expect(result.parcels[1]?.displayid).toBe('0292-0108-0000');
      expect(result.parcels[1]?.streetaddress).toBe('54 WINCHESTER ST');

      unlinkSync(TEST_CSV_PATH);
    });

    it('should return typed ParcelRecord array', () => {
      const csvContent = 'town,slum,localnbc,pid,townid,nbc,oid_1,sluc,u_id,countyid,name,streetaddress,parceloid,nh_gis_id,displayid,SHAPE__Length,slu,objectid,SHAPE__Area\n' +
        'Portsmouth,,118,0292-0135-0000,178,17,,11,178-32597,8,CamaID: 0292-0135-0000,17 WINCHESTER ST,483569,08178-0292-0135-0000,0292-0135-0000,349.04389828291,11,177454,7404.93083891854';

      mkdirSync(TEST_DATA_DIR, { recursive: true });
      writeFileSync(TEST_CSV_PATH, csvContent, 'utf-8');

      const result = loadParcels(TEST_CSV_PATH);

      // Verify type structure
      const parcel = result.parcels[0];
      expect(parcel).toBeDefined();
      expect(typeof parcel?.displayid).toBe('string');
      expect(typeof parcel?.pid).toBe('string');
      expect(typeof parcel?.town).toBe('string');

      unlinkSync(TEST_CSV_PATH);
    });

    it('should log parcel count', () => {
      const csvContent = 'town,slum,localnbc,pid,townid,nbc,oid_1,sluc,u_id,countyid,name,streetaddress,parceloid,nh_gis_id,displayid,SHAPE__Length,slu,objectid,SHAPE__Area\n' +
        'Portsmouth,,118,0292-0135-0000,178,17,,11,178-32597,8,CamaID: 0292-0135-0000,17 WINCHESTER ST,483569,08178-0292-0135-0000,0292-0135-0000,349.04389828291,11,177454,7404.93083891854';

      mkdirSync(TEST_DATA_DIR, { recursive: true });
      writeFileSync(TEST_CSV_PATH, csvContent, 'utf-8');

      const result = loadParcels(TEST_CSV_PATH);
      expect(result.parcels).toHaveLength(1);
      expect(result.malformedRows).toHaveLength(0);

      unlinkSync(TEST_CSV_PATH);
    });

    it('should throw error if file is missing', () => {
      expect(() => loadParcels('/nonexistent/file.csv')).toThrow('Failed to read CSV file');
    });

    it('should throw error if CSV is malformed', () => {
      const malformedCsv = 'town,pid\n"unclosed quote';

      mkdirSync(TEST_DATA_DIR, { recursive: true });
      writeFileSync(TEST_CSV_PATH, malformedCsv, 'utf-8');

      expect(() => loadParcels(TEST_CSV_PATH)).toThrow('Failed to parse CSV file');

      unlinkSync(TEST_CSV_PATH);
    });

    it('should track rows with missing displayid as malformed', () => {
      const csvContent = 'town,slum,localnbc,pid,townid,nbc,oid_1,sluc,u_id,countyid,name,streetaddress,parceloid,nh_gis_id,displayid,SHAPE__Length,slu,objectid,SHAPE__Area\n' +
        'Portsmouth,,118,0292-0135-0000,178,17,,11,178-32597,8,CamaID: 0292-0135-0000,17 WINCHESTER ST,483569,08178-0292-0135-0000,,349.04389828291,11,177454,7404.93083891854';

      mkdirSync(TEST_DATA_DIR, { recursive: true });
      writeFileSync(TEST_CSV_PATH, csvContent, 'utf-8');

      const result = loadParcels(TEST_CSV_PATH);

      expect(result.parcels).toHaveLength(0);
      expect(result.malformedRows).toHaveLength(1);
      expect(result.malformedRows[0]?.error).toContain("Missing required field 'displayid'");
      expect(result.malformedRows[0]?.rowNumber).toBe(2);

      unlinkSync(TEST_CSV_PATH);
    });

    it('should track rows with missing pid as malformed', () => {
      const csvContent = 'town,slum,localnbc,pid,townid,nbc,oid_1,sluc,u_id,countyid,name,streetaddress,parceloid,nh_gis_id,displayid,SHAPE__Length,slu,objectid,SHAPE__Area\n' +
        'Portsmouth,,118,,178,17,,11,178-32597,8,CamaID: 0292-0135-0000,17 WINCHESTER ST,483569,08178-0292-0135-0000,0292-0135-0000,349.04389828291,11,177454,7404.93083891854';

      mkdirSync(TEST_DATA_DIR, { recursive: true });
      writeFileSync(TEST_CSV_PATH, csvContent, 'utf-8');

      const result = loadParcels(TEST_CSV_PATH);

      expect(result.parcels).toHaveLength(0);
      expect(result.malformedRows).toHaveLength(1);
      expect(result.malformedRows[0]?.error).toContain("Missing required field 'pid'");
      expect(result.malformedRows[0]?.rowNumber).toBe(2);

      unlinkSync(TEST_CSV_PATH);
    });
  });

  describe('isValidParcel', () => {
    it('should return true for valid parcel', () => {
      const parcel: ParcelRecord = {
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

      expect(isValidParcel(parcel)).toBe(true);
    });

    it('should return false if displayid is missing', () => {
      const parcel: ParcelRecord = {
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
        displayid: '',
        SHAPE__Length: '349.04389828291',
        slu: '11',
        objectid: '177454',
        SHAPE__Area: '7404.93083891854',
      };

      expect(isValidParcel(parcel)).toBe(false);
    });

    it('should return false if pid is missing', () => {
      const parcel: ParcelRecord = {
        town: 'Portsmouth',
        slum: '',
        localnbc: '118',
        pid: '',
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

      expect(isValidParcel(parcel)).toBe(false);
    });
  });
});
