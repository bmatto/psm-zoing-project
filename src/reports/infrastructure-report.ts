/**
 * Infrastructure Burden Report Generator
 *
 * Generates human-readable reports analyzing the fiscal sustainability
 * of different zoning patterns based on infrastructure burden.
 */

import { InfrastructureMetrics } from '../analysis/infrastructure-burden.js';

/**
 * Generate infrastructure burden analysis report
 */
export function generateInfrastructureReport(
  infrastructureMetrics: InfrastructureMetrics,
  timestamp: string
): string {
  const lines: string[] = [];

  // Header
  lines.push('='.repeat(80));
  lines.push('PORTSMOUTH INFRASTRUCTURE BURDEN & FISCAL SUSTAINABILITY ANALYSIS');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push('This analysis examines the relationship between zoning density, tax revenue,');
  lines.push('and estimated municipal service costs.');
  lines.push('');
  lines.push('KEY CONCEPT: Lower-density zones require MORE infrastructure per household');
  lines.push('(roads, utilities, emergency services) but generate LESS tax revenue per acre.');
  lines.push('');

  // Residential zones analysis
  const residentialZones = ['R', 'SRA', 'SRB', 'GRA', 'GRB', 'GRC'];

  lines.push('='.repeat(80));
  lines.push('RESIDENTIAL ZONE INFRASTRUCTURE ANALYSIS');
  lines.push('='.repeat(80));

  for (const zone of residentialZones) {
    if (!(zone in infrastructureMetrics.zones)) {
      continue;
    }

    const data = infrastructureMetrics.zones[zone];
    if (!data) {
      continue;
    }

    lines.push('');
    lines.push(`${zone} - ${data.zone_name}`);
    lines.push('─'.repeat(80));

    lines.push('');
    lines.push('Basic Metrics:');
    lines.push(`  Total Land: ${data.total_acres.toLocaleString()} acres`);
    lines.push(`  Total Parcels: ${data.parcel_count.toLocaleString()}`);
    lines.push(`  Average Lot Size: ${data.avg_lot_size_sqft.toLocaleString()} sf (${data.avg_lot_size_acres.toFixed(2)} acres)`);
    lines.push(`  Density: ${data.parcels_per_acre.toFixed(2)} parcels/acre`);

    lines.push('');
    lines.push('Minimum Requirements:');
    lines.push(`  Minimum Lot Size: ${data.min_lot_size_sqft?.toLocaleString() ?? 'N/A'} sf`);
    if (data.min_frontage_ft) {
      lines.push(`  Minimum Frontage: ${data.min_frontage_ft.toLocaleString()} feet`);
    } else {
      lines.push('  Minimum Frontage: Not specified');
    }

    lines.push('');
    lines.push('Tax Revenue:');
    lines.push(`  Revenue per Parcel: $${data.revenue_per_parcel.toLocaleString()}`);
    lines.push(`  Revenue per Acre: $${data.revenue_per_acre.toLocaleString()}`);
    lines.push(`  Total Zone Revenue: $${data.total_value.toLocaleString()}`);

    if (data.min_frontage_ft) {
      lines.push('');
      lines.push('Estimated Infrastructure Burden:');
      lines.push(`  Linear Infrastructure per Parcel: ${data.min_frontage_ft.toLocaleString()} feet`);
      lines.push(`  Total Linear Infrastructure: ${data.estimated_linear_infrastructure_ft.toLocaleString()} feet`);
      lines.push(`  Est. Infrastructure Cost/Parcel: $${data.est_infrastructure_cost_per_parcel.toLocaleString()}`);
      lines.push('    (Based on $500/linear foot for roads + utilities)');

      lines.push('');
      lines.push('Fiscal Sustainability:');
      lines.push(`  Fiscal Ratio: ${data.fiscal_sustainability_ratio.toFixed(2)}`);
      lines.push('    (Revenue per parcel ÷ Infrastructure cost per parcel)');

      // Interpretation
      if (data.fiscal_sustainability_ratio < 20) {
        lines.push('    ⚠ LOW - High infrastructure burden relative to revenue');
      } else if (data.fiscal_sustainability_ratio < 50) {
        lines.push('    ⚡ MODERATE - Balanced infrastructure vs revenue');
      } else {
        lines.push('    ✓ HIGH - Revenue significantly exceeds infrastructure costs');
      }
    }
  }

  // Comparative analysis
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('COMPARATIVE ANALYSIS: SINGLE-FAMILY vs MULTI-FAMILY ZONES');
  lines.push('='.repeat(80));

  const sf = infrastructureMetrics.single_family_aggregate;
  const mf = infrastructureMetrics.multi_family_aggregate;

  lines.push('');
  lines.push('SINGLE-FAMILY ONLY ZONES (R, SRA, SRB):');
  lines.push(`  Revenue per Parcel: $${sf.revenue_per_parcel.toLocaleString()}`);
  lines.push(`  Revenue per Acre: $${sf.revenue_per_acre.toLocaleString()}`);
  lines.push(`  Infrastructure per Parcel: ${sf.infrastructure_per_parcel.toLocaleString()} linear feet`);
  lines.push(`  Est. Infrastructure Cost per Parcel: $${sf.cost_per_parcel.toLocaleString()}`);
  lines.push(`  Fiscal Sustainability Ratio: ${sf.fiscal_ratio.toFixed(2)}`);

  lines.push('');
  lines.push('MULTI-FAMILY ALLOWED ZONES (GRA, GRB, GRC):');
  lines.push(`  Revenue per Parcel: $${mf.revenue_per_parcel.toLocaleString()}`);
  lines.push(`  Revenue per Acre: $${mf.revenue_per_acre.toLocaleString()}`);
  lines.push(`  Infrastructure per Parcel: ${mf.infrastructure_per_parcel.toLocaleString()} linear feet`);
  lines.push(`  Est. Infrastructure Cost per Parcel: $${mf.cost_per_parcel.toLocaleString()}`);
  lines.push(`  Fiscal Sustainability Ratio: ${mf.fiscal_ratio.toFixed(2)}`);

  lines.push('');
  lines.push('─'.repeat(80));
  lines.push('DIRECT COMPARISON:');
  lines.push('─'.repeat(80));

  const infrastructureRatio = mf.infrastructure_per_parcel > 0
    ? sf.infrastructure_per_parcel / mf.infrastructure_per_parcel
    : 0;
  const fiscalRatioComparison = sf.fiscal_ratio > 0
    ? mf.fiscal_ratio / sf.fiscal_ratio
    : 0;

  lines.push('');
  lines.push(`• Single-family homes require ${infrastructureRatio.toFixed(2)}x MORE linear infrastructure per parcel`);
  lines.push(`• Multi-family zones are ${fiscalRatioComparison.toFixed(2)}x MORE fiscally sustainable`);
  lines.push(`• Multi-family generates $${mf.revenue_per_acre.toLocaleString()}/acre vs $${sf.revenue_per_acre.toLocaleString()}/acre`);

  lines.push('');
  lines.push('Net Fiscal Impact (Revenue - Infrastructure Cost):');
  lines.push(`  Single-family: $${sf.net_fiscal_impact_per_parcel.toLocaleString()} per parcel`);
  lines.push(`  Multi-family: $${mf.net_fiscal_impact_per_parcel.toLocaleString()} per parcel`);

  // Key findings
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('KEY FINDINGS');
  lines.push('='.repeat(80));

  lines.push('');
  lines.push('1. INFRASTRUCTURE BURDEN:');
  lines.push(`   Single-family zones require ${sf.total_infrastructure_ft.toLocaleString()} feet of roads/utilities`);
  lines.push(`   Multi-family zones require ${mf.total_infrastructure_ft.toLocaleString()} feet of roads/utilities`);
  lines.push(`   Single-family zones need ${infrastructureRatio.toFixed(1)}x more infrastructure per household`);

  lines.push('');
  lines.push('2. FISCAL EFFICIENCY:');
  lines.push(`   Single-family fiscal ratio: ${sf.fiscal_ratio.toFixed(1)} (revenue/cost)`);
  lines.push(`   Multi-family fiscal ratio: ${mf.fiscal_ratio.toFixed(1)} (revenue/cost)`);
  lines.push(`   Multi-family zones are ${fiscalRatioComparison.toFixed(1)}x more fiscally sustainable`);

  lines.push('');
  lines.push('3. TAX BURDEN EQUITY:');
  lines.push('   Despite higher property values, single-family homeowners in large-lot zones');
  lines.push('   impose higher infrastructure costs per capita on the municipality.');
  lines.push('   The sprawling nature of low-density development means:');
  lines.push('   - More road miles to maintain per household');
  lines.push('   - Longer utility lines per household');
  lines.push('   - Greater distances for emergency services');
  lines.push('   - Lower tax revenue per acre of land');

  lines.push('');
  lines.push('4. IMPLICATIONS:');
  lines.push('   Residents in SRA zones (1 acre minimums) may contribute less in taxes');
  lines.push('   relative to the municipal services their large lots demand.');
  lines.push('   Multi-family zones effectively subsidize infrastructure costs for');
  lines.push('   lower-density single-family neighborhoods.');

  // Methodology notes
  lines.push('');
  lines.push('='.repeat(80));
  lines.push('METHODOLOGY NOTES');
  lines.push('='.repeat(80));
  lines.push('');
  lines.push('Infrastructure cost estimates based on:');
  lines.push('• Minimum lot frontage requirements (linear feet per parcel)');
  lines.push('• $500/linear foot for combined road + utility infrastructure');
  lines.push('• Does not include: water/sewer capacity, school buses, trash collection');
  lines.push('• Actual costs vary based on terrain, existing infrastructure, etc.');
  lines.push('');
  lines.push('Fiscal Sustainability Ratio = Property Tax Revenue ÷ Infrastructure Cost');
  lines.push('• Higher ratio = more revenue per dollar of infrastructure');
  lines.push('• <20 = concerning fiscal burden');
  lines.push('• 20-50 = moderate sustainability');
  lines.push('• >50 = strong fiscal contributor');

  lines.push('');
  lines.push('─'.repeat(80));
  lines.push(`Report generated: ${timestamp}`);
  lines.push('─'.repeat(80));

  return lines.join('\n');
}
