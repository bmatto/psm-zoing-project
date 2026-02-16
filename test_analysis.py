#!/usr/bin/env python3
"""
Test version - only fetches first 50 parcels to verify the script works.
"""

import csv
import json
import time
import requests
from collections import defaultdict
from typing import Dict, List, Optional

API_BASE_URL = "https://portsmouthnh.mapgeo.io/api/ui/datasets/properties"
RATE_LIMIT_DELAY = 0.5
TEST_LIMIT = 50


def load_parcel_ids(csv_path: str, limit: int = None) -> List[str]:
    """Load Portsmouth parcel IDs from CSV."""
    parcel_ids = []
    with open(csv_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row.get('displayid'):
                parcel_ids.append(row['displayid'])
                if limit and len(parcel_ids) >= limit:
                    break
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


def main():
    print(f"TEST MODE: Fetching only first {TEST_LIMIT} parcels")
    print("="*70)

    print("\nLoading parcel IDs from CSV...")
    parcel_ids = load_parcel_ids('Portsmouth_Parcels.csv', limit=TEST_LIMIT)
    print(f"Testing with {len(parcel_ids)} parcels")

    print("\nFetching property data from API...")
    properties = []
    for i, parcel_id in enumerate(parcel_ids):
        print(f"Fetching {i+1}/{len(parcel_ids)}: {parcel_id}")

        data = fetch_property_data(parcel_id)
        if data:
            prop_info = extract_property_info(data)
            if prop_info:
                properties.append(prop_info)
                print(f"  ✓ {prop_info['address']} - Zone: {prop_info['zoning']}")

        time.sleep(RATE_LIMIT_DELAY)

    print(f"\n✓ Successfully fetched {len(properties)} properties")

    print("\nCalculating metrics...")
    metrics = calculate_metrics(properties)

    print("\n" + "="*70)
    print("TEST RESULTS (sample data)")
    print("="*70)
    print(f"\nTotal Land Area (sample): {metrics['total_acres']:,.2f} acres")
    print(f"Zones Found: {len(metrics['zones'])}")

    print("\n--- LAND DISTRIBUTION BY ZONE ---")
    for zone, data in sorted(metrics['zones'].items(), key=lambda x: x[1]['percent_of_land'], reverse=True):
        print(f"{zone}: {data['total_acres']:,.2f} acres ({data['percent_of_land']:.1f}%) - {data['parcel_count']} parcels")

    print("\n--- REVENUE DENSITY BY ZONE ---")
    for zone, data in sorted(metrics['zones'].items(), key=lambda x: x[1]['revenue_density'], reverse=True):
        print(f"{zone}: ${data['revenue_density']:,.0f}/acre (Total: ${data['total_value']:,.0f})")

    if 'most_revenue_dense_zone' in metrics:
        print(f"\nMost Revenue-Dense Zone: {metrics['most_revenue_dense_zone']['zone']} (${metrics['most_revenue_dense_zone']['revenue_per_acre']:,.0f}/acre)")

    print("\n" + "="*70)
    print("✓ Test successful! Run analyze_portsmouth_zoning.py for full analysis")
    print("="*70)


if __name__ == '__main__':
    main()
