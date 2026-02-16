/**
 * Map Geo API Client
 *
 * Fetches geographic and property data from the Portsmouth MapGeo API.
 * Implements retry logic, rate limiting, and response validation.
 *
 * API Endpoint: https://portsmouthnh.mapgeo.io/api/ui/datasets/properties/{parcelId}
 */

import type { MapGeoResponse } from '../types/index.js';

/**
 * Configuration options for MapGeoClient
 */
export interface MapGeoClientConfig {
  /**
   * Base URL for the Map Geo API
   * @default "https://portsmouthnh.mapgeo.io/api/ui/datasets/properties"
   */
  baseUrl?: string;

  /**
   * Maximum number of retry attempts for failed requests
   * @default 3
   */
  maxRetries?: number;

  /**
   * Maximum requests per second (rate limit)
   * @default 10
   */
  maxRequestsPerSecond?: number;

  /**
   * Timeout for API requests in milliseconds
   * @default 15000
   */
  timeoutMs?: number;
}

/**
 * Client for fetching property data from the Map Geo API
 */
export class MapGeoClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly maxRequestsPerSecond: number;
  private readonly timeoutMs: number;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number;

  constructor(config: MapGeoClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'https://portsmouthnh.mapgeo.io/api/ui/datasets/properties';
    this.maxRetries = config.maxRetries ?? 3;
    this.maxRequestsPerSecond = config.maxRequestsPerSecond ?? 10;
    this.timeoutMs = config.timeoutMs ?? 15000;
    this.minRequestInterval = 1000 / this.maxRequestsPerSecond;
  }

  /**
   * Enforces rate limiting by delaying requests if needed
   */
  private async enforceRateLimit(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;

    if (timeSinceLastRequest < this.minRequestInterval) {
      const delay = this.minRequestInterval - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    this.lastRequestTime = Date.now();
  }

  /**
   * Validates that a Map Geo API response has the expected structure
   */
  private isValidResponse(data: unknown): data is MapGeoResponse {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const response = data as Record<string, unknown>;

    // Response must have a 'data' property that is an object
    if (!response['data'] || typeof response['data'] !== 'object') {
      return false;
    }

    return true;
  }

  /**
   * Fetches property data for a single parcel from the Map Geo API
   *
   * @param parcelId - The parcel ID to fetch data for
   * @returns Promise resolving to MapGeoResponse
   * @throws Error if the request fails after all retries or if validation fails
   */
  async fetchParcelData(parcelId: string): Promise<MapGeoResponse> {
    if (!parcelId || parcelId.trim() === '') {
      throw new Error('Parcel ID cannot be empty');
    }

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        // Enforce rate limiting before making request
        await this.enforceRateLimit();

        const url = `${this.baseUrl}/${encodeURIComponent(parcelId)}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const response = await fetch(url, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data: unknown = await response.json();

        // Validate response structure
        if (!this.isValidResponse(data)) {
          throw new Error('Invalid response structure from Map Geo API');
        }

        return data;

      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // If this is the last attempt, throw the error
        if (attempt === this.maxRetries) {
          break;
        }

        // Exponential backoff: wait 1s, 2s, 4s between retries
        const backoffMs = Math.pow(2, attempt - 1) * 1000;
        await new Promise(resolve => setTimeout(resolve, backoffMs));
      }
    }

    throw new Error(
      `Failed to fetch Map Geo data for parcel ${parcelId} after ${this.maxRetries} attempts: ${lastError?.message}`
    );
  }

  /**
   * Fetches data for multiple parcels in sequence
   *
   * Note: This method processes parcels sequentially to respect rate limits.
   * For parallel processing, use a separate orchestration layer.
   *
   * @param parcelIds - Array of parcel IDs to fetch
   * @returns Promise resolving to array of results (successful responses or errors)
   */
  async fetchMultipleParcels(
    parcelIds: string[]
  ): Promise<Array<{ parcelId: string; data?: MapGeoResponse; error?: string }>> {
    const results: Array<{ parcelId: string; data?: MapGeoResponse; error?: string }> = [];

    for (const parcelId of parcelIds) {
      try {
        const data = await this.fetchParcelData(parcelId);
        results.push({ parcelId, data });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ parcelId, error: message });
      }
    }

    return results;
  }
}
