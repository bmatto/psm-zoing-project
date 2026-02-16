"""
Portsmouth NH Zoning Rules - CORRECTED
Based on Portsmouth Zoning Ordinance (as amended through May 5, 2025)
Source: https://files.portsmouthnh.gov/files/planning/ZoningOrd-250505+ADOPTED.pdf
Tables 10.521 (Residential) and 10.531 (Business/Industrial)
"""

ZONING_RULES = {
    'R': {  # Residential (Rural)
        'name': 'Residential',
        'min_lot_size_sqft': 217800,  # 5 acres
        'min_frontage_ft': None,  # NA
        'max_lot_coverage_pct': 5,
        'min_open_space_pct': 75,
        'front_setback_ft': 50,
        'side_setback_ft': 20,
        'rear_setback_ft': 40,
        'allowed_uses': ['single_family', 'accessory_dwelling']
    },
    'SRA': {  # Single Residence A
        'name': 'Single Residence A',
        'min_lot_size_sqft': 43560,  # 1 acre (CORRECTED from 15,000)
        'min_frontage_ft': 150,  # CORRECTED from 125
        'max_lot_coverage_pct': 10,  # CORRECTED from 20
        'min_open_space_pct': 50,  # CORRECTED from 40
        'front_setback_ft': 30,  # CORRECTED from 35
        'side_setback_ft': 20,  # CORRECTED from 15
        'rear_setback_ft': 40,  # CORRECTED from 25
        'allowed_uses': ['single_family', 'accessory_dwelling']
    },
    'SRB': {  # Single Residence B
        'name': 'Single Residence B',
        'min_lot_size_sqft': 15000,  # CORRECTED from 7,500!
        'min_frontage_ft': 100,
        'max_lot_coverage_pct': 20,  # CORRECTED from 25
        'min_open_space_pct': 40,  # CORRECTED from 30
        'front_setback_ft': 30,
        'side_setback_ft': 10,
        'rear_setback_ft': 30,  # CORRECTED from 20
        'allowed_uses': ['single_family', 'accessory_dwelling']
    },
    'GRA': {  # General Residence A
        'name': 'General Residence A',
        'min_lot_size_sqft': 7500,  # CORRECTED from 5,000
        'min_frontage_ft': 100,  # CORRECTED from 50
        'max_lot_coverage_pct': 25,  # CORRECTED from 50
        'min_open_space_pct': 30,  # CORRECTED from 20
        'front_setback_ft': 15,  # CORRECTED from 20
        'side_setback_ft': 10,
        'rear_setback_ft': 20,
        'allowed_uses': ['single_family', 'two_family', 'multi_family', 'accessory_dwelling']
    },
    'GRB': {  # General Residence B
        'name': 'General Residence B',
        'min_lot_size_sqft': 5000,
        'min_frontage_ft': 80,
        'max_lot_coverage_pct': 30,
        'min_open_space_pct': 25,
        'front_setback_ft': 5,
        'side_setback_ft': 10,
        'rear_setback_ft': 25,
        'allowed_uses': ['single_family', 'two_family', 'multi_family', 'accessory_dwelling']
    },
    'GRC': {  # General Residence C
        'name': 'General Residence C',
        'min_lot_size_sqft': 3500,
        'min_frontage_ft': 70,
        'max_lot_coverage_pct': 35,
        'min_open_space_pct': 20,
        'front_setback_ft': 5,
        'side_setback_ft': 10,
        'rear_setback_ft': 20,
        'allowed_uses': ['single_family', 'two_family', 'multi_family', 'accessory_dwelling']
    },
    'MRO': {  # Mixed Residential Office
        'name': 'Mixed Residential Office',
        'min_lot_size_sqft': 7500,
        'min_frontage_ft': 100,
        'max_lot_coverage_pct': 40,
        'min_open_space_pct': 25,
        'front_setback_ft': 5,
        'side_setback_ft': 10,
        'rear_setback_ft': 15,
        'allowed_uses': ['single_family', 'two_family', 'multi_family', 'office', 'mixed_use']
    },
    'MRB': {  # Mixed Residential Business
        'name': 'Mixed Residential Business',
        'min_lot_size_sqft': 7500,
        'min_frontage_ft': 100,
        'max_lot_coverage_pct': 40,
        'min_open_space_pct': 25,
        'front_setback_ft': 5,
        'side_setback_ft': 10,
        'rear_setback_ft': 15,
        'allowed_uses': ['single_family', 'two_family', 'multi_family', 'commercial', 'mixed_use']
    },
    'GA/MH': {  # Garden Apartment/Mobile Home Park
        'name': 'Garden Apartment/Mobile Home Park',
        'min_lot_size_sqft': 217800,  # 5 acres
        'min_frontage_ft': None,
        'max_lot_coverage_pct': 20,
        'min_open_space_pct': 50,
        'front_setback_ft': 30,
        'side_setback_ft': 25,
        'rear_setback_ft': 25,
        'allowed_uses': ['multi_family', 'mobile_home']
    },
    'B': {  # Business
        'name': 'Business',
        'min_lot_size_sqft': 20000,
        'min_frontage_ft': 100,
        'max_lot_coverage_pct': 35,
        'min_open_space_pct': 15,
        'front_setback_ft': 20,
        'side_setback_ft': 15,
        'rear_setback_ft': 15,
        'allowed_uses': ['commercial', 'retail', 'office', 'mixed_use']
    },
    'GB': {  # General Business
        'name': 'General Business',
        'min_lot_size_sqft': 43560,  # 1 acre
        'min_frontage_ft': 200,
        'max_lot_coverage_pct': 30,
        'min_open_space_pct': 20,
        'front_setback_ft': 30,
        'side_setback_ft': 30,
        'rear_setback_ft': 50,
        'allowed_uses': ['commercial', 'retail', 'office', 'mixed_use']
    },
    'G1': {  # General Business 1 (using GB values as approximation)
        'name': 'General Business 1',
        'min_lot_size_sqft': 43560,  # CORRECTED from 5,000
        'min_frontage_ft': 200,  # CORRECTED from 50
        'max_lot_coverage_pct': 30,  # CORRECTED from 70
        'min_open_space_pct': 20,  # CORRECTED from 10
        'front_setback_ft': 30,  # CORRECTED from 10
        'side_setback_ft': 30,  # CORRECTED from 0
        'rear_setback_ft': 50,  # CORRECTED from 10
        'allowed_uses': ['commercial', 'retail', 'office', 'mixed_use']
    },
    'G2': {  # General Business 2 (similar to GB)
        'name': 'General Business 2',
        'min_lot_size_sqft': 43560,
        'min_frontage_ft': 200,
        'max_lot_coverage_pct': 30,
        'min_open_space_pct': 20,
        'front_setback_ft': 30,
        'side_setback_ft': 30,
        'rear_setback_ft': 50,
        'allowed_uses': ['commercial', 'retail', 'office', 'mixed_use']
    },
    'WB': {  # Waterfront Business
        'name': 'Waterfront Business',
        'min_lot_size_sqft': 20000,
        'min_frontage_ft': 100,
        'max_lot_coverage_pct': 30,
        'min_open_space_pct': 20,
        'front_setback_ft': 30,
        'side_setback_ft': 30,
        'rear_setback_ft': 20,
        'allowed_uses': ['commercial', 'retail', 'office', 'marine']
    },
    'I': {  # Industrial
        'name': 'Industrial',
        'min_lot_size_sqft': 87120,  # 2 acres
        'min_frontage_ft': 200,
        'max_lot_coverage_pct': 50,
        'min_open_space_pct': 20,
        'front_setback_ft': 70,
        'side_setback_ft': 50,
        'rear_setback_ft': 50,
        'allowed_uses': ['industrial', 'manufacturing']
    },
    'WI': {  # Waterfront Industrial
        'name': 'Waterfront Industrial',
        'min_lot_size_sqft': 87120,  # 2 acres
        'min_frontage_ft': 200,
        'max_lot_coverage_pct': 50,
        'min_open_space_pct': 20,
        'front_setback_ft': 70,
        'side_setback_ft': 50,
        'rear_setback_ft': 50,
        'allowed_uses': ['industrial', 'manufacturing', 'marine']
    },
    'OR': {  # Office Research
        'name': 'Office Research',
        'min_lot_size_sqft': 130680,  # 3 acres
        'min_frontage_ft': 300,
        'max_lot_coverage_pct': 30,
        'min_open_space_pct': 30,
        'front_setback_ft': 50,
        'side_setback_ft': 75,
        'rear_setback_ft': 50,
        'allowed_uses': ['office', 'research', 'technology']
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
    'NRP': {  # Natural Resource Protection - NOT in tables, needs research
        'name': 'Natural Resource Protection',
        'min_lot_size_sqft': 217800,  # Likely 5 acres minimum (conservative estimate)
        'min_frontage_ft': 150,
        'max_lot_coverage_pct': 10,  # Very low for conservation
        'min_open_space_pct': 70,  # Very high for conservation
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
