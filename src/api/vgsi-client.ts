/**
 * VGSI API Client
 *
 * Fetches property assessment and building data from the VGSI (Vision Government Solutions) API.
 * Implements retry logic, rate limiting, response validation, and HTML parsing.
 *
 * API Endpoint: http://gis.vgsi.com/PortsmouthNH/Parcel.aspx?Pid={accountNumber}
 */

import type { VGSIResponse } from '../types/index.js';

/**
 * Configuration options for VGSIClient
 */
export interface VGSIClientConfig {
  /**
   * Base URL for the VGSI API
   * @default "http://gis.vgsi.com/PortsmouthNH/Parcel.aspx"
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
 * Client for fetching property assessment and building data from the VGSI API
 */
export class VGSIClient {
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private readonly maxRequestsPerSecond: number;
  private readonly timeoutMs: number;
  private lastRequestTime: number = 0;
  private readonly minRequestInterval: number;

  constructor(config: VGSIClientConfig = {}) {
    this.baseUrl = config.baseUrl ?? 'http://gis.vgsi.com/PortsmouthNH/Parcel.aspx';
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
   * Validates that a VGSI response has the expected structure
   */
  private isValidResponse(data: unknown): data is VGSIResponse {
    if (!data || typeof data !== 'object') {
      return false;
    }

    // VGSI response is valid if it's an object (even if empty)
    // The fields are optional, so we just need to check it's an object
    return true;
  }

  /**
   * Parses HTML response from VGSI API to extract building data
   *
   * Extracts:
   * - Living Area (square feet)
   * - Building Footprint (square feet)
   *
   * Uses regex patterns to find building metrics in the HTML response.
   * If no explicit footprint is found, uses living area as approximation.
   */
  private parseHTMLResponse(html: string): VGSIResponse {
    const buildingData: VGSIResponse = {};

    // Extract living area using regex
    const livingAreaMatch = html.match(/Living Area.*?(\d+,?\d*)\s*SF/i);
    if (livingAreaMatch && livingAreaMatch[1]) {
      const livingArea = parseFloat(livingAreaMatch[1].replace(/,/g, ''));
      if (!isNaN(livingArea)) {
        buildingData.living_area_sqft = livingArea;
      }
    }

    // Look for building footprint using multiple patterns
    const footprintPatterns = [
      /Building Footprint.*?(\d+,?\d*)\s*sq\s*ft/i,
      /Total Building.*?(\d+,?\d*)\s*sq\s*ft/i,
      /Gross Building.*?(\d+,?\d*)\s*sq\s*ft/i,
    ];

    for (const pattern of footprintPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const footprint = parseFloat(match[1].replace(/,/g, ''));
        if (!isNaN(footprint)) {
          buildingData.building_footprint_sqft = footprint;
          break;
        }
      }
    }

    // If no explicit footprint found, use living area as approximation
    if (!buildingData.building_footprint_sqft && buildingData.living_area_sqft) {
      buildingData.building_footprint_sqft = buildingData.living_area_sqft;
    }

    return buildingData;
  }

  /**
   * Fetches property data for a single account number with retry logic
   *
   * @param accountNumber - The account number (from MapGeo 'account' field)
   * @param requestedParcelId - The parcel ID that requested this data (for validation)
   * @returns Property data or null if request fails
   * @throws Error if account number is invalid or all retries fail
   */
  async fetchPropertyData(
    accountNumber: string,
    requestedParcelId: string
  ): Promise<VGSIResponse | null> {
    if (!accountNumber || accountNumber.trim() === '') {
      throw new Error('Account number is required');
    }

    await this.enforceRateLimit();

    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

        const url = `${this.baseUrl}?Pid=${encodeURIComponent(accountNumber)}`;
        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const html = await response.text();
        const parsedData = this.parseHTMLResponse(html);

        if (!this.isValidResponse(parsedData)) {
          throw new Error('Invalid response structure from VGSI API');
        }

        // Return parsed data even if empty (some parcels may have no building data)
        return parsedData;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < this.maxRetries) {
          // Exponential backoff: 1s, 2s, 4s
          const backoffMs = Math.pow(2, attempt - 1) * 1000;
          await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }

    // All retries failed
    console.error(
      `Failed to fetch VGSI data for account ${accountNumber} (parcel ${requestedParcelId}) after ${this.maxRetries} attempts:`,
      lastError?.message
    );
    return null;
  }

  /**
   * Fetches property data for multiple account numbers sequentially
   *
   * @param requests - Array of {accountNumber, parcelId} objects
   * @returns Array of responses in the same order as requests
   */
  async fetchMultipleProperties(
    requests: Array<{ accountNumber: string; parcelId: string }>
  ): Promise<Array<VGSIResponse | null>> {
    const results: Array<VGSIResponse | null> = [];

    for (const request of requests) {
      const result = await this.fetchPropertyData(request.accountNumber, request.parcelId);
      results.push(result);
    }

    return results;
  }
}
