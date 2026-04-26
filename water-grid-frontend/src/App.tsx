import { useState, useRef, useCallback, useEffect } from "react";
import Map, { Source, Layer, Popup } from "react-map-gl/mapbox";
import type { MapRef } from "react-map-gl/mapbox";
import { MapSearchBar } from "./components/MapSearchBar";
import type {
  ViewStateChangeEvent,
  MapMouseEvent,
  LayerProps,
} from "react-map-gl/mapbox";

// Ensure Mapbox CSS is loaded
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

// --- LAYER DEFINITIONS (defined outside component to avoid re-renders) ---

// Clustered bubble
const clusterLayer: LayerProps = {
  id: "clusters",
  type: "circle",
  source: "us-data-centers",
  filter: ["has", "point_count"],
  paint: {
    "circle-color": [
      "step",
      ["get", "point_count"],
      "#00ffcc",
      10,
      "#f1c40f",
      50,
      "#e74c3c",
    ],
    "circle-radius": ["step", ["get", "point_count"], 18, 10, 26, 50, 34],
    "circle-opacity": 0.85,
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#fff",
  },
};

// Count label inside cluster bubble
const clusterCountLayer: LayerProps = {
  id: "cluster-count",
  type: "symbol",
  source: "us-data-centers",
  filter: ["has", "point_count"],
  layout: {
    "text-field": "{point_count_abbreviated}",
    "text-font": ["DIN Offc Pro Medium", "Arial Unicode MS Bold"],
    "text-size": 13,
  },
  paint: { "text-color": "#000" },
};

// Individual unclustered point
const dataCenterLayer: LayerProps = {
  id: "data-center-points",
  type: "circle",
  source: "us-data-centers",
  filter: ["!", ["has", "point_count"]],
  paint: {
    "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 15, 14],
    "circle-color": "#00ffcc",
    "circle-opacity": 0.9,
    "circle-stroke-width": 1,
    "circle-stroke-color": "#ffffff",
  },
};

interface SelectedNode {
  longitude: number;
  latitude: number;
  properties: {
    operator: string;
    node_id: string;
    sqft: string | number;
    water_generated_liters: number;
    [key: string]: unknown;
  };
}

function App() {
  const [showMap, setShowMap] = useState(() => window.location.hash === "#map");

  useEffect(() => {
    const handleHashChange = () => setShowMap(window.location.hash === "#map");
    window.addEventListener("hashchange", handleHashChange);
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  // 1. Mapbox State
  const mapRef = useRef<MapRef>(null);
  const [viewState, setViewState] = useState({
    longitude: -98.5,
    latitude: 39.5,
    zoom: 4,
    pitch: 0,
    bearing: 0,
  });

  // 2. Telemetry and Simulation State
  const [selectedNode, setSelectedNode] = useState<SelectedNode | null>(null);
  const [systemLoad, setSystemLoad] = useState<number>(0);
  const [showRetrofit, setShowRetrofit] = useState<boolean>(false);

  const handleSearchSelect = useCallback((lng: number, lat: number) => {
    mapRef.current?.flyTo({
      center: [lng, lat],
      zoom: 11,
      pitch: 45,
      duration: 2000,
    });
  }, []);

  // --- PHYSICS ENGINE: Calculate Live Water Yield ---
  let calculatedYield = 0;
  let currentPowerKW = 0;

  if (selectedNode) {
    const sqftRaw = String(selectedNode.properties.sqft || "10000").replace(
      /,/g,
      "",
    );
    const sqftNum = Number(sqftRaw) || 10000;
    const maxPowerKW = (sqftNum * 150) / 1000;
    currentPowerKW = maxPowerKW * (systemLoad / 100);
    calculatedYield = Math.floor(currentPowerKW * 1.59 * 0.5);
  }

  // --- SATELLITE VIEW: Mapbox Static Images API ---
  let satelliteUrl: string | null = null;
  let thermalFilter = "none";
  if (selectedNode) {
    const { longitude: lng, latitude: lat } = selectedNode;
    satelliteUrl =
      `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/` +
      `${lng},${lat},17,0/600x400@2x?access_token=${MAPBOX_TOKEN}`;
    if (systemLoad > 80)
      thermalFilter = "sepia(1) saturate(3) hue-rotate(-20deg)";
    else if (systemLoad > 50)
      thermalFilter = "sepia(0.6) saturate(2) hue-rotate(10deg)";
  }

  if (!showMap) {
    return (
      <main className="landing-screen">
        <section className="landing-card" aria-labelledby="landing-title">
          <h1 id="landing-title">Drip is not available in the cloud</h1>
          <a
            className="landing-map-button"
            href="#map"
            onClick={() => setShowMap(true)}
          >
            But it could be
          </a>
        </section>
      </main>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        margin: 0,
        padding: 0,
        overflow: "hidden",
      }}
    >
      {/* LEFT SIDE: The Compute-to-Water Map */}
      <div style={{ flex: 1, position: "relative" }}>
        <MapSearchBar
          accessToken={MAPBOX_TOKEN}
          onLocationSelect={handleSearchSelect}
        />
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(evt: ViewStateChangeEvent) => setViewState(evt.viewState)}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          mapboxAccessToken={MAPBOX_TOKEN}
          interactiveLayerIds={["data-center-points", "clusters"]}
          onClick={(evt: MapMouseEvent) => {
            if (evt.features && evt.features.length > 0) {
              const feature = evt.features[0];
              if (!feature.properties) return;
              // If clicking a cluster, zoom into it
              if (feature.properties.cluster_id) {
                mapRef.current?.flyTo({
                  center: [evt.lngLat.lng, evt.lngLat.lat],
                  zoom: (mapRef.current.getZoom() ?? 4) + 3,
                  duration: 800,
                });
                return;
              }
              // Individual node: fly to with 3D pitch
              mapRef.current?.flyTo({
                center: [evt.lngLat.lng, evt.lngLat.lat],
                zoom: Math.max(mapRef.current.getZoom() ?? 10, 12),
                pitch: 45,
                duration: 600,
              });
              setSelectedNode({
                longitude: evt.lngLat.lng,
                latitude: evt.lngLat.lat,
                properties: feature.properties as SelectedNode["properties"],
              });
            } else {
              setSelectedNode(null);
            }
          }}
          cursor={selectedNode ? "pointer" : "grab"}
        >
          <Source
            id="us-data-centers"
            type="geojson"
            data="/us_data_centers.geojson"
            cluster={true}
            clusterMaxZoom={12}
            clusterRadius={50}
            generateId={true}
          >
            <Layer {...clusterLayer} />
            <Layer {...clusterCountLayer} />
            <Layer {...dataCenterLayer} />
          </Source>

          {selectedNode && (
            <Popup
              longitude={selectedNode.longitude}
              latitude={selectedNode.latitude}
              anchor="bottom"
              onClose={() => setSelectedNode(null)}
              closeOnClick={false}
              style={{ color: "#000" }}
            >
              <div style={{ padding: "5px" }}>
                <h3 style={{ margin: "0 0 5px 0" }}>
                  {selectedNode.properties.operator}
                </h3>
                <p style={{ margin: 0 }}>
                  <strong>ID:</strong> {selectedNode.properties.node_id}
                </p>
                <p style={{ margin: 0 }}>
                  <strong>Size:</strong> {selectedNode.properties.sqft} sqft
                </p>
                <hr style={{ margin: "8px 0" }} />
                <p
                  style={{
                    margin: 0,
                    color: "#0077cc",
                    fontWeight: "bold",
                    fontSize: "1.1rem",
                  }}
                >
                  Water Yield: {calculatedYield.toLocaleString()} L/hr
                </p>
                <p
                  style={{
                    margin: "3px 0 0 0",
                    color: "#ffaa00",
                    fontSize: "0.85rem",
                  }}
                >
                  Active Power: {Math.floor(currentPowerKW).toLocaleString()} kW
                </p>
              </div>
            </Popup>
          )}
        </Map>

        {/* Zoom Controls */}
        <div
          style={{
            position: "absolute",
            bottom: "24px",
            right: "16px",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            gap: "4px",
          }}
        >
          {[
            { label: "+", delta: 1 },
            { label: "−", delta: -1 },
          ].map(({ label, delta }) => (
            <button
              key={label}
              onClick={() => {
                const current = mapRef.current?.getZoom() ?? 4;
                mapRef.current?.easeTo({
                  zoom: current + delta,
                  duration: 250,
                });
              }}
              style={{
                width: "36px",
                height: "36px",
                backgroundColor: "#1a1a1a",
                color: "#ffffff",
                border: "1px solid #444",
                borderRadius: "6px",
                fontSize: "20px",
                lineHeight: 1,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                transition: "border-color 0.2s, color 0.2s",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "#00ffcc";
                (e.currentTarget as HTMLButtonElement).style.color = "#00ffcc";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLButtonElement).style.borderColor =
                  "#444";
                (e.currentTarget as HTMLButtonElement).style.color = "#ffffff";
              }}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: Cloudinary Telemetry Panel */}
      <div
        style={{
          width: "400px",
          backgroundColor: "#111",
          color: "#fff",
          padding: "20px",
          borderLeft: "1px solid #333",
          display: "flex",
          flexDirection: "column",
          gap: "20px",
          overflowY: "auto",
        }}
      >
        <div>
          <h2 style={{ margin: "0 0 10px 0", fontSize: "1.5rem" }}>
            {selectedNode ? selectedNode.properties.node_id : "Drip Simulation"}
          </h2>
          <p style={{ margin: 0, color: "#aaa", fontSize: "0.9rem" }}>
            {selectedNode
              ? `Targeting facility: ${selectedNode.properties.operator}`
              : "Select a node on the map to view telemetry."}
          </p>
        </div>

        {/* Simulation Controls */}
        <div
          style={{
            backgroundColor: "#1a1a1a",
            padding: "15px",
            borderRadius: "8px",
            border: "1px solid #333",
          }}
        >
          <h3
            style={{
              margin: "0 0 10px 0",
              fontSize: "1.1rem",
              color: "#00ffcc",
            }}
          >
            Grid Simulation
          </h3>
          <label
            style={{
              display: "block",
              marginBottom: "10px",
              fontSize: "0.9rem",
            }}
          >
            AI Compute Load: {systemLoad}%
            <input
              type="range"
              min="0"
              max="100"
              value={systemLoad}
              onChange={(e) => setSystemLoad(Number(e.target.value))}
              style={{ width: "100%", marginTop: "5px" }}
            />
          </label>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              fontSize: "0.9rem",
              cursor: "pointer",
            }}
          >
            <input
              type="checkbox"
              checked={showRetrofit}
              onChange={(e) => setShowRetrofit(e.target.checked)}
            />
            Simulate Facility Retrofit (GenAI)
          </label>
        </div>

        {/* Satellite View */}
        <div
          style={{
            backgroundColor: "#222",
            padding: "15px",
            borderRadius: "8px",
          }}
        >
          <h3 style={{ margin: "0 0 10px 0", fontSize: "1.1rem" }}>
            Satellite Intelligence View
          </h3>
          <div
            style={{
              position: "relative",
              borderRadius: "6px",
              overflow: "hidden",
              border: "1px solid #444",
              minHeight: "200px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: "#1a1a1a",
            }}
          >
            {satelliteUrl ? (
              <>
                <img
                  src={satelliteUrl}
                  alt={`Satellite view of ${selectedNode?.properties.operator}`}
                  style={{
                    width: "100%",
                    display: "block",
                    filter: thermalFilter,
                    transition: "filter 0.4s ease",
                  }}
                />
                {/* HUD overlay */}
                <div
                  style={{
                    position: "absolute",
                    bottom: 8,
                    left: 8,
                    backgroundColor: "rgba(0,0,0,0.73)",
                    color: "#00ffcc",
                    fontFamily: "Courier New, monospace",
                    fontSize: "12px",
                    fontWeight: "bold",
                    padding: "3px 7px",
                    borderRadius: "3px",
                    letterSpacing: "0.05em",
                    pointerEvents: "none",
                  }}
                >
                  NODE: {selectedNode?.properties.node_id} | YIELD:{" "}
                  {calculatedYield.toLocaleString()} L/HR
                </div>
              </>
            ) : (
              <p
                style={{
                  color: "#555",
                  fontSize: "0.85rem",
                  textAlign: "center",
                  padding: "20px",
                }}
              >
                Click a node on the map to load satellite imagery
              </p>
            )}
          </div>
          {selectedNode && (
            <div
              style={{
                marginTop: "10px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  padding: "8px",
                  borderRadius: "6px",
                }}
              >
                <div style={{ color: "#888", fontSize: "0.75rem" }}>
                  WATER YIELD
                </div>
                <div
                  style={{
                    color: "#00ffcc",
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                  }}
                >
                  {calculatedYield.toLocaleString()} L/hr
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  padding: "8px",
                  borderRadius: "6px",
                }}
              >
                <div style={{ color: "#888", fontSize: "0.75rem" }}>
                  ACTIVE POWER
                </div>
                <div
                  style={{
                    color: "#ffaa00",
                    fontSize: "1.1rem",
                    fontWeight: "bold",
                  }}
                >
                  {Math.floor(currentPowerKW).toLocaleString()} kW
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  padding: "8px",
                  borderRadius: "6px",
                }}
              >
                <div style={{ color: "#888", fontSize: "0.75rem" }}>
                  FACILITY SIZE
                </div>
                <div style={{ color: "#fff", fontSize: "1rem" }}>
                  {Number(selectedNode.properties.sqft).toLocaleString()} sqft
                </div>
              </div>
              <div
                style={{
                  backgroundColor: "#1a1a1a",
                  padding: "8px",
                  borderRadius: "6px",
                }}
              >
                <div style={{ color: "#888", fontSize: "0.75rem" }}>STATE</div>
                <div style={{ color: "#fff", fontSize: "1rem" }}>
                  {String(selectedNode.properties.state ?? "N/A")}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
