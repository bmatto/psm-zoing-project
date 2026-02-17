/**
 * Comprehensive Zoning Report Generator
 *
 * Generates human-readable text reports for Portsmouth zoning analysis including
 * land distribution, revenue analysis, and violations.
 */

import { ZONING_RULES } from '../zoning/rules.js';
import type { ZoneMetrics } from '../analysis/zone-metrics.js';
import type { ViolationsAnalysis } from '../analysis/violations.js';

/**
 * Generate comprehensive zoning analysis report
 *
 * @param zoneMetrics - Calculated zone-level metrics
 * @param violationsAnalysis - Analyzed violations by zone
 * @param propertiesCount - Total number of properties analyzed
 * @param timestamp - Report generation timestamp
 * @returns Formatted text report
 */
export function generateComprehensiveReport(
  zoneMetrics: ZoneMetrics,
  violationsAnalysis: ViolationsAnalysis,
  propertiesCount: number,
  timestamp: string
): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(80));
  lines.push('PORTSMOUTH NH COMPREHENSIVE ZONING ANALYSIS REPORT');
  lines.push('='.repeat(80));
  lines.push(`Generated: ${timestamp}`);
  lines.push('Based on: Portsmouth Zoning Ordinance (Amended through May 5, 2025)');
  lines.push('Source: https://files.portsmouthnh.gov/files/planning/ZoningOrd-250505+ADOPTED.pdf');
  lines.push(`Total Properties Analyzed: ${propertiesCount.toLocaleString()}`);

  // Calculate total acres
  const totalAcres = Object.values(zoneMetrics.zones).reduce(
    (sum, zone) => sum + zone.totalAcres,
    0
  );
  lines.push(`Total Land Area: ${totalAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} acres`);
  lines.push(`Total Zones: ${Object.keys(zoneMetrics.zones).length}`);
  lines.push('');

  // Land Distribution
  lines.push('='.repeat(80));
  lines.push('LAND DISTRIBUTION BY ZONE');
  lines.push('='.repeat(80));

  const sortedByLand = Object.entries(zoneMetrics.zones).sort(
    ([, a], [, b]) => {
      const pctA = totalAcres > 0 ? (a.totalAcres / totalAcres) * 100 : 0;
      const pctB = totalAcres > 0 ? (b.totalAcres / totalAcres) * 100 : 0;
      return pctB - pctA;
    }
  );

  for (const [zone, data] of sortedByLand) {
    const zoneName = ZONING_RULES[zone]?.name || zone;
    const pctOfLand = totalAcres > 0 ? (data.totalAcres / totalAcres) * 100 : 0;
    lines.push('');
    lines.push(`${zone} - ${zoneName}`);
    lines.push(
      `  Area: ${data.totalAcres.toLocaleString(undefined, { maximumFractionDigits: 2 })} acres (${pctOfLand.toFixed(1)}%)`
    );
    lines.push(`  Parcels: ${data.parcelCount.toLocaleString()}`);
  }

  // Tax Revenue
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('TAX REVENUE ANALYSIS BY ZONE');
  lines.push('='.repeat(80));

  const sortedByValue = Object.entries(zoneMetrics.zones).sort(
    ([, a], [, b]) => b.totalValue - a.totalValue
  );

  for (const [zone, data] of sortedByValue.slice(0, 15)) {
    const zoneName = ZONING_RULES[zone]?.name || zone;
    lines.push('');
    lines.push(`${zone} - ${zoneName}`);
    lines.push(`  Total Value: $${data.totalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`);
    lines.push(
      `  Revenue Density: $${data.revenueDensity.toLocaleString(undefined, { maximumFractionDigits: 0 })}/acre`
    );
    lines.push(`  Parcels: ${data.parcelCount.toLocaleString()}`);
  }

  if (zoneMetrics.mostRevenueDenseZone) {
    lines.push('');
    lines.push('─'.repeat(80));
    lines.push('MOST REVENUE-DENSE ZONE');
    lines.push('─'.repeat(80));
    lines.push(`Zone: ${zoneMetrics.mostRevenueDenseZone.zone}`);
    lines.push(
      `Revenue per Acre: $${zoneMetrics.mostRevenueDenseZone.revenueDensity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
    );
  }

  // Violations
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('ZONING VIOLATIONS ANALYSIS');
  lines.push('='.repeat(80));
  lines.push(`Total Violations Found: ${violationsAnalysis.total_violations.toLocaleString()}`);
  lines.push(`Total Parcels with Violations: ${violationsAnalysis.total_parcels_with_violations.toLocaleString()}`);
  lines.push('');
  lines.push('NOTE: This analysis uses zoning requirements from the official');
  lines.push('Portsmouth Zoning Ordinance (May 5, 2025 amendments).');
  lines.push('');

  // Sort zones by violation rate
  const zonesWithViolations = Object.entries(violationsAnalysis.violations_by_zone)
    .filter(([, data]) => data.parcels_with_violations.length > 0)
    .map(([zone, data]) => ({
      zone,
      data,
      totalParcels: zoneMetrics.zones[zone]?.parcelCount || 0,
    }))
    .sort((a, b) => {
      const rateA = a.totalParcels > 0 ? a.data.parcels_with_violations.length / a.totalParcels : 0;
      const rateB = b.totalParcels > 0 ? b.data.parcels_with_violations.length / b.totalParcels : 0;
      return rateB - rateA;
    });

  for (const { zone, data, totalParcels } of zonesWithViolations) {
    const zoneName = ZONING_RULES[zone]?.name || zone;
    const violationRate = totalParcels > 0 ? (data.parcels_with_violations.length / totalParcels) * 100 : 0;

    lines.push('');
    lines.push(`${zone} - ${zoneName}`);
    lines.push(`  Total Parcels: ${totalParcels.toLocaleString()}`);
    lines.push(`  Parcels with Violations: ${data.parcels_with_violations.length.toLocaleString()}`);
    lines.push(`  Violation Rate: ${violationRate.toFixed(1)}%`);

    lines.push('');
    lines.push('  Violation Types:');
    const violationTypes = [
      { type: 'undersized_lot', count: data.undersized_lot_count },
      { type: 'excess_lot_coverage', count: data.excess_coverage_count },
      { type: 'incompatible_use', count: data.incompatible_use_count },
    ]
      .filter((v) => v.count > 0)
      .sort((a, b) => b.count - a.count);

    for (const { type, count } of violationTypes) {
      lines.push(`    - ${type}: ${count.toLocaleString()}`);
    }

    // Show examples (first 5 parcels)
    const exampleParcels = data.parcels_with_violations.slice(0, 5);
    if (exampleParcels.length > 0) {
      lines.push('');
      lines.push('  Examples (first 5):');
      for (const parcelId of exampleParcels) {
        const violations = data.violations_by_parcel[parcelId];
        if (!violations) continue;

        lines.push(`    ${parcelId}`);
        for (const v of violations) {
          lines.push(`      • [${v.severity}] ${v.description}`);
        }
      }

      if (data.parcels_with_violations.length > 5) {
        lines.push(`    ... and ${data.parcels_with_violations.length - 5} more parcels with violations`);
      }
    }
  }

  // Summary statistics
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('VIOLATION SUMMARY STATISTICS');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push(`Total Undersized Lots: ${violationsAnalysis.violation_type_summary.undersized_lot.toLocaleString()}`);
  lines.push(
    `Total Excess Lot Coverage: ${violationsAnalysis.violation_type_summary.excess_lot_coverage.toLocaleString()}`
  );
  lines.push(
    `Total Incompatible Land Uses: ${violationsAnalysis.violation_type_summary.incompatible_use.toLocaleString()}`
  );
  lines.push(`Parcels Skipped (missing data): ${violationsAnalysis.skipped_parcels.toLocaleString()}`);

  // Key dimensional requirements
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('KEY DIMENSIONAL REQUIREMENTS (from Official Ordinance)');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push('Residential Zones:');
  lines.push('  R:   Minimum 217,800 sf (5 acres), Max 5% coverage');
  lines.push('  SRA: Minimum 43,560 sf (1 acre), Max 10% coverage');
  lines.push('  SRB: Minimum 15,000 sf, Max 20% coverage');
  lines.push('  GRA: Minimum 7,500 sf, Max 25% coverage');
  lines.push('  GRB: Minimum 5,000 sf, Max 30% coverage');
  lines.push('  GRC: Minimum 3,500 sf, Max 35% coverage');
  lines.push('');
  lines.push('Business Zones:');
  lines.push('  B/WB: Minimum 20,000 sf, Max 30-35% coverage');
  lines.push('  GB/G1/G2: Minimum 43,560 sf (1 acre), Max 30% coverage');
  lines.push('');
  lines.push('Industrial Zones:');
  lines.push('  I/WI: Minimum 87,120 sf (2 acres), Max 50% coverage');
  lines.push('  OR: Minimum 130,680 sf (3 acres), Max 30% coverage');

  // Footer
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('END OF REPORT');
  lines.push('='.repeat(80));

  return lines.join('\n');
}
