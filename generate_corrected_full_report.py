#!/usr/bin/env python3
"""
Generate full comprehensive report with CORRECTED zoning rules
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

            # Store example (limit to 10 per zone)
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


def generate_report(metrics: dict, violations_analysis: dict, properties_count: int, timestamp: str) -> str:
    """Generate formatted text report."""
    lines = []
    lines.append("="*80)
    lines.append("PORTSMOUTH NH COMPREHENSIVE ZONING ANALYSIS REPORT")
    lines.append("WITH CORRECTED ZONING RULES")
    lines.append("="*80)
    lines.append(f"Generated: {timestamp}")
    lines.append(f"Based on: Portsmouth Zoning Ordinance (Amended through May 5, 2025)")
    lines.append(f"Source: https://files.portsmouthnh.gov/files/planning/ZoningOrd-250505+ADOPTED.pdf")
    lines.append(f"Total Properties Analyzed: {properties_count:,}")
    lines.append(f"Total Land Area: {metrics['total_acres']:,.2f} acres")
    lines.append(f"Total Zones: {len(metrics['zones'])}")
    lines.append("")

    # Land Distribution
    lines.append("="*80)
    lines.append("LAND DISTRIBUTION BY ZONE")
    lines.append("="*80)
    sorted_zones = sorted(metrics['zones'].items(), key=lambda x: x[1]['percent_of_land'], reverse=True)
    for zone, data in sorted_zones:
        zone_name = ZONING_RULES.get(zone, {}).get('name', zone)
        lines.append(f"\n{zone} - {zone_name}")
        lines.append(f"  Area: {data['total_acres']:,.2f} acres ({data['percent_of_land']:.1f}%)")
        lines.append(f"  Parcels: {data['parcel_count']:,}")

    # Tax Revenue
    lines.append("\n" + "="*80)
    lines.append("TAX REVENUE ANALYSIS BY ZONE")
    lines.append("="*80)
    sorted_by_value = sorted(metrics['zones'].items(), key=lambda x: x[1]['total_value'], reverse=True)
    for zone, data in sorted_by_value[:15]:
        zone_name = ZONING_RULES.get(zone, {}).get('name', zone)
        lines.append(f"\n{zone} - {zone_name}")
        lines.append(f"  Total Value: ${data['total_value']:,.0f}")
        lines.append(f"  Revenue Density: ${data['revenue_density']:,.0f}/acre")
        lines.append(f"  Parcels: {data['parcel_count']:,}")

    if 'most_revenue_dense_zone' in metrics:
        lines.append(f"\n{'─'*80}")
        lines.append("MOST REVENUE-DENSE ZONE")
        lines.append(f"{'─'*80}")
        lines.append(f"Zone: {metrics['most_revenue_dense_zone']['zone']}")
        lines.append(f"Revenue per Acre: ${metrics['most_revenue_dense_zone']['revenue_per_acre']:,.0f}")

    # Violations
    lines.append("\n" + "="*80)
    lines.append("ZONING VIOLATIONS ANALYSIS (CORRECTED)")
    lines.append("="*80)
    lines.append(f"Total Violations Found: {len(violations_analysis['all_violations'])}")
    lines.append("")
    lines.append("NOTE: This analysis uses the CORRECTED zoning requirements from the")
    lines.append("official Portsmouth Zoning Ordinance (May 5, 2025 amendments).")
    lines.append("")

    # Sort zones by violation rate
    zones_with_violations = [(zone, data) for zone, data in violations_analysis['violations_by_zone'].items()
                             if data['parcels_with_violations'] > 0]
    zones_with_violations.sort(key=lambda x: x[1]['parcels_with_violations'] / x[1]['total_parcels'], reverse=True)

    for zone, data in zones_with_violations:
        zone_name = ZONING_RULES.get(zone, {}).get('name', zone)
        violation_rate = (data['parcels_with_violations'] / data['total_parcels']) * 100

        lines.append(f"\n{zone} - {zone_name}")
        lines.append(f"  Total Parcels: {data['total_parcels']}")
        lines.append(f"  Parcels with Violations: {data['parcels_with_violations']}")
        lines.append(f"  Violation Rate: {violation_rate:.1f}%")

        lines.append(f"\n  Violation Types:")
        for vtype, count in sorted(data['violations_by_type'].items(), key=lambda x: x[1], reverse=True):
            lines.append(f"    - {vtype}: {count}")

        if data['examples']:
            lines.append(f"\n  Examples (first 5):")
            for ex in data['examples'][:5]:
                lines.append(f"    {ex['address']} ({ex['parcel_id']})")
                for v in ex['violations']:
                    lines.append(f"      • [{v['severity']}] {v['description']}")
            if len(data['examples']) > 5:
                lines.append(f"    ... and {len(data['examples']) - 5} more examples")

    # Summary statistics
    lines.append("\n" + "="*80)
    lines.append("VIOLATION SUMMARY STATISTICS")
    lines.append("="*80)

    total_undersized = sum(d['violations_by_type']['undersized_lot']
                          for d in violations_analysis['violations_by_zone'].values())
    total_coverage = sum(d['violations_by_type']['excess_lot_coverage']
                        for d in violations_analysis['violations_by_zone'].values())
    total_incompatible = sum(d['violations_by_type']['incompatible_use']
                            for d in violations_analysis['violations_by_zone'].values())

    lines.append(f"\nTotal Undersized Lots: {total_undersized:,}")
    lines.append(f"Total Excess Lot Coverage: {total_coverage:,}")
    lines.append(f"Total Incompatible Land Uses: {total_incompatible:,}")

    lines.append("\n" + "="*80)
    lines.append("KEY DIMENSIONAL REQUIREMENTS (from Official Ordinance)")
    lines.append("="*80)
    lines.append("\nResidential Zones:")
    lines.append("  R:   Minimum 217,800 sf (5 acres), Max 5% coverage")
    lines.append("  SRA: Minimum 43,560 sf (1 acre), Max 10% coverage")
    lines.append("  SRB: Minimum 15,000 sf, Max 20% coverage")
    lines.append("  GRA: Minimum 7,500 sf, Max 25% coverage")
    lines.append("  GRB: Minimum 5,000 sf, Max 30% coverage")
    lines.append("  GRC: Minimum 3,500 sf, Max 35% coverage")
    lines.append("\nBusiness Zones:")
    lines.append("  B/WB: Minimum 20,000 sf, Max 30-35% coverage")
    lines.append("  GB/G1/G2: Minimum 43,560 sf (1 acre), Max 30% coverage")
    lines.append("\nIndustrial Zones:")
    lines.append("  I/WI: Minimum 87,120 sf (2 acres), Max 50% coverage")
    lines.append("  OR: Minimum 130,680 sf (3 acres), Max 30% coverage")

    lines.append("\n" + "="*80)
    lines.append("END OF REPORT")
    lines.append("="*80)

    return '\n'.join(lines)


def main():
    print("Generating CORRECTED comprehensive report...")
    print("Loading property data...")

    with open('portsmouth_properties_full.json', 'r') as f:
        properties = json.load(f)

    print(f"Loaded {len(properties):,} properties")

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("Calculating metrics...")
    metrics = calculate_zone_metrics(properties)

    print("Analyzing violations with corrected rules...")
    violations_analysis = analyze_violations(properties)

    print("Generating report...")
    report_text = generate_report(metrics, violations_analysis, len(properties), timestamp)

    # Write report to file
    report_filename = f"Portsmouth_Zoning_Report_CORRECTED_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_filename, 'w') as f:
        f.write(report_text)

    # Also print to console
    print("\n" + report_text)

    # Save analysis JSON
    analysis_filename = 'portsmouth_analysis_CORRECTED_full.json'
    with open(analysis_filename, 'w') as f:
        json.dump({
            'timestamp': timestamp,
            'properties_analyzed': len(properties),
            'metrics': metrics,
            'violations_analysis': violations_analysis,
            'note': 'Analysis based on corrected zoning rules from official Portsmouth Zoning Ordinance (May 5, 2025)'
        }, f, indent=2, default=str)

    print(f"\n{'='*80}")
    print("CORRECTED FILES CREATED:")
    print(f"  - {report_filename} (human-readable report)")
    print(f"  - {analysis_filename} (detailed JSON data)")
    print("="*80)


if __name__ == '__main__':
    main()
