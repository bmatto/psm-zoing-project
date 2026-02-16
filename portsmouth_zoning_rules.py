"""
Portsmouth NH Zoning Rules
Based on Portsmouth Zoning Ordinance (as amended through May 5, 2025)
Source: https://www.portsmouthnh.gov/planportsmouth/land-use-and-zoning-regulations
"""

ZONING_RULES = {
    'SRB': {  # Single Residence B
        'name': 'Single Residence B',
        'min_lot_size_sqft': 7500,
        'min_frontage_ft': 100,
        'max_lot_coverage_pct': 25,
        'min_open_space_pct': 30,
        'front_setback_ft': 30,
        'side_setback_ft': 10,
        'rear_setback_ft': 20,
        'allowed_uses': ['single_family', 'accessory_dwelling']
    },
    'SRA': {  # Single Residence A
        'name': 'Single Residence A',
        'min_lot_size_sqft': 15000,  # Typically larger than SRB
        'min_frontage_ft': 125,
        'max_lot_coverage_pct': 20,
        'min_open_space_pct': 40,
        'front_setback_ft': 35,
        'side_setback_ft': 15,
        'rear_setback_ft': 25,
        'allowed_uses': ['single_family', 'accessory_dwelling']
    },
    'GRA': {  # General Residence A
        'name': 'General Residence A',
        'min_lot_size_sqft': 5000,
        'min_frontage_ft': 50,
        'max_lot_coverage_pct': 50,
        'min_open_space_pct': 20,
        'front_setback_ft': 20,
        'side_setback_ft': 10,
        'rear_setback_ft': 20,
        'allowed_uses': ['single_family', 'two_family', 'multi_family', 'accessory_dwelling']
    },
    'M': {  # Municipal
        'name': 'Municipal',
        'min_lot_size_sqft': None,  # Varies
        'min_frontage_ft': None,
        'max_lot_coverage_pct': None,
        'min_open_space_pct': None,
        'front_setback_ft': None,
        'side_setback_ft': None,
        'rear_setback_ft': None,
        'allowed_uses': ['municipal', 'public']
    },
    'R': {  # Residential
        'name': 'Residential',
        'min_lot_size_sqft': 10000,
        'min_frontage_ft': 100,
        'max_lot_coverage_pct': 30,
        'min_open_space_pct': 30,
        'front_setback_ft': 30,
        'side_setback_ft': 15,
        'rear_setback_ft': 25,
        'allowed_uses': ['single_family', 'accessory_dwelling']
    },
    'G1': {  # General Business 1
        'name': 'General Business 1',
        'min_lot_size_sqft': 5000,
        'min_frontage_ft': 50,
        'max_lot_coverage_pct': 70,
        'min_open_space_pct': 10,
        'front_setback_ft': 10,
        'side_setback_ft': 0,
        'rear_setback_ft': 10,
        'allowed_uses': ['commercial', 'retail', 'office', 'mixed_use']
    },
    'NRP': {  # Natural Resource Protection
        'name': 'Natural Resource Protection',
        'min_lot_size_sqft': 43560,  # 1 acre
        'min_frontage_ft': 150,
        'max_lot_coverage_pct': 10,
        'min_open_space_pct': 70,
        'front_setback_ft': 50,
        'side_setback_ft': 25,
        'rear_setback_ft': 50,
        'allowed_uses': ['conservation', 'agriculture', 'single_family']
    }
}

# Land use type classification
LAND_USE_CLASSIFICATIONS = {
    'SINGLE FAM': 'single_family',
    'TWO FAM': 'two_family',
    'MULTI FAM': 'multi_family',
    'CONDO': 'multi_family',
    'APARTMENT': 'multi_family',
    'COMMERCIAL': 'commercial',
    'RETAIL': 'retail',
    'OFFICE': 'office',
    'INDUSTRIAL': 'industrial',
    'MUNICIPAL': 'municipal',
    'VACANT': 'vacant',
    'MIXED USE': 'mixed_use'
}

def classify_land_use(land_use_desc: str) -> str:
    """Classify land use description into standard categories."""
    if not land_use_desc:
        return 'unknown'

    land_use_upper = land_use_desc.upper()
    for key, value in LAND_USE_CLASSIFICATIONS.items():
        if key in land_use_upper:
            return value
    return 'other'


def get_zone_rules(zone_code: str) -> dict:
    """Get zoning rules for a given zone code."""
    return ZONING_RULES.get(zone_code, {})
