#!/usr/bin/env python3
"""
Parallel Portsmouth Zoning Analysis - Much faster!
Uses async/await for concurrent API requests (like JS promises)
"""

import csv
import json
import asyncio
import aiohttp
import re
from collections import defaultdict
from typing import Dict, List, Optional
from datetime import datetime
from portsmouth_zoning_rules_corrected import ZONING_RULES, classify_land_use, get_zone_rules

MAPGEO_API_URL = "https://portsmouthnh.mapgeo.io/api/ui/datasets/properties"
VGSI_BASE_URL = "http://gis.vgsi.com/PortsmouthNH/Parcel.aspx"
MAX_CONCURRENT_REQUESTS = 20  # Number of parallel requests


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


async def fetch_mapgeo_data(session: aiohttp.ClientSession, parcel_id: str) -> Optional[Dict]:
    """Fetch property data from MapGeo API (async)."""
    url = f"{MAPGEO_API_URL}/{parcel_id}"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as response:
            response.raise_for_status()
            return await response.json()
    except Exception as e:
        return None


async def fetch_vgsi_building_data(session: aiohttp.ClientSession, account_number: str) -> Optional[Dict]:
    """Fetch detailed building data from VGSI (async)."""
    url = f"{VGSI_BASE_URL}?Pid={account_number}"
    try:
        async with session.get(url, timeout=aiohttp.ClientTimeout(total=15)) as response:
            response.raise_for_status()
            html = await response.text()

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

    except Exception:
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


async def fetch_property_data(session: aiohttp.ClientSession, parcel: Dict, semaphore: asyncio.Semaphore) -> Optional[Dict]:
    """Fetch all data for a single property (rate-limited with semaphore)."""
    async with semaphore:
        # Fetch MapGeo data
        mapgeo_data = await fetch_mapgeo_data(session, parcel['display_id'])
        if not mapgeo_data:
            return None

        # Try to fetch VGSI building data if we have account number
        vgsi_data = None
        account = mapgeo_data.get('data', {}).get('account')
        if account:
            vgsi_data = await fetch_vgsi_building_data(session, account)

        return extract_property_info(mapgeo_data, vgsi_data)


async def fetch_all_properties(parcels: List[Dict]) -> List[Dict]:
    """Fetch all property data in parallel."""
    semaphore = asyncio.Semaphore(MAX_CONCURRENT_REQUESTS)

    async with aiohttp.ClientSession() as session:
        tasks = [fetch_property_data(session, parcel, semaphore) for parcel in parcels]

        # Process with progress updates
        properties = []
        total = len(tasks)

        for i, coro in enumerate(asyncio.as_completed(tasks)):
            result = await coro
            if result:
                properties.append(result)

            # Progress update every 100 parcels
            if (i + 1) % 100 == 0:
                print(f"  Progress: {i+1}/{total} parcels fetched ({len(properties)} successful)")

        return properties


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


def calculate_zone_metrics(properties: List[Dict]) -> Dict:
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


def analyze_violations(properties: List[Dict]) -> Dict:
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


def generate_report(metrics: Dict, violations_analysis: Dict, properties_count: int, timestamp: str) -> str:
    """Generate formatted text report."""
    lines = []
    lines.append("="*80)
    lines.append("PORTSMOUTH NH COMPREHENSIVE ZONING ANALYSIS REPORT")
    lines.append("="*80)
    lines.append(f"Generated: {timestamp}")
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
    lines.append("ZONING VIOLATIONS ANALYSIS")
    lines.append("="*80)
    lines.append(f"Total Violations Found: {len(violations_analysis['all_violations'])}")
    lines.append("")

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
            lines.append(f"\n  Examples:")
            for ex in data['examples'][:5]:
                lines.append(f"    {ex['address']} ({ex['parcel_id']})")
                for v in ex['violations']:
                    lines.append(f"      • [{v['severity']}] {v['description']}")
            if len(data['examples']) > 5:
                lines.append(f"    ... and {len(data['examples']) - 5} more examples")

    lines.append("\n" + "="*80)
    lines.append("END OF REPORT")
    lines.append("="*80)

    return '\n'.join(lines)


async def main():
    import sys

    # Check if limit argument provided
    limit = None
    if len(sys.argv) > 1:
        limit = int(sys.argv[1])

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    print("PORTSMOUTH NH COMPREHENSIVE ZONING ANALYSIS")
    print("Using parallel async requests for faster processing")
    print("="*80)

    print("\nLoading parcel data...")
    parcels = load_parcel_ids('Portsmouth_Parcels.csv', limit=limit)
    print(f"Loaded {len(parcels):,} parcels for analysis")

    print(f"\nFetching property data in parallel ({MAX_CONCURRENT_REQUESTS} concurrent requests)...")
    print("This will be much faster than sequential processing!\n")

    start_time = asyncio.get_event_loop().time()
    properties = await fetch_all_properties(parcels)
    elapsed = asyncio.get_event_loop().time() - start_time

    print(f"\n✓ Successfully fetched {len(properties):,} properties in {elapsed:.1f} seconds")
    print(f"  Average: {len(properties)/elapsed:.1f} properties/second")

    # Save raw data
    print("\nSaving property data...")
    with open('portsmouth_properties_full.json', 'w') as f:
        json.dump(properties, f, indent=2)

    # Calculate metrics
    print("Calculating zoning metrics...")
    metrics = calculate_zone_metrics(properties)

    # Analyze violations
    print("Analyzing violations...")
    violations_analysis = analyze_violations(properties)

    # Generate report
    print("Generating report...")
    report_text = generate_report(metrics, violations_analysis, len(properties), timestamp)

    # Write report to file
    report_filename = f"portsmouth_zoning_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
    with open(report_filename, 'w') as f:
        f.write(report_text)

    # Also print to console
    print("\n" + report_text)

    # Save analysis JSON
    analysis_filename = 'portsmouth_zoning_analysis_full.json'
    with open(analysis_filename, 'w') as f:
        json.dump({
            'timestamp': timestamp,
            'properties_analyzed': len(properties),
            'metrics': metrics,
            'violations_analysis': violations_analysis
        }, f, indent=2, default=str)

    print(f"\n{'='*80}")
    print("FILES CREATED:")
    print(f"  - {report_filename} (human-readable report)")
    print(f"  - {analysis_filename} (detailed JSON data)")
    print(f"  - portsmouth_properties_full.json (all property data)")
    print("="*80)


if __name__ == '__main__':
    asyncio.run(main())
