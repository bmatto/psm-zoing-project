#!/usr/bin/env python3
"""
Infrastructure Burden Analysis
Shows the relationship between zoning density, tax revenue, and estimated service costs
"""

import json
from datetime import datetime
from collections import defaultdict
from portsmouth_zoning_rules_corrected import ZONING_RULES


def calculate_infrastructure_metrics(properties: list) -> dict:
    """
    Calculate infrastructure burden metrics for each zone.

    Key insight: Lower density zones require MORE infrastructure per capita
    (longer roads, utility lines, emergency service coverage) but generate
    LESS tax revenue per acre.
    """

    zone_data = defaultdict(lambda: {
        'total_acres': 0,
        'total_value': 0,
        'parcel_count': 0,
        'total_frontage_required': 0,  # Based on minimum requirements
        'avg_lot_size': 0
    })

    for prop in properties:
        if not prop or not prop.get('zoning'):
            continue

        zone = prop['zoning']
        acres = prop['parcel_area_acres']
        value = prop['total_value']

        zone_data[zone]['total_acres'] += acres
        zone_data[zone]['total_value'] += value
        zone_data[zone]['parcel_count'] += 1

    # Calculate metrics for each zone
    results = {}

    for zone, data in zone_data.items():
        if zone not in ZONING_RULES:
            continue

        rules = ZONING_RULES[zone]
        parcels = data['parcel_count']
        acres = data['total_acres']
        value = data['total_value']

        if parcels == 0 or acres == 0:
            continue

        # Calculate average lot size
        avg_lot_acres = acres / parcels
        avg_lot_sqft = avg_lot_acres * 43560

        # Revenue metrics
        revenue_per_parcel = value / parcels
        revenue_per_acre = value / acres

        # Infrastructure burden estimates
        min_frontage = rules.get('min_frontage_ft', 0)
        min_lot_size = rules.get('min_lot_size_sqft', 0)

        # Estimate road/utility infrastructure needed
        # More frontage = more road/utility line per lot
        estimated_linear_infrastructure = min_frontage * parcels if min_frontage else 0

        # Infrastructure cost per parcel (relative estimate)
        # Assumes $500/linear foot for roads + utilities (conservative estimate)
        est_infrastructure_cost_per_parcel = min_frontage * 500 if min_frontage else 0

        # Service cost multiplier based on density
        # Lower density = higher service costs per capita (longer distances for police, fire, etc.)
        parcels_per_acre = parcels / acres
        density_factor = 1.0 / parcels_per_acre if parcels_per_acre > 0 else 0

        # Calculate fiscal sustainability ratio
        # Higher is better: how much revenue per dollar of estimated infrastructure burden
        if est_infrastructure_cost_per_parcel > 0:
            fiscal_ratio = revenue_per_parcel / est_infrastructure_cost_per_parcel
        else:
            fiscal_ratio = 0

        results[zone] = {
            'zone_name': rules.get('name', zone),
            'total_acres': round(acres, 2),
            'parcel_count': parcels,
            'total_value': value,
            'avg_lot_size_sqft': round(avg_lot_sqft, 0),
            'avg_lot_size_acres': round(avg_lot_acres, 3),
            'parcels_per_acre': round(parcels_per_acre, 2),
            'revenue_per_parcel': round(revenue_per_parcel, 0),
            'revenue_per_acre': round(revenue_per_acre, 0),
            'min_frontage_ft': min_frontage,
            'min_lot_size_sqft': min_lot_size,
            'estimated_linear_infrastructure_ft': estimated_linear_infrastructure,
            'est_infrastructure_cost_per_parcel': est_infrastructure_cost_per_parcel,
            'density_factor': round(density_factor, 3),
            'fiscal_sustainability_ratio': round(fiscal_ratio, 2)
        }

    return results


def generate_infrastructure_report(zone_metrics: dict) -> str:
    """Generate infrastructure burden analysis report."""

    lines = []
    lines.append("="*80)
    lines.append("PORTSMOUTH INFRASTRUCTURE BURDEN & FISCAL SUSTAINABILITY ANALYSIS")
    lines.append("="*80)
    lines.append("")
    lines.append("This analysis examines the relationship between zoning density, tax revenue,")
    lines.append("and estimated municipal service costs.")
    lines.append("")
    lines.append("KEY CONCEPT: Lower-density zones require MORE infrastructure per household")
    lines.append("(roads, utilities, emergency services) but generate LESS tax revenue per acre.")
    lines.append("")

    # Focus on residential zones
    residential_zones = ['R', 'SRA', 'SRB', 'GRA', 'GRB', 'GRC']

    lines.append("="*80)
    lines.append("RESIDENTIAL ZONE INFRASTRUCTURE ANALYSIS")
    lines.append("="*80)

    for zone in residential_zones:
        if zone not in zone_metrics:
            continue

        data = zone_metrics[zone]

        lines.append(f"\n{zone} - {data['zone_name']}")
        lines.append("─" * 80)

        lines.append(f"\nBasic Metrics:")
        lines.append(f"  Total Land: {data['total_acres']:,.0f} acres")
        lines.append(f"  Total Parcels: {data['parcel_count']:,}")
        lines.append(f"  Average Lot Size: {data['avg_lot_size_sqft']:,.0f} sf ({data['avg_lot_size_acres']:.2f} acres)")
        lines.append(f"  Density: {data['parcels_per_acre']:.2f} parcels/acre")

        lines.append(f"\nMinimum Requirements:")
        lines.append(f"  Minimum Lot Size: {data['min_lot_size_sqft']:,} sf")
        if data['min_frontage_ft']:
            lines.append(f"  Minimum Frontage: {data['min_frontage_ft']:,} feet")
        else:
            lines.append(f"  Minimum Frontage: Not specified")

        lines.append(f"\nTax Revenue:")
        lines.append(f"  Revenue per Parcel: ${data['revenue_per_parcel']:,.0f}")
        lines.append(f"  Revenue per Acre: ${data['revenue_per_acre']:,.0f}")
        lines.append(f"  Total Zone Revenue: ${data['total_value']:,.0f}")

        if data['min_frontage_ft']:
            lines.append(f"\nEstimated Infrastructure Burden:")
            lines.append(f"  Linear Infrastructure per Parcel: {data['min_frontage_ft']:,} feet")
            lines.append(f"  Total Linear Infrastructure: {data['estimated_linear_infrastructure_ft']:,.0f} feet")
            lines.append(f"  Est. Infrastructure Cost/Parcel: ${data['est_infrastructure_cost_per_parcel']:,.0f}")
            lines.append(f"    (Based on $500/linear foot for roads + utilities)")

            lines.append(f"\nFiscal Sustainability:")
            lines.append(f"  Fiscal Ratio: {data['fiscal_sustainability_ratio']:.2f}")
            lines.append(f"    (Revenue per parcel ÷ Infrastructure cost per parcel)")

            if data['fiscal_sustainability_ratio'] < 20:
                lines.append(f"    ⚠ LOW - High infrastructure burden relative to revenue")
            elif data['fiscal_sustainability_ratio'] < 50:
                lines.append(f"    ⚡ MODERATE - Balanced infrastructure vs revenue")
            else:
                lines.append(f"    ✓ HIGH - Revenue significantly exceeds infrastructure costs")

    # Comparative analysis
    lines.append("\n" + "="*80)
    lines.append("COMPARATIVE ANALYSIS: SINGLE-FAMILY vs MULTI-FAMILY ZONES")
    lines.append("="*80)

    sf_zones = ['R', 'SRA', 'SRB']
    mf_zones = ['GRA', 'GRB', 'GRC']

    sf_data = {
        'total_parcels': 0,
        'total_acres': 0,
        'total_revenue': 0,
        'total_infrastructure_ft': 0,
        'total_infrastructure_cost': 0
    }

    mf_data = {
        'total_parcels': 0,
        'total_acres': 0,
        'total_revenue': 0,
        'total_infrastructure_ft': 0,
        'total_infrastructure_cost': 0
    }

    for zone in sf_zones:
        if zone in zone_metrics:
            data = zone_metrics[zone]
            sf_data['total_parcels'] += data['parcel_count']
            sf_data['total_acres'] += data['total_acres']
            sf_data['total_revenue'] += data['total_value']
            sf_data['total_infrastructure_ft'] += data['estimated_linear_infrastructure_ft']
            sf_data['total_infrastructure_cost'] += data['est_infrastructure_cost_per_parcel'] * data['parcel_count']

    for zone in mf_zones:
        if zone in zone_metrics:
            data = zone_metrics[zone]
            mf_data['total_parcels'] += data['parcel_count']
            mf_data['total_acres'] += data['total_acres']
            mf_data['total_revenue'] += data['total_value']
            mf_data['total_infrastructure_ft'] += data['estimated_linear_infrastructure_ft']
            mf_data['total_infrastructure_cost'] += data['est_infrastructure_cost_per_parcel'] * data['parcel_count']

    # Calculate per-parcel and per-acre metrics
    sf_revenue_per_parcel = sf_data['total_revenue'] / sf_data['total_parcels'] if sf_data['total_parcels'] > 0 else 0
    sf_revenue_per_acre = sf_data['total_revenue'] / sf_data['total_acres'] if sf_data['total_acres'] > 0 else 0
    sf_infrastructure_per_parcel = sf_data['total_infrastructure_ft'] / sf_data['total_parcels'] if sf_data['total_parcels'] > 0 else 0
    sf_infrastructure_per_acre = sf_data['total_infrastructure_ft'] / sf_data['total_acres'] if sf_data['total_acres'] > 0 else 0
    sf_cost_per_parcel = sf_data['total_infrastructure_cost'] / sf_data['total_parcels'] if sf_data['total_parcels'] > 0 else 0
    sf_fiscal_ratio = sf_revenue_per_parcel / sf_cost_per_parcel if sf_cost_per_parcel > 0 else 0

    mf_revenue_per_parcel = mf_data['total_revenue'] / mf_data['total_parcels'] if mf_data['total_parcels'] > 0 else 0
    mf_revenue_per_acre = mf_data['total_revenue'] / mf_data['total_acres'] if mf_data['total_acres'] > 0 else 0
    mf_infrastructure_per_parcel = mf_data['total_infrastructure_ft'] / mf_data['total_parcels'] if mf_data['total_parcels'] > 0 else 0
    mf_infrastructure_per_acre = mf_data['total_infrastructure_ft'] / mf_data['total_acres'] if mf_data['total_acres'] > 0 else 0
    mf_cost_per_parcel = mf_data['total_infrastructure_cost'] / mf_data['total_parcels'] if mf_data['total_parcels'] > 0 else 0
    mf_fiscal_ratio = mf_revenue_per_parcel / mf_cost_per_parcel if mf_cost_per_parcel > 0 else 0

    lines.append("\nSINGLE-FAMILY ONLY ZONES (R, SRA, SRB):")
    lines.append(f"  Revenue per Parcel: ${sf_revenue_per_parcel:,.0f}")
    lines.append(f"  Revenue per Acre: ${sf_revenue_per_acre:,.0f}")
    lines.append(f"  Infrastructure per Parcel: {sf_infrastructure_per_parcel:,.0f} linear feet")
    lines.append(f"  Est. Infrastructure Cost per Parcel: ${sf_cost_per_parcel:,.0f}")
    lines.append(f"  Fiscal Sustainability Ratio: {sf_fiscal_ratio:.2f}")

    lines.append("\nMULTI-FAMILY ALLOWED ZONES (GRA, GRB, GRC):")
    lines.append(f"  Revenue per Parcel: ${mf_revenue_per_parcel:,.0f}")
    lines.append(f"  Revenue per Acre: ${mf_revenue_per_acre:,.0f}")
    lines.append(f"  Infrastructure per Parcel: {mf_infrastructure_per_parcel:,.0f} linear feet")
    lines.append(f"  Est. Infrastructure Cost per Parcel: ${mf_cost_per_parcel:,.0f}")
    lines.append(f"  Fiscal Sustainability Ratio: {mf_fiscal_ratio:.2f}")

    lines.append("\n" + "─"*80)
    lines.append("DIRECT COMPARISON:")
    lines.append("─"*80)

    infrastructure_ratio = sf_infrastructure_per_parcel / mf_infrastructure_per_parcel if mf_infrastructure_per_parcel > 0 else 0
    fiscal_ratio_comparison = mf_fiscal_ratio / sf_fiscal_ratio if sf_fiscal_ratio > 0 else 0

    lines.append(f"\n• Single-family homes require {infrastructure_ratio:.2f}x MORE linear infrastructure per parcel")
    lines.append(f"• Multi-family zones are {fiscal_ratio_comparison:.2f}x MORE fiscally sustainable")
    lines.append(f"• Multi-family generates ${mf_revenue_per_acre:,.0f}/acre vs ${sf_revenue_per_acre:,.0f}/acre")

    # Calculate net fiscal impact
    sf_net_per_parcel = sf_revenue_per_parcel - sf_cost_per_parcel
    mf_net_per_parcel = mf_revenue_per_parcel - mf_cost_per_parcel

    lines.append(f"\nNet Fiscal Impact (Revenue - Infrastructure Cost):")
    lines.append(f"  Single-family: ${sf_net_per_parcel:,.0f} per parcel")
    lines.append(f"  Multi-family: ${mf_net_per_parcel:,.0f} per parcel")

    lines.append("\n" + "="*80)
    lines.append("KEY FINDINGS")
    lines.append("="*80)

    lines.append("\n1. INFRASTRUCTURE BURDEN:")
    lines.append(f"   Single-family zones require {sf_data['total_infrastructure_ft']:,.0f} feet of roads/utilities")
    lines.append(f"   Multi-family zones require {mf_data['total_infrastructure_ft']:,.0f} feet of roads/utilities")
    lines.append(f"   Single-family zones need {infrastructure_ratio:.1f}x more infrastructure per household")

    lines.append("\n2. FISCAL EFFICIENCY:")
    lines.append(f"   Single-family fiscal ratio: {sf_fiscal_ratio:.1f} (revenue/cost)")
    lines.append(f"   Multi-family fiscal ratio: {mf_fiscal_ratio:.1f} (revenue/cost)")
    lines.append(f"   Multi-family zones are {fiscal_ratio_comparison:.1f}x more fiscally sustainable")

    lines.append("\n3. TAX BURDEN EQUITY:")
    lines.append(f"   Despite higher property values, single-family homeowners in large-lot zones")
    lines.append(f"   impose higher infrastructure costs per capita on the municipality.")
    lines.append(f"   The sprawling nature of low-density development means:")
    lines.append(f"   - More road miles to maintain per household")
    lines.append(f"   - Longer utility lines per household")
    lines.append(f"   - Greater distances for emergency services")
    lines.append(f"   - Lower tax revenue per acre of land")

    lines.append("\n4. IMPLICATIONS:")
    lines.append(f"   Residents in SRA zones (1 acre minimums) may contribute less in taxes")
    lines.append(f"   relative to the municipal services their large lots demand.")
    lines.append(f"   Multi-family zones effectively subsidize infrastructure costs for")
    lines.append(f"   lower-density single-family neighborhoods.")

    lines.append("\n" + "="*80)
    lines.append("METHODOLOGY NOTES")
    lines.append("="*80)
    lines.append("\nInfrastructure cost estimates based on:")
    lines.append("• Minimum lot frontage requirements (linear feet per parcel)")
    lines.append("• $500/linear foot for combined road + utility infrastructure")
    lines.append("• Does not include: water/sewer capacity, school buses, trash collection")
    lines.append("• Actual costs vary based on terrain, existing infrastructure, etc.")
    lines.append("\nFiscal Sustainability Ratio = Property Tax Revenue ÷ Infrastructure Cost")
    lines.append("• Higher ratio = more revenue per dollar of infrastructure")
    lines.append("• <20 = concerning fiscal burden")
    lines.append("• 20-50 = moderate sustainability")
    lines.append("• >50 = strong fiscal contributor")

    lines.append("\n" + "="*80)
    lines.append("END OF ANALYSIS")
    lines.append("="*80)

    return '\n'.join(lines)


def main():
    print("Generating infrastructure burden analysis...")

    with open('portsmouth_properties_full.json', 'r') as f:
        properties = json.load(f)

    print(f"Loaded {len(properties):,} properties")

    print("Calculating infrastructure metrics...")
    zone_metrics = calculate_infrastructure_metrics(properties)

    print("Generating report...")
    report = generate_infrastructure_report(zone_metrics)

    filename = f"Portsmouth_Infrastructure_Burden_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"

    with open(filename, 'w') as f:
        f.write(report)

    print("\n" + report)

    print(f"\n{'='*80}")
    print(f"Analysis saved to: {filename}")
    print("="*80)


if __name__ == '__main__':
    main()
