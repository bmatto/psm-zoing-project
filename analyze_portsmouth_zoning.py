#!/usr/bin/env python3
"""
Portsmouth Zoning Analysis Script
Fetches zoning data from the MapGeo API and calculates zoning metrics.
"""

import csv
import json
import time
import requests
from collections import defaultdict
from typing import Dict, List, Optional

API_BASE_URL = "https://portsmouthnh.mapgeo.io/api/ui/datasets/properties"
RATE_LIMIT_DELAY = 0.5


def load_parcel_ids(csv_path: str) -> List[str]:
    """Load all Portsmouth parcel IDs from CSV."""
    parcel_ids = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('displayid'):
                parcel_ids.append(row['displayid'])
    return parcel_ids


def fetch_property_data(parcel_id: str) -> Optional[Dict]:
    """Fetch property data from MapGeo API."""
    url = f"{API_BASE_URL}/{parcel_id}"
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        return response.json()
    except requests.RequestException as e:
        print(f"Error fetching {parcel_id}: {e}")
        return None


def extract_property_info(data: Dict) -> Dict:
    """Extract relevant property information from API response."""
    if not data or 'data' not in data:
        return None

    props = data['data']

    def clean_number(value):
        """Remove commas from number strings and convert to float."""
        if value is None:
            return 0.0
        if isinstance(value, (int, float)):
            return float(value)
        return float(str(value).replace(',', ''))

    return {
        'parcel_id': props.get('propID') or props.get('id'),
        'address': props.get('displayName'),
        'zoning': props.get('zoningCode'),
        'land_use_code': props.get('landUseCode'),
        'land_use_desc': props.get('lndUseDesc'),
        'total_value': clean_number(props.get('totalValue')),
        'land_value': clean_number(props.get('landValue')),
        'parcel_area_acres': clean_number(props.get('parcelArea')),
        'owner': props.get('ownerName')
    }


def calculate_metrics(properties: List[Dict]) -> Dict:
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


def detect_nonconforming(properties: List[Dict]) -> Dict:
    """
    Detect potentially non-conforming uses.
    This is a simple heuristic based on land use vs zoning patterns.
    """
    nonconforming = defaultdict(list)

    for prop in properties:
        if not prop or not prop.get('zoning'):
            continue

        zone = prop['zoning']
        land_use = prop['land_use_desc'] or ''

        if 'SRB' in zone or 'SRA' in zone:
            if 'COMM' in land_use.upper() or 'INDUSTRIAL' in land_use.upper():
                nonconforming[zone].append({
                    'parcel_id': prop['parcel_id'],
                    'address': prop['address'],
                    'land_use': land_use
                })
        elif 'GB' in zone:
            if 'RESIDENTIAL' in land_use.upper() and 'SINGLE FAM' in land_use.upper():
                nonconforming[zone].append({
                    'parcel_id': prop['parcel_id'],
                    'address': prop['address'],
                    'land_use': land_use
                })

    return dict(nonconforming)


def main():
    print("Loading parcel IDs from CSV...")
    parcel_ids = load_parcel_ids('Portsmouth_Parcels.csv')
    print(f"Found {len(parcel_ids)} Portsmouth parcels")

    print("\nFetching property data from API...")
    print("(This will take a while due to rate limiting)")

    properties = []
    for i, parcel_id in enumerate(parcel_ids):
        if i > 0 and i % 100 == 0:
            print(f"Processed {i}/{len(parcel_ids)} parcels...")

        data = fetch_property_data(parcel_id)
        if data:
            prop_info = extract_property_info(data)
            if prop_info:
                properties.append(prop_info)

        time.sleep(RATE_LIMIT_DELAY)

    with open('portsmouth_properties_full.json', 'w') as f:
        json.dump(properties, f, indent=2)
    print(f"\nSaved {len(properties)} property records to portsmouth_properties_full.json")

    print("\nCalculating metrics...")
    metrics = calculate_metrics(properties)

    print("\n" + "="*70)
    print("PORTSMOUTH ZONING ANALYSIS")
    print("="*70)
    print(f"\nTotal Land Area: {metrics['total_acres']:,.2f} acres")
    print(f"\nTotal Zones: {len(metrics['zones'])}")

    print("\n--- LAND DISTRIBUTION BY ZONE ---")
    sorted_zones = sorted(metrics['zones'].items(), key=lambda x: x[1]['percent_of_land'], reverse=True)
    for zone, data in sorted_zones:
        print(f"\n{zone}:")
        print(f"  Area: {data['total_acres']:,.2f} acres ({data['percent_of_land']:.1f}%)")
        print(f"  Parcels: {data['parcel_count']:,}")

    print("\n--- TAX REVENUE BY ZONE ---")
    sorted_by_value = sorted(metrics['zones'].items(), key=lambda x: x[1]['total_value'], reverse=True)
    for zone, data in sorted_by_value[:10]:
        print(f"\n{zone}:")
        print(f"  Total Value: ${data['total_value']:,.0f}")
        print(f"  Revenue Density: ${data['revenue_density']:,.0f}/acre")

    if 'most_revenue_dense_zone' in metrics:
        print("\n--- MOST REVENUE-DENSE ZONE ---")
        print(f"Zone: {metrics['most_revenue_dense_zone']['zone']}")
        print(f"Revenue per Acre: ${metrics['most_revenue_dense_zone']['revenue_per_acre']:,.0f}")

    nonconforming = detect_nonconforming(properties)
    print("\n--- POTENTIALLY NON-CONFORMING USES ---")
    for zone, parcels in nonconforming.items():
        print(f"\n{zone}: {len(parcels)} potentially non-conforming parcels")
        for parcel in parcels[:5]:
            print(f"  - {parcel['address']} ({parcel['land_use']})")
        if len(parcels) > 5:
            print(f"  ... and {len(parcels) - 5} more")

    with open('portsmouth_zoning_analysis.json', 'w') as f:
        json.dump({
            'metrics': metrics,
            'nonconforming': nonconforming
        }, f, indent=2)

    print("\n" + "="*70)
    print("Analysis complete! Results saved to portsmouth_zoning_analysis.json")
    print("="*70)


if __name__ == '__main__':
    main()
