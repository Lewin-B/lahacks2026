import pandas as pd
import json
import os

# 1. Read the CSV from the current 'scripts' folder
df = pd.read_csv("im3_open_source_data_center_atlas.csv")

# 2. Filter by Los Angeles Bounding Box using 'lat' and 'lon'
la_data = df[
    (df['lat'] >= 33.7) & (df['lat'] <= 34.3) & 
    (df['lon'] >= -118.6) & (df['lon'] <= -118.1)
]

# 3. Convert to Mapbox-ready GeoJSON
geojson = {
    "type": "FeatureCollection",
    "features": []
}

for index, row in la_data.iterrows():
    # Safely handle missing text data for our UI popups
    operator_name = row['operator'] if pd.notna(row['operator']) else "Private Data Center"
    facility_sqft = row['sqft'] if pd.notna(row['sqft']) else "Undisclosed"

    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [row['lon'], row['lat']] # Mapbox strictly requires [Lng, Lat]
        },
        "properties": {
            "node_id": f"dc_node_{index}",
            "operator": operator_name,
            "sqft": facility_sqft,
            "status": "offline", # Default state before PicoClaw takes over
            "current_load_kw": 0,
            "water_generated_liters": 0
        }
    }
    geojson["features"].append(feature)

# 4. Save directly to the React 'public' folder
output_path = os.path.join("..", "public", "la_data_centers.geojson")

with open(output_path, "w") as f:
    json.dump(geojson, f, indent=2)

print(f"Success! Extracted {len(la_data)} nodes and saved to {output_path}")