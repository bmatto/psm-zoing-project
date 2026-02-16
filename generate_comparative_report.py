#!/usr/bin/env python3
"""
Generate comprehensive report with comparative residential analysis
Shows contrast between single-family-only vs multi-family-allowed zones
"""

import json
from datetime import datetime
from collections import defaultdict
from portsmouth_zoning_rules_corrected import ZONING_RULES, classify_land_use


def calculate_zone_metrics(properties: list) -> dict:
    """Calculate zoning metrics from property data."""
    zone_data = defaultdict(lambda: {
        'total_acres': 0,
        'total_value': 0,
        'parcel_count': 0,
        'land_uses': defaultdict(int)
    })

    total_acres = 0

    for prop in properties:
        if not prop or not prop.get('zoning'):
            continue

        zone = prop['zoning']
        acres = prop['parcel_area_acres']
        value = prop['total_value']
        land_use = prop['land_use_desc'] or 'Unknown'

        zone_data[zone]['total_acres'] += acres
        zone_data[zone]['total_value'] += value
        zone_data[zone]['parcel_count'] += 1
        zone_data[zone]['land_uses'][land_use] += 1

        total_acres += acres

    results = {
        'total_acres': total_acres,
        'zones': {}
    }

    for zone, data in zone_data.items():
        pct_of_land = (data['total_acres'] / total_acres * 100) if total_acres > 0 else 0
        revenue_density = (data['total_value'] / data['total_acres']) if data['total_acres'] > 0 else 0

        results['zones'][zone] = {
            'total_acres': round(data['total_acres'], 2),
            'percent_of_land': round(pct_of_land, 2),
            'total_value': data['total_value'],
            'revenue_density': round(revenue_density, 2),
            'parcel_count': data['parcel_count'],
            'land_uses': dict(data['land_uses'])
        }

    if results['zones']:
        most_dense_zone = max(results['zones'].items(), key=lambda x: x[1]['revenue_density'])
        results['most_revenue_dense_zone'] = {
            'zone': most_dense_zone[0],
            'revenue_per_acre': round(most_dense_zone[1]['revenue_density'], 2)
        }

    return results


def check_zoning_violations(property: dict) -> list:
    """Check property against zoning rules and return violations."""
    violations = []

    zone = property.get('zoning')
    if not zone or zone not in ZONING_RULES:
        return violations

    rules = ZONING_RULES[zone]
    land_use = classify_land_use(property.get('land_use_desc', ''))

    # Check lot size
    if rules.get('min_lot_size_sqft'):
        if property['parcel_area_sqft'] < rules['min_lot_size_sqft']:
            violations.append({
                'type': 'undersized_lot',
                'severity': 'major',
                'description': f"Lot size {property['parcel_area_sqft']:.0f} sqft is below minimum {rules['min_lot_size_sqft']} sqft",
                'deficit': rules['min_lot_size_sqft'] - property['parcel_area_sqft']
            })

    # Check lot coverage
    if rules.get('max_lot_coverage_pct') and property.get('lot_coverage_pct', 0) > 0:
        if property['lot_coverage_pct'] > rules['max_lot_coverage_pct']:
            violations.append({
                'type': 'excess_lot_coverage',
                'severity': 'major',
                'description': f"Lot coverage {property['lot_coverage_pct']:.1f}% exceeds maximum {rules['max_lot_coverage_pct']}%",
                'excess_pct': property['lot_coverage_pct'] - rules['max_lot_coverage_pct']
            })

    # Check land use compatibility
    if rules.get('allowed_uses') and land_use != 'unknown' and land_use != 'vacant':
        if land_use not in rules['allowed_uses']:
            violations.append({
                'type': 'incompatible_use',
                'severity': 'critical',
                'description': f"Land use '{land_use}' not allowed in {rules['name']} zone",
                'current_use': land_use,
                'allowed_uses': rules['allowed_uses']
            })

    return violations


def analyze_violations(properties: list) -> dict:
    """Analyze properties for violations and calculate statistics."""
    violations_by_zone = defaultdict(lambda: {
        'total_parcels': 0,
        'parcels_with_violations': 0,
        'violations_by_type': defaultdict(int),
        'examples': []
    })

    all_violations = []

    for prop in properties:
        if not prop or not prop.get('zoning'):
            continue

        zone = prop['zoning']
        violations_by_zone[zone]['total_parcels'] += 1

        violations = check_zoning_violations(prop)

        if violations:
            violations_by_zone[zone]['parcels_with_violations'] += 1

            for v in violations:
                violations_by_zone[zone]['violations_by_type'][v['type']] += 1

            if len(violations_by_zone[zone]['examples']) < 10:
                violations_by_zone[zone]['examples'].append({
                    'address': prop['address'],
                    'parcel_id': prop['parcel_id'],
                    'violations': violations
                })

            all_violations.append({
                'property': prop,
                'violations': violations
            })

    return {
        'violations_by_zone': dict(violations_by_zone),
        'all_violations': all_violations
    }


def generate_residential_comparison(metrics: dict, violations_analysis: dict) -> str:
    """Generate comparative analysis of single-family vs multi-family zones."""

    single_family_zones = ['R', 'SRA', 'SRB']
    multi_family_zones = ['GRA', 'GRB', 'GRC']

    sf_stats = {
        'total_acres': 0,
        'total_parcels': 0,
        'total_value': 0,
        'violations': 0,
        'undersized_lots': 0,
        'incompatible_uses': 0
    }

    mf_stats = {
        'total_acres': 0,
        'total_parcels': 0,
        'total_value': 0,
        'violations': 0,
        'undersized_lots': 0,
        'incompatible_uses': 0
    }

    # Aggregate single-family zones
    for zone in single_family_zones:
        if zone in metrics['zones']:
            sf_stats['total_acres'] += metrics['zones'][zone]['total_acres']
            sf_stats['total_parcels'] += metrics['zones'][zone]['parcel_count']
            sf_stats['total_value'] += metrics['zones'][zone]['total_value']

        if zone in violations_analysis['violations_by_zone']:
            vdata = violations_analysis['violations_by_zone'][zone]
            sf_stats['violations'] += vdata['parcels_with_violations']
            sf_stats['undersized_lots'] += vdata['violations_by_type']['undersized_lot']
            sf_stats['incompatible_uses'] += vdata['violations_by_type']['incompatible_use']

    # Aggregate multi-family zones
    for zone in multi_family_zones:
        if zone in metrics['zones']:
            mf_stats['total_acres'] += metrics['zones'][zone]['total_acres']
            mf_stats['total_parcels'] += metrics['zones'][zone]['parcel_count']
            mf_stats['total_value'] += metrics['zones'][zone]['total_value']

        if zone in violations_analysis['violations_by_zone']:
            vdata = violations_analysis['violations_by_zone'][zone]
            mf_stats['violations'] += vdata['parcels_with_violations']
            mf_stats['undersized_lots'] += vdata['violations_by_type']['undersized_lot']
            mf_stats['incompatible_uses'] += vdata['violations_by_type']['incompatible_use']

    # Calculate densities and rates
    sf_stats['revenue_density'] = sf_stats['total_value'] / sf_stats['total_acres'] if sf_stats['total_acres'] > 0 else 0
    mf_stats['revenue_density'] = mf_stats['total_value'] / mf_stats['total_acres'] if mf_stats['total_acres'] > 0 else 0

    sf_stats['violation_rate'] = (sf_stats['violations'] / sf_stats['total_parcels'] * 100) if sf_stats['total_parcels'] > 0 else 0
    mf_stats['violation_rate'] = (mf_stats['violations'] / mf_stats['total_parcels'] * 100) if mf_stats['total_parcels'] > 0 else 0

    sf_stats['parcels_per_acre'] = sf_stats['total_parcels'] / sf_stats['total_acres'] if sf_stats['total_acres'] > 0 else 0
    mf_stats['parcels_per_acre'] = mf_stats['total_parcels'] / mf_stats['total_acres'] if mf_stats['total_acres'] > 0 else 0

    lines = []
    lines.append("\n" + "="*80)
    lines.append("RESIDENTIAL ZONE COMPARATIVE ANALYSIS")
    lines.append("Single-Family Only vs Multi-Family Allowed Zones")
    lines.append("="*80)

    lines.append("\n" + "─"*80)
    lines.append("SINGLE-FAMILY ONLY ZONES (R, SRA, SRB)")
    lines.append("─"*80)
    lines.append("These zones permit ONLY single-family dwellings")
    lines.append("")
    lines.append(f"Total Land Area: {sf_stats['total_acres']:,.2f} acres")
    lines.append(f"Total Parcels: {sf_stats['total_parcels']:,}")
    lines.append(f"Parcels per Acre: {sf_stats['parcels_per_acre']:.2f}")
    lines.append(f"Total Property Value: ${sf_stats['total_value']:,.0f}")
    lines.append(f"Revenue Density: ${sf_stats['revenue_density']:,.0f}/acre")
    lines.append("")
    lines.append("Zone Breakdown:")
    for zone in single_family_zones:
        if zone in metrics['zones']:
            data = metrics['zones'][zone]
            zone_name = ZONING_RULES[zone]['name']
            min_lot = ZONING_RULES[zone]['min_lot_size_sqft']
            lines.append(f"  {zone} ({zone_name}): {data['total_acres']:,.0f} acres, "
                        f"{data['parcel_count']:,} parcels (min lot: {min_lot:,} sf)")

    lines.append("")
    lines.append("Violations:")
    lines.append(f"  Parcels with Violations: {sf_stats['violations']:,} ({sf_stats['violation_rate']:.1f}%)")
    lines.append(f"  Undersized Lots: {sf_stats['undersized_lots']:,}")
    lines.append(f"  Incompatible Uses: {sf_stats['incompatible_uses']:,}")

    lines.append("\n" + "─"*80)
    lines.append("MULTI-FAMILY ALLOWED ZONES (GRA, GRB, GRC)")
    lines.append("─"*80)
    lines.append("These zones permit single-family, two-family, AND multi-family dwellings")
    lines.append("")
    lines.append(f"Total Land Area: {mf_stats['total_acres']:,.2f} acres")
    lines.append(f"Total Parcels: {mf_stats['total_parcels']:,}")
    lines.append(f"Parcels per Acre: {mf_stats['parcels_per_acre']:.2f}")
    lines.append(f"Total Property Value: ${mf_stats['total_value']:,.0f}")
    lines.append(f"Revenue Density: ${mf_stats['revenue_density']:,.0f}/acre")
    lines.append("")
    lines.append("Zone Breakdown:")
    for zone in multi_family_zones:
        if zone in metrics['zones']:
            data = metrics['zones'][zone]
            zone_name = ZONING_RULES[zone]['name']
            min_lot = ZONING_RULES[zone]['min_lot_size_sqft']
            lines.append(f"  {zone} ({zone_name}): {data['total_acres']:,.0f} acres, "
                        f"{data['parcel_count']:,} parcels (min lot: {min_lot:,} sf)")

    lines.append("")
    lines.append("Violations:")
    lines.append(f"  Parcels with Violations: {mf_stats['violations']:,} ({mf_stats['violation_rate']:.1f}%)")
    lines.append(f"  Undersized Lots: {mf_stats['undersized_lots']:,}")
    lines.append(f"  Incompatible Uses: {mf_stats['incompatible_uses']:,}")

    # Direct comparison
    lines.append("\n" + "─"*80)
    lines.append("DIRECT COMPARISON")
    lines.append("─"*80)

    land_ratio = sf_stats['total_acres'] / mf_stats['total_acres'] if mf_stats['total_acres'] > 0 else 0
    value_ratio = sf_stats['total_value'] / mf_stats['total_value'] if mf_stats['total_value'] > 0 else 0
    density_ratio = mf_stats['revenue_density'] / sf_stats['revenue_density'] if sf_stats['revenue_density'] > 0 else 0
    parcel_density_ratio = mf_stats['parcels_per_acre'] / sf_stats['parcels_per_acre'] if sf_stats['parcels_per_acre'] > 0 else 0

    lines.append("")
    lines.append(f"Land Area:")
    lines.append(f"  Single-family zones have {land_ratio:.2f}x MORE land than multi-family zones")
    lines.append(f"  Single-family: {sf_stats['total_acres']:,.0f} acres vs Multi-family: {mf_stats['total_acres']:,.0f} acres")

    lines.append("")
    lines.append(f"Total Property Value:")
    if value_ratio > 1:
        lines.append(f"  Single-family zones have {value_ratio:.2f}x MORE value than multi-family zones")
    else:
        lines.append(f"  Multi-family zones have {1/value_ratio:.2f}x MORE value than single-family zones")
    lines.append(f"  Single-family: ${sf_stats['total_value']:,.0f} vs Multi-family: ${mf_stats['total_value']:,.0f}")

    lines.append("")
    lines.append(f"Revenue Density (Value per Acre):")
    lines.append(f"  Multi-family zones are {density_ratio:.2f}x MORE revenue-dense than single-family zones")
    lines.append(f"  Single-family: ${sf_stats['revenue_density']:,.0f}/acre vs Multi-family: ${mf_stats['revenue_density']:,.0f}/acre")

    lines.append("")
    lines.append(f"Parcel Density (Parcels per Acre):")
    lines.append(f"  Multi-family zones have {parcel_density_ratio:.2f}x MORE parcels per acre")
    lines.append(f"  Single-family: {sf_stats['parcels_per_acre']:.2f} parcels/acre vs Multi-family: {mf_stats['parcels_per_acre']:.2f} parcels/acre")

    lines.append("")
    lines.append(f"Violation Rates:")
    if sf_stats['violation_rate'] > mf_stats['violation_rate']:
        diff = sf_stats['violation_rate'] - mf_stats['violation_rate']
        lines.append(f"  Single-family zones have {diff:.1f} percentage points HIGHER violation rate")
    else:
        diff = mf_stats['violation_rate'] - sf_stats['violation_rate']
        lines.append(f"  Multi-family zones have {diff:.1f} percentage points HIGHER violation rate")
    lines.append(f"  Single-family: {sf_stats['violation_rate']:.1f}% vs Multi-family: {mf_stats['violation_rate']:.1f}%")

    lines.append("\n" + "="*80)
    lines.append("KEY INSIGHTS")
    lines.append("="*80)

    total_residential_acres = sf_stats['total_acres'] + mf_stats['total_acres']
    sf_pct = (sf_stats['total_acres'] / total_residential_acres * 100) if total_residential_acres > 0 else 0
    mf_pct = (mf_stats['total_acres'] / total_residential_acres * 100) if total_residential_acres > 0 else 0

    lines.append(f"\n• {sf_pct:.1f}% of residential land is zoned for single-family ONLY")
    lines.append(f"• {mf_pct:.1f}% of residential land allows multi-family housing")
    lines.append(f"• Multi-family zones generate {density_ratio:.2f}x more tax revenue per acre")
    lines.append(f"• Multi-family zones accommodate {parcel_density_ratio:.2f}x more housing units per acre")
    lines.append(f"• {sf_stats['undersized_lots']:,} parcels in single-family zones are too small for current zoning")
    lines.append(f"• {mf_stats['undersized_lots']:,} parcels in multi-family zones are too small for current zoning")

    return '\n'.join(lines)


def generate_full_report_with_comparison(metrics: dict, violations_analysis: dict,
                                         properties_count: int, timestamp: str) -> str:
    """Generate complete report with comparison section."""
    lines = []
    lines.append("="*80)
    lines.append("PORTSMOUTH NH COMPREHENSIVE ZONING ANALYSIS")
    lines.append("WITH RESIDENTIAL ZONE COMPARISON")
    lines.append("="*80)
    lines.append(f"Generated: {timestamp}")
    lines.append(f"Based on: Portsmouth Zoning Ordinance (Amended through May 5, 2025)")
    lines.append(f"Total Properties Analyzed: {properties_count:,}")
    lines.append(f"Total Land Area: {metrics['total_acres']:,.2f} acres")

    # Add comparison section
    comparison = generate_residential_comparison(metrics, violations_analysis)
    lines.append(comparison)

    # Rest of report...
    lines.append("\n" + "="*80)
    lines.append("COMPLETE LAND DISTRIBUTION BY ZONE")
    lines.append("="*80)
    sorted_zones = sorted(metrics['zones'].items(), key=lambda x: x[1]['percent_of_land'], reverse=True)
    for zone, data in sorted_zones[:15]:
        zone_name = ZONING_RULES.get(zone, {}).get('name', zone)
        lines.append(f"\n{zone} - {zone_name}")
        lines.append(f"  Area: {data['total_acres']:,.2f} acres ({data['percent_of_land']:.1f}%)")
        lines.append(f"  Parcels: {data['parcel_count']:,}")

    lines.append("\n" + "="*80)
    lines.append("END OF REPORT")
    lines.append("="*80)

    return '\n'.join(lines)


def main():
    print("Generating comparative residential analysis report...")

    with open('portsmouth_properties_full.json', 'r') as f:
        properties = json.load(f)

    print(f"Loaded {len(properties):,} properties")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("Calculating metrics...")
    metrics = calculate_zone_metrics(properties)

    print("Analyzing violations...")
    violations_analysis = analyze_violations(properties)

    print("Generating comparative report...")
    report_text = generate_full_report_with_comparison(metrics, violations_analysis,
                                                       len(properties), timestamp)

    report_filename = f"Portsmouth_Residential_Comparison_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_filename, 'w') as f:
        f.write(report_text)

    print("\n" + report_text)

    print(f"\n{'='*80}")
    print(f"Report saved to: {report_filename}")
    print("="*80)


if __name__ == '__main__':
    main()
