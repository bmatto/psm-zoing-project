/**
 * Tests for VGSI API Client
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { VGSIClient } from './vgsi-client.js';

describe('VGSIClient', () => {
  let client: VGSIClient;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new VGSIClient({
      maxRetries: 3,
      maxRequestsPerSecond: 100, // High rate limit for fast tests
      timeoutMs: 5000,
    });

    fetchMock = vi.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('fetchPropertyData', () => {
    it('should fetch and parse property data successfully', async () => {
      const mockHTML = `
        <html>
          <body>
            <div>Living Area: 2,500 SF</div>
            <div>Building Footprint: 3,000 sq ft</div>
          </body>
        </html>
      `;

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toEqual({
        living_area_sqft: 2500,
        building_footprint_sqft: 3000,
      });

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(fetchMock).toHaveBeenCalledWith(
        'http://gis.vgsi.com/PortsmouthNH/Parcel.aspx?Pid=12345',
        expect.any(Object)
      );
    });

    it('should parse living area with commas', async () => {
      const mockHTML = '<div>Living Area: 12,345 SF</div>';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toEqual({
        living_area_sqft: 12345,
        building_footprint_sqft: 12345, // Uses living area as approximation
      });
    });

    it('should use living area as footprint approximation when footprint is missing', async () => {
      const mockHTML = '<div>Living Area: 2,500 SF</div>';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toEqual({
        living_area_sqft: 2500,
        building_footprint_sqft: 2500,
      });
    });

    it('should handle multiple footprint pattern variations', async () => {
      const patterns = [
        { html: '<div>Total Building: 3,000 sq ft</div>', expected: 3000 },
        { html: '<div>Gross Building: 4,000 sq ft</div>', expected: 4000 },
        { html: '<div>Building Footprint: 5,000 sq ft</div>', expected: 5000 },
      ];

      for (const { html, expected } of patterns) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => html,
        });

        const result = await client.fetchPropertyData('12345', 'PARCEL-001');
        expect(result?.building_footprint_sqft).toBe(expected);
      }
    });

    it('should return empty object when no building data is found', async () => {
      const mockHTML = '<html><body>No building data</body></html>';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toEqual({});
    });

    it('should URL encode account numbers', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      });

      await client.fetchPropertyData('ACC-123/456', 'PARCEL-001');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://gis.vgsi.com/PortsmouthNH/Parcel.aspx?Pid=ACC-123%2F456',
        expect.any(Object)
      );
    });

    it('should throw error for empty account number', async () => {
      await expect(client.fetchPropertyData('', 'PARCEL-001')).rejects.toThrow(
        'Account number is required'
      );

      await expect(client.fetchPropertyData('   ', 'PARCEL-001')).rejects.toThrow(
        'Account number is required'
      );
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockHTML = '<div>Living Area: 2,000 SF</div>';

      fetchMock
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Timeout'))
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => mockHTML,
        });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toEqual({
        living_area_sqft: 2000,
        building_footprint_sqft: 2000,
      });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should return null after max retries', async () => {
      fetchMock.mockRejectedValue(new Error('Network error'));

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should handle HTTP error responses', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toBeNull();
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should handle request timeout', async () => {
      const controller = new AbortController();

      fetchMock.mockImplementation(
        (_url: string, options?: { signal?: AbortSignal }) => {
          // Simulate timeout by aborting immediately
          if (options?.signal) {
            setTimeout(() => controller.abort(), 0);
          }
          return new Promise((_, reject) => {
            setTimeout(() => reject(new Error('Timeout')), 100);
          });
        }
      );

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toBeNull();
    });

    it('should enforce rate limiting', async () => {
      const rateLimitedClient = new VGSIClient({
        maxRequestsPerSecond: 2, // 2 requests per second = 500ms between requests
        maxRetries: 1,
      });

      fetchMock.mockResolvedValue({
        ok: true,
        status: 200,
        text: async () => '',
      });

      const startTime = Date.now();

      await rateLimitedClient.fetchPropertyData('1', 'P1');
      await rateLimitedClient.fetchPropertyData('2', 'P2');
      await rateLimitedClient.fetchPropertyData('3', 'P3');

      const elapsedTime = Date.now() - startTime;

      // With 2 req/sec, 3 requests should take at least 1000ms (0ms + 500ms + 500ms)
      expect(elapsedTime).toBeGreaterThanOrEqual(900); // Allow some margin
    });

    it('should use custom base URL when provided', async () => {
      const customClient = new VGSIClient({
        baseUrl: 'http://custom.vgsi.com/Test',
      });

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => '',
      });

      await customClient.fetchPropertyData('12345', 'PARCEL-001');

      expect(fetchMock).toHaveBeenCalledWith(
        'http://custom.vgsi.com/Test?Pid=12345',
        expect.any(Object)
      );
    });

    it('should handle case-insensitive pattern matching', async () => {
      const mockHTML = '<div>LIVING AREA: 2,500 sf</div>';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result?.living_area_sqft).toBe(2500);
    });

    it('should ignore invalid numeric values', async () => {
      const mockHTML = '<div>Living Area: invalid SF</div>';

      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        text: async () => mockHTML,
      });

      const result = await client.fetchPropertyData('12345', 'PARCEL-001');

      expect(result).toEqual({});
    });
  });

  describe('fetchMultipleProperties', () => {
    it('should fetch multiple properties sequentially', async () => {
      const mockHTMLs = [
        '<div>Living Area: 1,000 SF</div>',
        '<div>Living Area: 2,000 SF</div>',
        '<div>Living Area: 3,000 SF</div>',
      ];

      mockHTMLs.forEach(html => {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => html,
        });
      });

      const requests = [
        { accountNumber: '1', parcelId: 'P1' },
        { accountNumber: '2', parcelId: 'P2' },
        { accountNumber: '3', parcelId: 'P3' },
      ];

      const results = await client.fetchMultipleProperties(requests);

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ living_area_sqft: 1000, building_footprint_sqft: 1000 });
      expect(results[1]).toEqual({ living_area_sqft: 2000, building_footprint_sqft: 2000 });
      expect(results[2]).toEqual({ living_area_sqft: 3000, building_footprint_sqft: 3000 });
      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should handle mixed success and failure', async () => {
      fetchMock
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          text: async () => '<div>Living Area: 1,000 SF</div>',
        })
        .mockRejectedValue(new Error('Network error'));

      const requests = [
        { accountNumber: '1', parcelId: 'P1' },
        { accountNumber: '2', parcelId: 'P2' },
      ];

      const results = await client.fetchMultipleProperties(requests);

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({ living_area_sqft: 1000, building_footprint_sqft: 1000 });
      expect(results[1]).toBeNull();
    });

    it('should return empty array for empty input', async () => {
      const results = await client.fetchMultipleProperties([]);
      expect(results).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe('configuration', () => {
    it('should use default configuration when not provided', () => {
      const defaultClient = new VGSIClient();

      expect(defaultClient).toBeInstanceOf(VGSIClient);
    });

    it('should allow partial configuration override', () => {
      const partialClient = new VGSIClient({
        maxRetries: 5,
      });

      expect(partialClient).toBeInstanceOf(VGSIClient);
    });
  });
});
