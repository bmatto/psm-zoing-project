/**
 * Zone-level metrics calculator for Portsmouth zoning analysis
 * Aggregates parcel data by zone to calculate land distribution and revenue analysis
 */

import type { EnrichedParcel } from '../types/index.js';
import type { LandUseType } from '../zoning/rules.js';
import { classifyLandUse } from '../zoning/rules.js';

export interface ZoneLandUseBreakdown {
  landUse: LandUseType;
  count: number;
}

export interface ZoneMetricData {
  zoneName: string;
  totalAcres: number;
  totalValue: number;
  revenueDensity: number;
  parcelCount: number;
  landUses: ZoneLandUseBreakdown[];
}

export interface ZoneMetrics {
  zones: Record<string, ZoneMetricData>;
  mostRevenueDenseZone: {
    zone: string;
    revenueDensity: number;
  } | null;
}

/**
 * Calculate zone-level metrics from enriched parcel data
 * @param parcels - Array of enriched parcels
 * @returns Zone metrics including totals and revenue density
 */
export function calculateZoneMetrics(parcels: EnrichedParcel[]): ZoneMetrics {
  const zoneData = new Map<
    string,
    {
      totalAcres: number;
      totalValue: number;
      parcelCount: number;
      landUseCounts: Map<LandUseType, number>;
    }
  >();

  for (const parcel of parcels) {
    if (!parcel.zoning) {
      continue;
    }

    const zone = parcel.zoning;
    const acres = parcel.parcel_area_acres;
    const value = parcel.total_value;

    if (!zoneData.has(zone)) {
      zoneData.set(zone, {
        totalAcres: 0,
        totalValue: 0,
        parcelCount: 0,
        landUseCounts: new Map(),
      });
    }

    const data = zoneData.get(zone)!;
    data.totalAcres += acres;
    data.totalValue += value;
    data.parcelCount += 1;

    const landUse = classifyLandUse(parcel.land_use_desc);
    data.landUseCounts.set(landUse, (data.landUseCounts.get(landUse) || 0) + 1);
  }

  const zones: Record<string, ZoneMetricData> = {};
  let mostRevenueDenseZone: { zone: string; revenueDensity: number } | null = null;

  for (const [zone, data] of zoneData.entries()) {
    const revenueDensity = data.totalAcres > 0 ? data.totalValue / data.totalAcres : 0;

    const landUses: ZoneLandUseBreakdown[] = Array.from(
      data.landUseCounts.entries()
    ).map(([landUse, count]) => ({
      landUse,
      count,
    }));

    zones[zone] = {
      zoneName: zone,
      totalAcres: data.totalAcres,
      totalValue: data.totalValue,
      revenueDensity,
      parcelCount: data.parcelCount,
      landUses,
    };

    if (!mostRevenueDenseZone || revenueDensity > mostRevenueDenseZone.revenueDensity) {
      mostRevenueDenseZone = { zone, revenueDensity };
    }
  }

  return {
    zones,
    mostRevenueDenseZone,
  };
}
