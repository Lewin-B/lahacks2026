import { useState } from 'react';
import Map from 'react-map-gl';

// Ensure you have your token in a .env file as VITE_MAPBOX_TOKEN=your_token_here
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

export default function WaterGridMap() {
  const [viewState, setViewState] = useState({
    longitude: -118.2437, // Los Angeles Longitude
    latitude: 34.0522,    // Los Angeles Latitude
    zoom: 10,
    pitch: 45,            // Adds a cool 3D tilt
    bearing: 0
  });

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Map
        {...viewState}
        onMove={evt => setViewState(evt.viewState)}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
      >
        {/* Later, you will map through your GeoJSON data here to place Markers */}
      </Map>
    </div>
  );
}