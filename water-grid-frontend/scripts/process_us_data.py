import pandas as pd
import json
import os
import random

# 1. Read the CSV from the current 'scripts' folder
df = pd.read_csv("im3_open_source_data_center_atlas.csv")

# 2. Drop rows missing coordinates
df = df.dropna(subset=['lat', 'lon'])

# 3. Convert to Mapbox-ready GeoJSON
geojson = {
    "type": "FeatureCollection",
    "features": []
}

for index, row in df.iterrows():
    operator_name = row['operator'] if pd.notna(row['operator']) else "Private Data Center"
    facility_sqft = row['sqft'] if pd.notna(row['sqft']) else 0
    facility_name = row['name'] if pd.notna(row['name']) else operator_name
    state = row['state'] if pd.notna(row['state']) else "Unknown"
    county = row['county'] if pd.notna(row['county']) else ""
    dc_type = row['type'] if pd.notna(row['type']) else "building"

    # Simulate PicoClaw water yield based on facility size
    sqft_val = float(facility_sqft) if facility_sqft and facility_sqft != 0 else 10000
    water_yield = round(sqft_val * 0.004 * random.uniform(0.8, 1.2), 1)
    load_kw = round(sqft_val * 0.05 * random.uniform(0.7, 1.3), 1)

    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [row['lon'], row['lat']]
        },
        "properties": {
            "node_id": f"dc_{row['id']}",
            "operator": operator_name,
            "name": facility_name,
            "sqft": facility_sqft,
            "state": state,
            "county": county,
            "type": dc_type,
            "status": "active",
            "current_load_kw": load_kw,
            "water_generated_liters": water_yield
        }
    }
    geojson["features"].append(feature)

# 4. Save to public folder
output_path = os.path.join("..", "public", "us_data_centers.geojson")

with open(output_path, "w") as f:
    json.dump(geojson, f, indent=2)

print(f"Success! Extracted {len(df)} US data center nodes and saved to {output_path}")
