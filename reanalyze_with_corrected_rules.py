#!/usr/bin/env python3
"""
Re-analyze existing property data with corrected zoning rules
"""

import json
from datetime import datetime
from collections import defaultdict
from portsmouth_zoning_rules_corrected import ZONING_RULES, classify_land_use


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


def generate_violation_summary(violations_analysis: dict) -> str:
    """Generate violation summary report."""
    lines = []
    lines.append("="*80)
    lines.append("CORRECTED ZONING VIOLATIONS ANALYSIS")
    lines.append("Based on Official Portsmouth Zoning Ordinance (May 5, 2025)")
    lines.append("="*80)
    lines.append(f"Total Violations Found: {len(violations_analysis['all_violations'])}\n")

    for zone, data in sorted(violations_analysis['violations_by_zone'].items()):
        if data['parcels_with_violations'] == 0:
            continue

        zone_name = ZONING_RULES.get(zone, {}).get('name', zone)
        violation_rate = (data['parcels_with_violations'] / data['total_parcels']) * 100

        lines.append(f"\n{zone} - {zone_name}")
        lines.append(f"  Total Parcels: {data['total_parcels']}")
        lines.append(f"  Parcels with Violations: {data['parcels_with_violations']}")
        lines.append(f"  Violation Rate: {violation_rate:.1f}%")

        lines.append(f"\n  Violation Types:")
        for vtype, count in data['violations_by_type'].items():
            lines.append(f"    - {vtype}: {count}")

        if data['examples']:
            lines.append(f"\n  Examples (first 5):")
            for ex in data['examples'][:5]:
                lines.append(f"    {ex['address']} ({ex['parcel_id']})")
                for v in ex['violations']:
                    lines.append(f"      • [{v['severity']}] {v['description']}")

    lines.append("\n" + "="*80)
    lines.append("KEY CORRECTIONS FROM PREVIOUS ANALYSIS:")
    lines.append("="*80)
    lines.append("- SRA minimum lot size: 43,560 sf (1 acre), not 15,000 sf")
    lines.append("- SRB minimum lot size: 15,000 sf, not 7,500 sf")
    lines.append("- SRB max coverage: 20%, not 25%")
    lines.append("- GRA minimum lot size: 7,500 sf, not 5,000 sf")
    lines.append("- GRA max coverage: 25%, not 50%")
    lines.append("- R minimum lot size: 217,800 sf (5 acres), not 10,000 sf")
    lines.append("- G1/GB minimum lot size: 43,560 sf (1 acre), not 5,000 sf")
    lines.append("="*80)

    return '\n'.join(lines)


print("Re-analyzing with corrected zoning rules...")
print("Loading existing property data...")

with open('portsmouth_properties_full.json', 'r') as f:
    properties = json.load(f)

print(f"Loaded {len(properties)} properties")
print("Analyzing violations with corrected rules...\n")

violations_analysis = analyze_violations(properties)

# Generate report
report_text = generate_violation_summary(violations_analysis)
print(report_text)

# Save corrected analysis
filename = f'portsmouth_violations_CORRECTED_{datetime.now().strftime("%Y%m%d_%H%M%S")}.txt'
with open(filename, 'w') as f:
    f.write(report_text)

with open('portsmouth_violations_corrected.json', 'w') as f:
    json.dump(violations_analysis, f, indent=2, default=str)

print(f"\nCorrected analysis saved to:")
print(f"  - {filename}")
print(f"  - portsmouth_violations_corrected.json")
