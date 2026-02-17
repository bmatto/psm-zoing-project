/**
 * Zoning Violations Checker
 *
 * Analyzes parcels for violations of Portsmouth zoning ordinance dimensional
 * requirements and land use restrictions.
 */

import { EnrichedParcel } from '../types/index.js';
import { ZONING_RULES, classifyLandUse, type LandUseType } from '../zoning/rules.js';

export type ViolationType = 'undersized_lot' | 'excess_lot_coverage' | 'incompatible_use';
export type ViolationSeverity = 'major' | 'critical';

export interface Violation {
  type: ViolationType;
  severity: ViolationSeverity;
  description: string;
  // Additional context fields
  deficit?: number; // For undersized lots
  excess_pct?: number; // For excess lot coverage
  current_use?: LandUseType; // For incompatible use
  allowed_uses?: LandUseType[]; // For incompatible use
}

export interface ViolationsByZone {
  [zone: string]: {
    total_violations: number;
    undersized_lot_count: number;
    excess_coverage_count: number;
    incompatible_use_count: number;
    parcels_with_violations: string[];
    violations_by_parcel: {
      [parcel_id: string]: Violation[];
    };
  };
}

export interface ViolationsAnalysis {
  total_violations: number;
  total_parcels_with_violations: number;
  violations_by_zone: ViolationsByZone;
  violation_type_summary: {
    undersized_lot: number;
    excess_lot_coverage: number;
    incompatible_use: number;
  };
  skipped_parcels: number;
}

/**
 * Check a single parcel for zoning violations
 *
 * @param parcel - Enriched parcel to check
 * @param zoneRules - Zoning rules to validate against (defaults to ZONING_RULES)
 * @returns Array of violations found (empty if compliant)
 */
export function checkZoningViolations(
  parcel: EnrichedParcel,
  zoneRules: typeof ZONING_RULES = ZONING_RULES
): Violation[] {
  const violations: Violation[] = [];

  const zone = parcel.zoning;
  if (!zone || !(zone in zoneRules)) {
    return violations;
  }

  const rules = zoneRules[zone];
  if (!rules) {
    return violations;
  }

  const land_use = classifyLandUse(parcel.land_use_desc || '');

  // Check lot size
  if (rules.min_lot_size_sqft !== null) {
    if (parcel.parcel_area_sqft < rules.min_lot_size_sqft) {
      violations.push({
        type: 'undersized_lot',
        severity: 'major',
        description: `Lot size ${parcel.parcel_area_sqft.toFixed(0)} sqft is below minimum ${rules.min_lot_size_sqft} sqft`,
        deficit: rules.min_lot_size_sqft - parcel.parcel_area_sqft,
      });
    }
  }

  // Check lot coverage
  if (rules.max_lot_coverage_pct !== null && parcel.lot_coverage_pct > 0) {
    if (parcel.lot_coverage_pct > rules.max_lot_coverage_pct) {
      violations.push({
        type: 'excess_lot_coverage',
        severity: 'major',
        description: `Lot coverage ${parcel.lot_coverage_pct.toFixed(1)}% exceeds maximum ${rules.max_lot_coverage_pct}%`,
        excess_pct: parcel.lot_coverage_pct - rules.max_lot_coverage_pct,
      });
    }
  }

  // Check land use compatibility
  if (rules.allowed_uses.length > 0 && land_use !== 'unknown' && land_use !== 'vacant') {
    if (!rules.allowed_uses.includes(land_use)) {
      violations.push({
        type: 'incompatible_use',
        severity: 'critical',
        description: `Land use '${land_use}' not allowed in ${rules.name} zone`,
        current_use: land_use,
        allowed_uses: rules.allowed_uses,
      });
    }
  }

  return violations;
}

/**
 * Analyze all parcels for violations and group results by zone
 *
 * @param parcels - Array of enriched parcels to analyze
 * @returns Comprehensive violations analysis grouped by zone
 */
export function analyzeViolations(parcels: EnrichedParcel[]): ViolationsAnalysis {
  const violationsByZone: ViolationsByZone = {};
  let totalViolations = 0;
  const parcelsWithViolations = new Set<string>();
  let skippedCount = 0;

  const violationTypeSummary = {
    undersized_lot: 0,
    excess_lot_coverage: 0,
    incompatible_use: 0,
  };

  for (const parcel of parcels) {
    // Skip parcels with missing required fields
    if (!parcel.zoning || !parcel.parcel_area_sqft) {
      skippedCount++;
      continue;
    }

    const violations = checkZoningViolations(parcel);

    if (violations.length > 0) {
      const zone = parcel.zoning;
      if (!zone) continue;

      // Initialize zone data if needed
      if (!(zone in violationsByZone)) {
        violationsByZone[zone] = {
          total_violations: 0,
          undersized_lot_count: 0,
          excess_coverage_count: 0,
          incompatible_use_count: 0,
          parcels_with_violations: [],
          violations_by_parcel: {},
        };
      }

      // Track parcel
      const zoneData = violationsByZone[zone];
      if (!zoneData) continue;

      parcelsWithViolations.add(parcel.parcel_id);
      zoneData.parcels_with_violations.push(parcel.parcel_id);
      zoneData.violations_by_parcel[parcel.parcel_id] = violations;

      // Count violations
      for (const violation of violations) {
        totalViolations++;
        zoneData.total_violations++;

        // Update type-specific counts
        if (violation.type === 'undersized_lot') {
          zoneData.undersized_lot_count++;
          violationTypeSummary.undersized_lot++;
        } else if (violation.type === 'excess_lot_coverage') {
          zoneData.excess_coverage_count++;
          violationTypeSummary.excess_lot_coverage++;
        } else if (violation.type === 'incompatible_use') {
          zoneData.incompatible_use_count++;
          violationTypeSummary.incompatible_use++;
        }
      }
    }
  }

  if (skippedCount > 0) {
    console.log(`Skipped ${skippedCount} parcels with missing zoning or parcel_area_sqft`);
  }

  return {
    total_violations: totalViolations,
    total_parcels_with_violations: parcelsWithViolations.size,
    violations_by_zone: violationsByZone,
    violation_type_summary: violationTypeSummary,
    skipped_parcels: skippedCount,
  };
}
