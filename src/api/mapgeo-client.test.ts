/**
 * Unit tests for MapGeoClient
 *
 * Tests cover:
 * - Successful API responses
 * - Error handling and retries
 * - Rate limiting
 * - Response validation
 * - Edge cases (empty IDs, timeouts, etc.)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MapGeoClient } from './mapgeo-client.js';
import type { MapGeoResponse } from '../types/index.js';

describe('MapGeoClient', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // Mock global fetch
    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchParcelData', () => {
    it('should fetch parcel data successfully', async () => {
      const mockResponse: MapGeoResponse = {
        data: {
          propID: '123-456',
          displayName: '123 Main St',
          zoningCode: 'R1',
          landUseCode: '101',
          lndUseDesc: 'Single Family',
          totalValue: 500000,
          landValue: 200000,
          parcelArea: 10000,
          ownerName: 'John Doe',
          account: 'ACC123',
        },
      };

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockResponse,
      });

      const client = new MapGeoClient();
      const result = await client.fetchParcelData('123-456');

      expect(result).toEqual(mockResponse);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'https://portsmouthnh.mapgeo.io/api/ui/datasets/properties/123-456',
        expect.objectContaining({
          headers: { Accept: 'application/json' },
        })
      );
    });

    it('should handle empty parcel ID', async () => {
      const client = new MapGeoClient();

      await expect(client.fetchParcelData('')).rejects.toThrow('Parcel ID cannot be empty');
      await expect(client.fetchParcelData('  ')).rejects.toThrow('Parcel ID cannot be empty');
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('should retry on network errors up to maxRetries', async () => {
      fetchMock
        .mockRejectedValueOnce(new Error('Network error 1'))
        .mockRejectedValueOnce(new Error('Network error 2'))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { propID: '123' } }),
        });

      const client = new MapGeoClient({ maxRetries: 3 });
      const result = await client.fetchParcelData('123-456');

      expect(result).toEqual({ data: { propID: '123' } });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should fail after maxRetries attempts', async () => {
      fetchMock.mockRejectedValue(new Error('Persistent network error'));

      const client = new MapGeoClient({ maxRetries: 3 });

      await expect(client.fetchParcelData('123-456')).rejects.toThrow(
        /Failed to fetch Map Geo data for parcel 123-456 after 3 attempts/
      );

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should handle HTTP error responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const client = new MapGeoClient({ maxRetries: 1 });

      await expect(client.fetchParcelData('invalid-id')).rejects.toThrow(
        /Failed to fetch Map Geo data.*HTTP 404/
      );
    });

    it('should validate response structure', async () => {
      // Response missing 'data' field
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ wrongField: 'value' }),
      });

      const client = new MapGeoClient({ maxRetries: 1 });

      await expect(client.fetchParcelData('123-456')).rejects.toThrow(
        /Invalid response structure from Map Geo API/
      );
    });

    it('should validate that data field is an object', async () => {
      // Response has 'data' but it's not an object
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: 'not an object' }),
      });

      const client = new MapGeoClient({ maxRetries: 1 });

      await expect(client.fetchParcelData('123-456')).rejects.toThrow(
        /Invalid response structure/
      );
    });

    it('should handle null or undefined responses', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => null,
      });

      const client = new MapGeoClient({ maxRetries: 1 });

      await expect(client.fetchParcelData('123-456')).rejects.toThrow(
        /Invalid response structure/
      );
    });

    it('should URL-encode parcel IDs', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const client = new MapGeoClient();
      await client.fetchParcelData('123/456 test');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://portsmouthnh.mapgeo.io/api/ui/datasets/properties/123%2F456%20test',
        expect.any(Object)
      );
    });

    it('should use custom baseUrl when provided', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ data: {} }),
      });

      const client = new MapGeoClient({
        baseUrl: 'https://custom.api.com/parcels',
      });

      await client.fetchParcelData('123-456');

      expect(fetchMock).toHaveBeenCalledWith(
        'https://custom.api.com/parcels/123-456',
        expect.any(Object)
      );
    });

    it('should enforce rate limiting between requests', async () => {
      const requestTimes: number[] = [];

      fetchMock.mockImplementation(async () => {
        requestTimes.push(Date.now());
        return {
          ok: true,
          json: async () => ({ data: {} }),
        };
      });

      const client = new MapGeoClient({ maxRequestsPerSecond: 10 }); // 100ms between requests

      await client.fetchParcelData('123-1');
      await client.fetchParcelData('123-2');
      await client.fetchParcelData('123-3');

      // Check that requests are at least 100ms apart
      expect(requestTimes[1]! - requestTimes[0]!).toBeGreaterThanOrEqual(95); // Allow 5ms tolerance
      expect(requestTimes[2]! - requestTimes[1]!).toBeGreaterThanOrEqual(95);
    });
  });

  describe('fetchMultipleParcels', () => {
    it('should fetch multiple parcels successfully', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { propID: '123' } }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { propID: '456' } }),
        });

      const client = new MapGeoClient({ maxRequestsPerSecond: 1000 }); // Fast for testing
      const results = await client.fetchMultipleParcels(['123', '456']);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        parcelId: '123',
        data: { data: { propID: '123' } },
      });
      expect(results[1]).toEqual({
        parcelId: '456',
        data: { data: { propID: '456' } },
      });
    });

    it('should handle mixed success and failure', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({ data: { propID: '123' } }),
        })
        .mockRejectedValueOnce(new Error('Network error'));

      const client = new MapGeoClient({ maxRetries: 1, maxRequestsPerSecond: 1000 });
      const results = await client.fetchMultipleParcels(['123', '456']);

      expect(results).toHaveLength(2);
      expect(results[0]).toHaveProperty('data');
      expect(results[1]).toHaveProperty('error');
      expect(results[1]?.error).toContain('Network error');
    });

    it('should handle empty array', async () => {
      const client = new MapGeoClient();
      const results = await client.fetchMultipleParcels([]);

      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use default configuration', () => {
      const client = new MapGeoClient();
      expect(client).toBeInstanceOf(MapGeoClient);
    });

    it('should accept custom configuration', () => {
      const client = new MapGeoClient({
        baseUrl: 'https://custom.com',
        maxRetries: 5,
        maxRequestsPerSecond: 20,
        timeoutMs: 30000,
      });
      expect(client).toBeInstanceOf(MapGeoClient);
    });

    it('should handle partial configuration', () => {
      const client = new MapGeoClient({
        maxRetries: 5,
      });
      expect(client).toBeInstanceOf(MapGeoClient);
    });
  });
});
