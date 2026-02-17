/**
 * Infrastructure Burden Analysis
 *
 * Calculates the relationship between zoning density, tax revenue,
 * and estimated municipal service costs.
 *
 * Key insight: Lower density zones require MORE infrastructure per capita
 * (longer roads, utility lines, emergency service coverage) but generate
 * LESS tax revenue per acre.
 */

import { EnrichedParcel } from '../types/index.js';
import { ZoneRules } from '../zoning/rules.js';

export interface ZoneInfrastructureMetrics {
  zone_name: string;
  total_acres: number;
  parcel_count: number;
  total_value: number;
  avg_lot_size_sqft: number;
  avg_lot_size_acres: number;
  parcels_per_acre: number;
  revenue_per_parcel: number;
  revenue_per_acre: number;
  min_frontage_ft: number | null;
  min_lot_size_sqft: number | null;
  estimated_linear_infrastructure_ft: number;
  est_infrastructure_cost_per_parcel: number;
  density_factor: number;
  fiscal_sustainability_ratio: number;
}

export interface InfrastructureMetrics {
  zones: Record<string, ZoneInfrastructureMetrics>;
  single_family_aggregate: AggregateMetrics;
  multi_family_aggregate: AggregateMetrics;
}

export interface AggregateMetrics {
  total_parcels: number;
  total_acres: number;
  total_revenue: number;
  total_infrastructure_ft: number;
  total_infrastructure_cost: number;
  revenue_per_parcel: number;
  revenue_per_acre: number;
  infrastructure_per_parcel: number;
  infrastructure_per_acre: number;
  cost_per_parcel: number;
  fiscal_ratio: number;
  net_fiscal_impact_per_parcel: number;
}

/**
 * Calculate infrastructure burden metrics for each zone
 */
export function calculateInfrastructureMetrics(
  parcels: EnrichedParcel[],
  zoneRules: Record<string, ZoneRules>
): InfrastructureMetrics {
  // Aggregate by zone
  const zoneData: Record<string, {
    total_acres: number;
    total_value: number;
    parcel_count: number;
  }> = {};

  for (const parcel of parcels) {
    if (!parcel || !parcel.zoning) {
      continue;
    }

    const zone = parcel.zoning;
    const acres = parcel.parcel_area_acres;
    const value = parcel.total_value;

    if (!zoneData[zone]) {
      zoneData[zone] = {
        total_acres: 0,
        total_value: 0,
        parcel_count: 0,
      };
    }

    zoneData[zone].total_acres += acres;
    zoneData[zone].total_value += value;
    zoneData[zone].parcel_count += 1;
  }

  // Calculate metrics for each zone
  const zones: Record<string, ZoneInfrastructureMetrics> = {};

  for (const [zone, data] of Object.entries(zoneData)) {
    if (!(zone in zoneRules)) {
      continue;
    }

    const rules = zoneRules[zone];
    if (!rules) {
      continue;
    }

    const parcelsCount = data.parcel_count;
    const acres = data.total_acres;
    const value = data.total_value;

    if (parcelsCount === 0 || acres === 0) {
      continue;
    }

    // Calculate average lot size
    const avg_lot_acres = acres / parcelsCount;
    const avg_lot_sqft = avg_lot_acres * 43560;

    // Revenue metrics
    const revenue_per_parcel = value / parcelsCount;
    const revenue_per_acre = value / acres;

    // Infrastructure burden estimates
    const min_frontage = rules.min_frontage_ft;
    const min_lot_size = rules.min_lot_size_sqft;

    // Estimate road/utility infrastructure needed
    // More frontage = more road/utility line per lot
    const estimated_linear_infrastructure = min_frontage ? min_frontage * parcelsCount : 0;

    // Infrastructure cost per parcel (relative estimate)
    // Assumes $500/linear foot for roads + utilities (conservative estimate)
    const est_infrastructure_cost_per_parcel = min_frontage ? min_frontage * 500 : 0;

    // Service cost multiplier based on density
    // Lower density = higher service costs per capita (longer distances for police, fire, etc.)
    const parcels_per_acre = parcelsCount / acres;
    const density_factor = parcels_per_acre > 0 ? 1.0 / parcels_per_acre : 0;

    // Calculate fiscal sustainability ratio
    // Higher is better: how much revenue per dollar of estimated infrastructure burden
    const fiscal_ratio = est_infrastructure_cost_per_parcel > 0
      ? revenue_per_parcel / est_infrastructure_cost_per_parcel
      : 0;

    zones[zone] = {
      zone_name: rules.name,
      total_acres: Math.round(acres * 100) / 100,
      parcel_count: parcelsCount,
      total_value: value,
      avg_lot_size_sqft: Math.round(avg_lot_sqft),
      avg_lot_size_acres: Math.round(avg_lot_acres * 1000) / 1000,
      parcels_per_acre: Math.round(parcels_per_acre * 100) / 100,
      revenue_per_parcel: Math.round(revenue_per_parcel),
      revenue_per_acre: Math.round(revenue_per_acre),
      min_frontage_ft: min_frontage,
      min_lot_size_sqft: min_lot_size,
      estimated_linear_infrastructure_ft: estimated_linear_infrastructure,
      est_infrastructure_cost_per_parcel: est_infrastructure_cost_per_parcel,
      density_factor: Math.round(density_factor * 1000) / 1000,
      fiscal_sustainability_ratio: Math.round(fiscal_ratio * 100) / 100,
    };
  }

  // Calculate aggregate metrics for single-family vs multi-family zones
  const sf_zones = ['R', 'SRA', 'SRB'];
  const mf_zones = ['GRA', 'GRB', 'GRC'];

  const sf_aggregate = calculateAggregateMetrics(zones, sf_zones);
  const mf_aggregate = calculateAggregateMetrics(zones, mf_zones);

  return {
    zones,
    single_family_aggregate: sf_aggregate,
    multi_family_aggregate: mf_aggregate,
  };
}

/**
 * Calculate aggregate metrics for a group of zones
 */
function calculateAggregateMetrics(
  zones: Record<string, ZoneInfrastructureMetrics>,
  zoneList: string[]
): AggregateMetrics {
  const aggregate = {
    total_parcels: 0,
    total_acres: 0,
    total_revenue: 0,
    total_infrastructure_ft: 0,
    total_infrastructure_cost: 0,
  };

  for (const zone of zoneList) {
    if (zone in zones) {
      const data = zones[zone];
      if (!data) {
        continue;
      }
      aggregate.total_parcels += data.parcel_count;
      aggregate.total_acres += data.total_acres;
      aggregate.total_revenue += data.total_value;
      aggregate.total_infrastructure_ft += data.estimated_linear_infrastructure_ft;
      aggregate.total_infrastructure_cost += data.est_infrastructure_cost_per_parcel * data.parcel_count;
    }
  }

  // Calculate per-parcel and per-acre metrics
  const revenue_per_parcel = aggregate.total_parcels > 0
    ? aggregate.total_revenue / aggregate.total_parcels
    : 0;
  const revenue_per_acre = aggregate.total_acres > 0
    ? aggregate.total_revenue / aggregate.total_acres
    : 0;
  const infrastructure_per_parcel = aggregate.total_parcels > 0
    ? aggregate.total_infrastructure_ft / aggregate.total_parcels
    : 0;
  const infrastructure_per_acre = aggregate.total_acres > 0
    ? aggregate.total_infrastructure_ft / aggregate.total_acres
    : 0;
  const cost_per_parcel = aggregate.total_parcels > 0
    ? aggregate.total_infrastructure_cost / aggregate.total_parcels
    : 0;
  const fiscal_ratio = cost_per_parcel > 0
    ? revenue_per_parcel / cost_per_parcel
    : 0;
  const net_fiscal_impact = revenue_per_parcel - cost_per_parcel;

  return {
    ...aggregate,
    revenue_per_parcel: Math.round(revenue_per_parcel),
    revenue_per_acre: Math.round(revenue_per_acre),
    infrastructure_per_parcel: Math.round(infrastructure_per_parcel),
    infrastructure_per_acre: Math.round(infrastructure_per_acre),
    cost_per_parcel: Math.round(cost_per_parcel),
    fiscal_ratio: Math.round(fiscal_ratio * 100) / 100,
    net_fiscal_impact_per_parcel: Math.round(net_fiscal_impact),
  };
}
