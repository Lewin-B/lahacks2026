import requests
import json
import os

# 1. Define the Overpass API Endpoint and our LA Bounding Box
# Using the Kumi Systems mirror to avoid rate limits
OVERPASS_URL = "https://overpass.kumi.systems/api/interpreter"
BBOX = "33.7,-118.6,34.3,-118.1"

print("Fetching live infrastructure data for Los Angeles...")

# 2. The Query (Targeting ONLY High-Density Compute/Data Centers)
query = f"""
[out:json][timeout:25];
(
  node["telecom"="data_center"]({BBOX});
  way["telecom"="data_center"]({BBOX});
  node["telecom"="exchange"]({BBOX});
  way["telecom"="exchange"]({BBOX});
  node["industrial"="data_center"]({BBOX});
  way["industrial"="data_center"]({BBOX});
);
out center;
"""

# 3. Add the User-Agent header (Crucial for bypassing the Overpass bot-blocker)
headers = {
    "User-Agent": "PicoClaw_WaterGrid_Hackathon_Project/1.0 (USF_Research)"
}

# 4. Make the Request
response = requests.post(OVERPASS_URL, data={'data': query}, headers=headers)

# Safety Check: Did the server actually give us data?
if response.status_code != 200:
    print(f"❌ Error {response.status_code}: The Overpass API rejected the request.")
    print(f"Server Message: {response.text}")
    exit()

data = response.json()
elements = data.get('elements', [])
print(f"✅ Found {len(elements)} high-density compute nodes!")

# 5. Format into our exact Mapbox GeoJSON Structure
geojson = {
    "type": "FeatureCollection",
    "features": []
}

for index, element in enumerate(elements):
    lat = element.get('lat') or element.get('center', {}).get('lat')
    lon = element.get('lon') or element.get('center', {}).get('lon')
    
    if not lat or not lon:
        continue

    # Extract tags for our UI Popups, providing sleek fallback names
    tags = element.get('tags', {})
    operator = tags.get('operator', tags.get('name', 'Tier-3 Edge Facility'))
    
    # Make the square footage estimates realistic for the new targets
    if tags.get('telecom') == 'exchange':
        sqft_estimate = "85,000" # Carrier hotels are massive
    elif tags.get('industrial') == 'data_center':
        sqft_estimate = "120,000" # Enterprise scale
    else:
        sqft_estimate = "45,000" # Standard data center

    feature = {
        "type": "Feature",
        "geometry": {
            "type": "Point",
            "coordinates": [lon, lat] # Mapbox requires [Longitude, Latitude]
        },
        "properties": {
            "node_id": f"pico_node_{index}",
            "operator": operator.title(),
            "sqft": sqft_estimate,
            "status": "offline",
            "current_load_kw": 0,
            "water_generated_liters": 0
        }
    }
    geojson["features"].append(feature)

# 6. Save it directly to the React 'public' folder
output_path = os.path.join("..", "public", "la_data_centers.geojson")

with open(output_path, "w") as f:
    json.dump(geojson, f, indent=2)

print(f"🚀 Success! GeoJSON updated at {output_path}. Check your map!")