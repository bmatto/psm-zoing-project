#!/usr/bin/env python3
"""
Enhanced Portsmouth Zoning Analysis - Checks for specific zoning violations
Fetches building data and checks against Portsmouth zoning rules
"""

import csv
import json
import time
import re
import requests
from collections import defaultdict
from typing import Dict, List, Optional
from portsmouth_zoning_rules import ZONING_RULES, classify_land_use, get_zone_rules

MAPGEO_API_URL = "https://portsmouthnh.mapgeo.io/api/ui/datasets/properties"
VGSI_BASE_URL = "http://gis.vgsi.com/PortsmouthNH/Parcel.aspx"
RATE_LIMIT_DELAY = 0.5
TEST_LIMIT = 100  # Process first 100 for testing


def load_parcel_ids(csv_path: str, limit: int = None) -> List[Dict]:
    """Load Portsmouth parcel IDs and account numbers from CSV."""
    parcels = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('displayid'):
                parcels.append({
                    'display_id': row['displayid'],
                    'u_id': row.get('u_id', '').split('-')[-1] if row.get('u_id') else None
                })
                if limit and len(parcels) >= limit:
                    break
    return parcels


def fetch_mapgeo_data(parcel_id: str) -> Optional[Dict]:
    """Fetch property data from MapGeo API."""
    url = f"{MAPGEO_API_URL}/{parcel_id}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching MapGeo data for {parcel_id}: {e}")
        return None


def fetch_vgsi_building_data(account_number: str) -> Optional[Dict]:
    """Fetch detailed building data from VGSI."""
    url = f"{VGSI_BASE_URL}?Pid={account_number}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        html = response.text

        building_data = {}

        # Extract building footprint using regex
        living_area_match = re.search(r'Living Area.*?(\d+,?\d*)\s*SF', html, re.IGNORECASE)
        if living_area_match:
            building_data['living_area_sqft'] = float(living_area_match.group(1).replace(',', ''))

        # Look for total building area or footprint
        footprint_patterns = [
            r'Building Footprint.*?(\d+,?\d*)\s*sq\s*ft',
            r'Total Building.*?(\d+,?\d*)\s*sq\s*ft',
            r'Gross Building.*?(\d+,?\d*)\s*sq\s*ft'
        ]

        for pattern in footprint_patterns:
            match = re.search(pattern, html, re.IGNORECASE)
            if match:
                building_data['building_footprint_sqft'] = float(match.group(1).replace(',', ''))
                break

        # If no explicit footprint, use living area as approximation
        if 'building_footprint_sqft' not in building_data and 'living_area_sqft' in building_data:
            building_data['building_footprint_sqft'] = building_data['living_area_sqft']

        return building_data if building_data else None

    except requests.RequestException as e:
        print(f"  Warning: Could not fetch VGSI data for {account_number}: {e}")
        return None


def clean_number(value):
    """Remove commas from number strings and convert to float."""
    if value is None:
        return 0.0
    if isinstance(value, (int, float)):
        return float(value)
    return float(str(value).replace(',', ''))


def extract_property_info(mapgeo_data: Dict, vgsi_data: Optional[Dict]) -> Optional[Dict]:
    """Extract and combine property information from both sources."""
    if not mapgeo_data or 'data' not in mapgeo_data:
        return None

    props = mapgeo_data['data']

    parcel_area_acres = clean_number(props.get('parcelArea'))
    parcel_area_sqft = parcel_area_acres * 43560

    property_info = {
        'parcel_id': props.get('propID') or props.get('id'),
        'address': props.get('displayName'),
        'zoning': props.get('zoningCode'),
        'land_use_code': props.get('landUseCode'),
        'land_use_desc': props.get('lndUseDesc'),
        'total_value': clean_number(props.get('totalValue')),
        'land_value': clean_number(props.get('landValue')),
        'parcel_area_acres': parcel_area_acres,
        'parcel_area_sqft': parcel_area_sqft,
        'owner': props.get('ownerName'),
        'account': props.get('account')
    }

    # Add building data if available
    if vgsi_data:
        property_info['building_footprint_sqft'] = vgsi_data.get('building_footprint_sqft', 0)
        property_info['living_area_sqft'] = vgsi_data.get('living_area_sqft', 0)

        # Calculate lot coverage
        if property_info['building_footprint_sqft'] > 0 and parcel_area_sqft > 0:
            property_info['lot_coverage_pct'] = (property_info['building_footprint_sqft'] / parcel_area_sqft) * 100
        else:
            property_info['lot_coverage_pct'] = 0
    else:
        property_info['building_footprint_sqft'] = 0
        property_info['lot_coverage_pct'] = 0

    return property_info


def check_zoning_violations(property: Dict) -> List[Dict]:
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
    if rules.get('max_lot_coverage_pct') and property['lot_coverage_pct'] > 0:
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


def analyze_properties(properties: List[Dict]) -> Dict:
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

            # Store example (limit to 5 per zone)
            if len(violations_by_zone[zone]['examples']) < 5:
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


def main():
    print("ENHANCED ZONING VIOLATION ANALYSIS")
    print("Testing with first 100 parcels...")
    print("="*70)

    parcels = load_parcel_ids('Portsmouth_Parcels.csv', limit=TEST_LIMIT)
    print(f"Loaded {len(parcels)} parcels for analysis\n")

    properties = []
    print("Fetching property data (MapGeo + VGSI building data)...")

    for i, parcel in enumerate(parcels):
        if (i + 1) % 10 == 0:
            print(f"  Processed {i+1}/{len(parcels)}...")

        # Fetch MapGeo data
        mapgeo_data = fetch_mapgeo_data(parcel['display_id'])
        if not mapgeo_data:
            continue

        # Try to fetch VGSI building data if we have account number
        vgsi_data = None
        if mapgeo_data.get('data', {}).get('account'):
            account = mapgeo_data['data']['account']
            vgsi_data = fetch_vgsi_building_data(account)

        prop_info = extract_property_info(mapgeo_data, vgsi_data)
        if prop_info:
            properties.append(prop_info)

        time.sleep(RATE_LIMIT_DELAY)

    print(f"\n✓ Successfully processed {len(properties)} properties\n")

    # Save raw property data
    with open('properties_with_building_data.json', 'w') as f:
        json.dump(properties, f, indent=2)

    print("Analyzing violations...")
    analysis = analyze_properties(properties)

    print("\n" + "="*70)
    print("ZONING VIOLATION ANALYSIS RESULTS")
    print("="*70)

    for zone, data in sorted(analysis['violations_by_zone'].items()):
        print(f"\n{zone} - {ZONING_RULES.get(zone, {}).get('name', zone)}")
        print(f"  Total Parcels: {data['total_parcels']}")
        print(f"  Parcels with Violations: {data['parcels_with_violations']}")

        if data['parcels_with_violations'] > 0:
            violation_rate = (data['parcels_with_violations'] / data['total_parcels']) * 100
            print(f"  Violation Rate: {violation_rate:.1f}%")

            print(f"\n  Violation Types:")
            for vtype, count in data['violations_by_type'].items():
                print(f"    - {vtype}: {count}")

            if data['examples']:
                print(f"\n  Examples:")
                for ex in data['examples']:
                    print(f"    {ex['address']} ({ex['parcel_id']})")
                    for v in ex['violations']:
                        print(f"      • [{v['severity']}] {v['description']}")

    # Save analysis results
    with open('zoning_violations_analysis.json', 'w') as f:
        json.dump(analysis, f, indent=2, default=str)

    print("\n" + "="*70)
    print(f"Analysis complete!")
    print(f"Total violations found: {len(analysis['all_violations'])}")
    print("Results saved to:")
    print("  - properties_with_building_data.json")
    print("  - zoning_violations_analysis.json")
    print("="*70)


if __name__ == '__main__':
    main()
