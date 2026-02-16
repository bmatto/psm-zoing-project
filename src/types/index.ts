/**
 * Type definitions for Portsmouth Zoning Analysis
 *
 * These types define the data structures used throughout the application
 * for parcel records, API responses, and enriched property data.
 */

/**
 * Raw parcel record from Portsmouth_Parcels.csv
 * Source: State GIS database
 */
export interface ParcelRecord {
  town: string;
  slum: string;
  localnbc: string;
  pid: string;
  townid: string;
  nbc: string;
  oid_1: string;
  sluc: string;
  u_id: string;
  countyid: string;
  name: string;
  streetaddress: string;
  parceloid: string;
  nh_gis_id: string;
  displayid: string;
  SHAPE__Length: string;
  slu: string;
  objectid: string;
  SHAPE__Area: string;
}

/**
 * Response from Map Geo API
 * Endpoint: https://portsmouthnh.mapgeo.io/api/ui/datasets/properties/{parcelId}
 */
export interface MapGeoResponse {
  data: {
    propID?: string;
    id?: string;
    displayName?: string;
    zoningCode?: string;
    landUseCode?: string;
    lndUseDesc?: string;
    totalValue?: number | string;
    landValue?: number | string;
    parcelArea?: number | string;
    ownerName?: string;
    account?: string;
  };
}

/**
 * Response from VGSI API (extracted from HTML)
 * Endpoint: http://gis.vgsi.com/PortsmouthNH/Parcel.aspx?Pid={accountNumber}
 */
export interface VGSIResponse {
  living_area_sqft?: number;
  building_footprint_sqft?: number;
}

/**
 * Fully enriched parcel with data from all sources
 * Combines ParcelRecord + MapGeoResponse + VGSIResponse
 */
export interface EnrichedParcel {
  // Primary identifiers
  parcel_id: string;
  address: string;

  // Zoning and land use
  zoning: string | null;
  land_use_code: string | null;
  land_use_desc: string | null;

  // Property values
  total_value: number;
  land_value: number;

  // Parcel dimensions
  parcel_area_acres: number;
  parcel_area_sqft: number;

  // Building information
  building_footprint_sqft: number;
  living_area_sqft?: number;
  lot_coverage_pct: number;

  // Ownership
  owner: string | null;
  account: string | null;
}

/**
 * Error information for failed API calls or validation
 */
export interface APIError {
  parcel_id: string;
  stage: 'csv_parse' | 'mapgeo_fetch' | 'vgsi_fetch' | 'validation';
  error_type: string;
  message: string;
  timestamp: string;
}

/**
 * Validation error with field-specific details
 */
export interface ValidationError {
  parcel_id: string;
  field: string;
  expected: string;
  actual: unknown;
  message: string;
}

/**
 * Summary of data enrichment process
 */
export interface EnrichmentSummary {
  total_parcels: number;
  successful_enrichments: number;
  failed_enrichments: number;
  validation_errors: number;
  processing_time_ms: number;
  timestamp: string;
}

/**
 * Complete enrichment result including data and errors
 */
export interface EnrichmentResult {
  parcels: EnrichedParcel[];
  errors: APIError[];
  summary: EnrichmentSummary;
}
