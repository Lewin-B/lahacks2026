# Drip: 24-Hour Implementation Plan

**Goal**: Build a functional circular-economy data center with thermal monitoring, distributed architecture, and agent deployment UI.

**Team Split**:
- **Backend (You)**: Pi 5, ASUS GX10, telemetry, networking, APIs
- **Frontend (Teammate)**: Next.js dashboard for agent deployment and monitoring

## Key Architectural Decisions

### Telemetry Strategy: WebSocket + Minimal DB
**Decision**: Use WebSockets for real-time telemetry streaming instead of MongoDB writes.

**Rationale**:
- Temperature readings every 5 seconds = 17,280 potential DB writes/day
- WebSocket provides lower latency and better real-time experience
- MongoDB used only for: agent registry + accumulated metrics (water produced, inferences run, uptime)
- In-memory circular buffer keeps last 100 readings (~10 min) for charts

**Benefits**:
- Simple and fast for hackathon timeline
- No DB bottleneck or cost concerns
- Still shows impressive cumulative impact ("250g of water produced!")
- Real-time updates with minimal infrastructure

**Architecture**:
- **Thermal Factory**: Pi 5 (water-cooled, runs PicoClaw containers, thermal telemetry via WebSocket)
- **Intelligence Hub**: ASUS GX10 (vLLM serving Gemma 4, FastAPI proxy, WebSocket server)
- **Networking**: Tailscale private mesh + ngrok public tunnels
- **Inference**: Hybrid (Drip Hub vLLM + external APIs)
- **Data Storage**:
  - **MongoDB Atlas**: Agent registry + accumulated metrics (total water, total inferences, uptime)
  - **WebSocket**: Real-time telemetry streaming (no DB writes)
  - **In-Memory**: Last 100 readings for live charts (~10 min history)

---

## Backend Workstream (You - 16-18 hours)

### Phase 1: ASUS GX10 Setup (4-5 hours)

**Priority 1A: FastAPI Monitoring/Proxy Server**

Create new directory: `asus-server/`

**File**: `asus-server/main.py`
```python
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Header
from pydantic import BaseModel
import httpx
import os
from datetime import datetime
from motor.motor_asyncio import AsyncIOMotorClient
import uvicorn
import asyncio
from collections import deque

app = FastAPI()

# MongoDB setup (for agent registry and metrics only)
MONGODB_URI = os.getenv("MONGODB_URI", "mongodb+srv://...")
mongo_client = AsyncIOMotorClient(MONGODB_URI)
db = mongo_client.drip
agents_collection = db.agents
metrics_collection = db.metrics

# vLLM endpoint
VLLM_URL = "http://localhost:8000/v1/chat/completions"

# In-memory state
telemetry_buffer = deque(maxlen=100)  # Last 100 readings for charts
active_websockets = []
accumulated_metrics = {
    "total_water_produced_g": 0.0,
    "total_inferences": 0,
    "start_time": datetime.utcnow()
}

class AgentInfo(BaseModel):
    agent_id: str
    container_name: str
    public_url: str
    inference_backend: str
    created_at: datetime

@app.websocket("/ws/telemetry")
async def websocket_telemetry(websocket: WebSocket):
    """WebSocket endpoint for streaming telemetry from Pi 5"""
    await websocket.accept()
    active_websockets.append(websocket)

    try:
        while True:
            data = await websocket.receive_json()

            # Add to buffer for charts
            telemetry_buffer.append(data)

            # Accumulate water production
            if "water_production_rate" in data:
                # Convert kg/hr to grams, divide by 720 (5 sec intervals in 1 hour)
                accumulated_metrics["total_water_produced_g"] += (data["water_production_rate"] * 1000) / 720

            # Broadcast to all connected frontend clients
            for ws in active_websockets:
                if ws != websocket:
                    try:
                        await ws.send_json(data)
                    except:
                        pass

    except WebSocketDisconnect:
        active_websockets.remove(websocket)

@app.post("/agents/register")
async def register_agent(agent: AgentInfo):
    """Register newly deployed agent"""
    await agents_collection.insert_one(agent.dict())
    return {"status": "registered"}

@app.get("/agents")
async def list_agents():
    """List all deployed agents"""
    agents = await agents_collection.find().to_list(100)
    return agents

@app.get("/telemetry/buffer")
async def get_telemetry_buffer():
    """Get recent telemetry from in-memory buffer"""
    return list(telemetry_buffer)

@app.get("/metrics")
async def get_metrics():
    """Get accumulated metrics"""
    uptime = (datetime.utcnow() - accumulated_metrics["start_time"]).total_seconds() / 3600
    return {
        "total_water_produced_g": round(accumulated_metrics["total_water_produced_g"], 2),
        "total_inferences": accumulated_metrics["total_inferences"],
        "uptime_hours": round(uptime, 2)
    }

@app.post("/inference/drip-hub")
async def drip_hub_inference(
    messages: list,
    x_drip_agent_id: str = Header(None)
):
    """Proxy to vLLM with agent attribution"""
    async with httpx.AsyncClient() as client:
        response = await client.post(
            VLLM_URL,
            json={
                "model": "google/gemma-2-9b-it",
                "messages": messages,
                "temperature": 0.7
            },
            headers={"X-Drip-Agent-ID": x_drip_agent_id},
            timeout=120.0
        )

        # Increment inference counter
        accumulated_metrics["total_inferences"] += 1

        return response.json()

# Background task to persist metrics every minute
async def persist_metrics_loop():
    while True:
        await asyncio.sleep(60)
        await metrics_collection.replace_one(
            {"_id": "global"},
            {**accumulated_metrics, "last_updated": datetime.utcnow()},
            upsert=True
        )

@app.on_event("startup")
async def startup():
    # Load metrics from DB if exists
    stored = await metrics_collection.find_one({"_id": "global"})
    if stored:
        accumulated_metrics.update({
            "total_water_produced_g": stored.get("total_water_produced_g", 0),
            "total_inferences": stored.get("total_inferences", 0),
            "start_time": stored.get("start_time", datetime.utcnow())
        })

    asyncio.create_task(persist_metrics_loop())

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
```

**File**: `asus-server/requirements.txt`
```
fastapi==0.115.0
uvicorn[standard]==0.32.0
motor==3.6.0
httpx==0.27.0
pydantic==2.9.0
websockets==13.1
```

**Setup Commands**:
```bash
cd asus-server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# Set MongoDB URI
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/drip"

# Run server
python main.py
```

**Priority 1B: vLLM Setup with Gemma 4**

```bash
# Install vLLM
pip install vllm

# Download and serve Gemma 2 (9B is more realistic for demo)
vllm serve google/gemma-2-9b-it \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --api-key drip-internal-key
```

**Note**: This runs on ASUS GX10 and is accessible via Tailscale IP from Pi 5.

---

### Phase 2: Pi 5 Thermal Telemetry (2-3 hours)

**Priority 2A: Thermal Monitor Script**

Create new directory: `pi-telemetry/`

**File**: `pi-telemetry/thermal_monitor.py`
```python
import subprocess
import asyncio
import os
from datetime import datetime
import websockets
import json

# ASUS server WebSocket endpoint (via Tailscale)
ASUS_WS_URL = os.getenv("ASUS_WS_URL", "ws://100.x.x.x:5000/ws/telemetry")  # Replace with actual Tailscale IP

def get_cpu_temp():
    """Get CPU temperature from vcgencmd"""
    result = subprocess.run(
        ["vcgencmd", "measure_temp"],
        capture_output=True,
        text=True
    )
    # Output format: "temp=52.0'C"
    temp_str = result.stdout.strip().split("=")[1].split("'")[0]
    return float(temp_str)

def calculate_water_vapor_pressure(temp_celsius):
    """
    Antoine Equation for water vapor pressure
    P = 10^(8.07131 - 1730.63/(233.426 + T))
    Returns pressure in mmHg
    """
    T = temp_celsius
    log_P = 8.07131 - (1730.63 / (233.426 + T))
    P = 10 ** log_P
    return P

def estimate_water_production_rate(hot_temp, cold_temp=25.0, membrane_coeff=0.01):
    """
    Simplified water production estimate
    J_w = C * (P_hot - P_cold)

    membrane_coeff is a tunable parameter (kg/hr/mmHg)
    Returns water production in kg/hr
    """
    P_hot = calculate_water_vapor_pressure(hot_temp)
    P_cold = calculate_water_vapor_pressure(cold_temp)
    J_w = membrane_coeff * (P_hot - P_cold)
    return max(0, J_w)

async def monitor_loop(agent_id="global", interval=5):
    """Continuously monitor and stream telemetry via WebSocket"""
    while True:
        try:
            async with websockets.connect(ASUS_WS_URL) as websocket:
                print(f"Connected to ASUS server at {ASUS_WS_URL}")

                while True:
                    temp = get_cpu_temp()
                    vapor_pressure = calculate_water_vapor_pressure(temp)
                    production_rate = estimate_water_production_rate(temp)

                    data = {
                        "agent_id": agent_id,
                        "cpu_temp": temp,
                        "timestamp": datetime.utcnow().isoformat(),
                        "water_vapor_pressure": vapor_pressure,
                        "water_production_rate": production_rate
                    }

                    print(f"[{datetime.now()}] Temp: {temp}°C | P: {vapor_pressure:.2f} mmHg | Water: {production_rate:.4f} kg/hr")

                    await websocket.send(json.dumps(data))
                    await asyncio.sleep(interval)

        except (websockets.exceptions.ConnectionClosed, ConnectionRefusedError) as e:
            print(f"Connection lost: {e}. Reconnecting in 5 seconds...")
            await asyncio.sleep(5)

if __name__ == "__main__":
    asyncio.run(monitor_loop())
```

**Setup on Pi 5**:
```bash
cd pi-telemetry
python3 -m venv venv
source venv/bin/activate
pip install websockets

# Set ASUS Tailscale WebSocket URL
export ASUS_WS_URL="ws://100.x.x.x:5000/ws/telemetry"

# Run in background
nohup python thermal_monitor.py &
```

---

### Phase 3: Enhanced Go Server (3-4 hours)

**Modifications needed in `server/main.go`**:

**Add new endpoints**:
```go
// After line 56 (after r.Post("/deploy", deployHandler))

r.Get("/agents", listAgentsHandler)
r.Get("/agents/{name}/status", agentStatusHandler)
r.Delete("/agents/{name}", deleteAgentHandler)
r.Post("/agents/{name}/notify-asus", notifyASUSHandler)
```

**Add handler functions** (add before `main` function):
```go
type agentStatusResponse struct {
	Running bool   `json:"running"`
	Status  string `json:"status"`
	Error   string `json:"error,omitempty"`
}

func listAgentsHandler(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer apiClient.Close()

	containers, err := apiClient.ContainerList(ctx, client.ContainerListOptions{
		All: true,
	})
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	// Filter for picoclaw containers
	var picoclawContainers []map[string]interface{}
	for _, container := range containers {
		for _, name := range container.Names {
			if strings.Contains(name, "picoclaw") {
				picoclawContainers = append(picoclawContainers, map[string]interface{}{
					"id":      container.ID,
					"name":    strings.TrimPrefix(name, "/"),
					"image":   container.Image,
					"status":  container.Status,
					"state":   container.State,
					"created": container.Created,
				})
			}
		}
	}

	writeJSON(w, http.StatusOK, map[string]interface{}{
		"agents": picoclawContainers,
	})
}

func agentStatusHandler(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	ctx := r.Context()

	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer apiClient.Close()

	inspect, err := apiClient.ContainerInspect(ctx, name, client.ContainerInspectOptions{})
	if err != nil {
		writeJSON(w, http.StatusOK, agentStatusResponse{
			Running: false,
			Status:  "not found",
			Error:   err.Error(),
		})
		return
	}

	writeJSON(w, http.StatusOK, agentStatusResponse{
		Running: inspect.State.Running,
		Status:  inspect.State.Status,
	})
}

func deleteAgentHandler(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")
	ctx := r.Context()

	apiClient, err := client.New(client.FromEnv)
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer apiClient.Close()

	_, err = apiClient.ContainerRemove(ctx, name, client.ContainerRemoveOptions{
		Force: true,
	})
	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{
		"status": "deleted",
		"name":   name,
	})
}

func writeErrorJSON(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}

// Update writeJSON to handle generic interface{}
func writeJSON(w http.ResponseWriter, status int, payload interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		log.Printf("write json response: %v", err)
	}
}
```

**Add ASUS notification** (notify ASUS when agent is deployed):
```go
func notifyASUSHandler(w http.ResponseWriter, r *http.Request) {
	name := chi.URLParam(r, "name")

	// Read request body for agent metadata
	var metadata struct {
		ContainerName    string `json:"container_name"`
		PublicURL        string `json:"public_url"`
		InferenceBackend string `json:"inference_backend"`
	}

	if err := json.NewDecoder(r.Body).Decode(&metadata); err != nil {
		writeErrorJSON(w, http.StatusBadRequest, err.Error())
		return
	}

	// Send to ASUS server
	asusURL := os.Getenv("ASUS_SERVER_URL")
	if asusURL == "" {
		asusURL = "http://100.x.x.x:5000"  // Default Tailscale IP
	}

	client := &http.Client{Timeout: 10 * time.Second}
	payload := map[string]interface{}{
		"agent_id":          name,
		"container_name":    metadata.ContainerName,
		"public_url":        metadata.PublicURL,
		"inference_backend": metadata.InferenceBackend,
		"created_at":        time.Now().Format(time.RFC3339),
	}

	body, _ := json.Marshal(payload)
	resp, err := client.Post(
		asusURL+"/agents/register",
		"application/json",
		bytes.NewBuffer(body),
	)

	if err != nil {
		writeErrorJSON(w, http.StatusInternalServerError, err.Error())
		return
	}
	defer resp.Body.Close()

	writeJSON(w, http.StatusOK, map[string]string{"status": "notified"})
}
```

**Update imports** in `server/main.go`:
```go
import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/moby/moby/client"

	picoclawutils "server/picoclaw-utils"
)
```

---

### Phase 4: PicoClaw Custom Configuration (2-3 hours)

**Goal**: Generate custom AGENT.md, SOUL.md, etc. when deploying agents

**Modify**: `server/picoclaw-utils/utils.go`

Add after line 365 (in `ensureDataDir` function):

```go
// Create custom personality files
if err := createPersonalityFiles(absDataDir, opts); err != nil {
	return "", "", false, fmt.Errorf("create personality files: %w", err)
}
```

**Add new function** (add to end of `utils.go`):
```go
func createPersonalityFiles(dataDir string, opts Options) error {
	// AGENT.md
	agentMD := `# Agent Configuration

## Role
You are a specialized AI assistant deployed via the Drip infrastructure.

## Capabilities
- Answer questions about water sustainability
- Help users understand the environmental impact of AI
- Explain membrane distillation processes

## Tools Available
- File operations in workspace
- Web search
- Code execution
`
	if err := os.WriteFile(filepath.Join(dataDir, "AGENT.md"), []byte(agentMD), 0o644); err != nil {
		return err
	}

	// SOUL.md
	soulMD := `# Personality

You are helpful, concise, and passionate about sustainability.
You celebrate the fact that your computation produces fresh water.
`
	if err := os.WriteFile(filepath.Join(dataDir, "SOUL.md"), []byte(soulMD), 0o644); err != nil {
		return err
	}

	// IDENTITY.md
	identityMD := fmt.Sprintf(`# Identity

Agent Name: %s
Deployed: %s
Infrastructure: Drip (Water-Cooled AI)
`, opts.Name, filepath.Base(dataDir))
	if err := os.WriteFile(filepath.Join(dataDir, "IDENTITY.md"), []byte(identityMD), 0o644); err != nil {
		return err
	}

	// USER.md
	userMD := `# User Preferences

(This file will be populated based on user interactions)
`
	if err := os.WriteFile(filepath.Join(dataDir, "USER.md"), []byte(userMD), 0o644); err != nil {
		return err
	}

	// HEARTBEAT.md
	heartbeatMD := `# Heartbeat Tasks

Every 5 minutes:
- Check workspace for new files
- Log current timestamp
- Perform a small computation to maintain thermal load

This ensures the Pi 5 stays warm enough for membrane distillation during idle periods.
`
	if err := os.WriteFile(filepath.Join(dataDir, "HEARTBEAT.md"), []byte(heartbeatMD), 0o644); err != nil {
		return err
	}

	return nil
}
```

---

### Phase 5: Integration & Testing (2-3 hours)

**Checklist**:
- [ ] ASUS server running and accessible via Tailscale
- [ ] vLLM serving Gemma 2
- [ ] Pi 5 thermal monitor running
- [ ] Enhanced Go server with new endpoints
- [ ] Test full flow: Deploy agent → Get ngrok URL → Check ASUS registration → View telemetry

**Test Commands**:
```bash
# Deploy agent (from Pi 5)
curl -X POST http://localhost:3000/deploy \
  -H "Content-Type: application/json" \
  -d '{
    "name": "test-agent-1",
    "mode": "gateway",
    "picoclaw_url": "",
    "replace": true
  }'

# List agents on Pi 5
curl http://localhost:3000/agents

# Check status
curl http://localhost:3000/agents/test-agent-1/status

# Get registered agents from ASUS
curl http://100.x.x.x:5000/agents

# Get telemetry buffer from ASUS
curl http://100.x.x.x:5000/telemetry/buffer

# Get accumulated metrics from ASUS
curl http://100.x.x.x:5000/metrics

# Test WebSocket (using wscat)
npm install -g wscat
wscat -c ws://100.x.x.x:5000/ws/telemetry
```

---

## Frontend Workstream (Teammate - 14-16 hours)

### Phase 1: Next.js Setup (1-2 hours)

```bash
cd map-client
npx create-next-app@latest . --typescript --tailwind --app --no-src-dir
npm install recharts lucide-react axios socket.io-client
```

### Phase 2: Core Pages & Layout (2-3 hours)

**File Structure**:
```
map-client/
├── app/
│   ├── layout.tsx          # Main layout
│   ├── page.tsx            # Dashboard home
│   ├── deploy/
│   │   └── page.tsx        # Agent deployment form
│   └── agents/
│       └── [id]/
│           └── page.tsx    # Individual agent view
├── components/
│   ├── AgentCard.tsx       # Agent display card
│   ├── ThermalGauge.tsx    # Temperature visualization
│   ├── WaterProductionChart.tsx
│   └── DeploymentForm.tsx
└── lib/
    ├── api.ts              # API client
    └── types.ts            # TypeScript types
```

**File**: `map-client/lib/types.ts`
```typescript
export interface Agent {
  agent_id: string;
  container_name: string;
  public_url: string;
  inference_backend: 'drip-hub' | 'external';
  created_at: string;
}

export interface TelemetryData {
  agent_id: string;
  cpu_temp: number;
  timestamp: string;
  water_vapor_pressure?: number;
  water_production_rate?: number;
}

export interface DeploymentRequest {
  name: string;
  mode: 'gateway' | 'launcher';
  picoclaw_url?: string;
  inference_backend: 'drip-hub' | 'external';
  replace?: boolean;
}
```

**File**: `map-client/lib/api.ts`
```typescript
import axios from 'axios';
import { Agent, TelemetryData, DeploymentRequest } from './types';

const PI_SERVER = process.env.NEXT_PUBLIC_PI_SERVER_URL || 'http://localhost:3000';
const ASUS_SERVER = process.env.NEXT_PUBLIC_ASUS_SERVER_URL || 'http://localhost:5000';
const ASUS_WS = process.env.NEXT_PUBLIC_ASUS_WS_URL || 'ws://localhost:5000/ws/telemetry';

export const api = {
  // Pi 5 API
  async deployAgent(data: DeploymentRequest) {
    const response = await axios.post(`${PI_SERVER}/deploy`, data);
    return response.data;
  },

  async listAgents() {
    const response = await axios.get(`${PI_SERVER}/agents`);
    return response.data.agents as Agent[];
  },

  async getAgentStatus(name: string) {
    const response = await axios.get(`${PI_SERVER}/agents/${name}/status`);
    return response.data;
  },

  async deleteAgent(name: string) {
    const response = await axios.delete(`${PI_SERVER}/agents/${name}`);
    return response.data;
  },

  // ASUS API
  async getRegisteredAgents() {
    const response = await axios.get(`${ASUS_SERVER}/agents`);
    return response.data as Agent[];
  },

  async getTelemetryBuffer() {
    const response = await axios.get(`${ASUS_SERVER}/telemetry/buffer`);
    return response.data as TelemetryData[];
  },

  async getMetrics() {
    const response = await axios.get(`${ASUS_SERVER}/metrics`);
    return response.data as {
      total_water_produced_g: number;
      total_inferences: number;
      uptime_hours: number;
    };
  },

  // WebSocket connection for real-time telemetry
  connectTelemetryWebSocket(onMessage: (data: TelemetryData) => void) {
    const ws = new WebSocket(ASUS_WS);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket closed, reconnecting...');
      setTimeout(() => this.connectTelemetryWebSocket(onMessage), 5000);
    };

    return ws;
  }
};
```

### Phase 3: Dashboard Components (3-4 hours)

**File**: `map-client/components/ThermalGauge.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';

interface ThermalGaugeProps {
  temperature: number;
  waterProduction: number;
}

export function ThermalGauge({ temperature, waterProduction }: ThermalGaugeProps) {
  const maxTemp = 100;
  const percentage = (temperature / maxTemp) * 100;

  const getColor = (temp: number) => {
    if (temp < 40) return 'bg-blue-500';
    if (temp < 60) return 'bg-green-500';
    if (temp < 75) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Thermal Status</h3>

      {/* Temperature Gauge */}
      <div className="mb-6">
        <div className="flex justify-between mb-2">
          <span className="text-sm text-gray-600">CPU Temperature</span>
          <span className="text-2xl font-bold">{temperature.toFixed(1)}°C</span>
        </div>
        <div className="w-full h-4 bg-gray-200 rounded-full overflow-hidden">
          <div
            className={`h-full ${getColor(temperature)} transition-all duration-500`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Water Production */}
      <div className="border-t pt-4">
        <div className="flex justify-between">
          <span className="text-sm text-gray-600">Water Production</span>
          <span className="text-xl font-semibold text-blue-600">
            {(waterProduction * 1000).toFixed(2)} g/hr
          </span>
        </div>
      </div>
    </div>
  );
}
```

**File**: `map-client/components/WaterProductionChart.tsx`
```typescript
'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface WaterProductionChartProps {
  data: Array<{
    timestamp: string;
    cpu_temp: number;
    water_production_rate: number;
  }>;
}

export function WaterProductionChart({ data }: WaterProductionChartProps) {
  const chartData = data.map(d => ({
    time: new Date(d.timestamp).toLocaleTimeString(),
    temp: d.cpu_temp,
    water: (d.water_production_rate * 1000).toFixed(2) // Convert to grams
  }));

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <h3 className="text-lg font-semibold mb-4">Water Production Over Time</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="time" />
          <YAxis yAxisId="left" label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Water (g/hr)', angle: 90, position: 'insideRight' }} />
          <Tooltip />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="temp" stroke="#ef4444" name="CPU Temp" />
          <Line yAxisId="right" type="monotone" dataKey="water" stroke="#3b82f6" name="Water Production" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
```

**File**: `map-client/components/AgentCard.tsx`
```typescript
'use client';

import { Trash2, ExternalLink } from 'lucide-react';

interface AgentCardProps {
  agent: {
    agent_id: string;
    container_name: string;
    public_url: string;
    inference_backend: string;
    created_at: string;
  };
  onDelete: (name: string) => void;
}

export function AgentCard({ agent, onDelete }: AgentCardProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-xl font-semibold">{agent.agent_id}</h3>
          <p className="text-sm text-gray-500">{agent.container_name}</p>
        </div>
        <button
          onClick={() => onDelete(agent.container_name)}
          className="text-red-500 hover:text-red-700"
        >
          <Trash2 size={20} />
        </button>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">Backend:</span>
          <span className={`px-2 py-1 rounded text-xs ${
            agent.inference_backend === 'drip-hub'
              ? 'bg-green-100 text-green-800'
              : 'bg-blue-100 text-blue-800'
          }`}>
            {agent.inference_backend}
          </span>
        </div>
        <div className="text-sm text-gray-600">
          Created: {new Date(agent.created_at).toLocaleString()}
        </div>
      </div>

      <a
        href={agent.public_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 text-blue-600 hover:text-blue-800"
      >
        <ExternalLink size={16} />
        Open Agent
      </a>
    </div>
  );
}
```

**File**: `map-client/components/DeploymentForm.tsx`
```typescript
'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

export function DeploymentForm({ onSuccess }: { onSuccess: () => void }) {
  const [name, setName] = useState('');
  const [backend, setBackend] = useState<'drip-hub' | 'external'>('drip-hub');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      await api.deployAgent({
        name,
        mode: 'gateway',
        inference_backend: backend,
        replace: true
      });
      onSuccess();
      setName('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6">
      <h2 className="text-2xl font-bold mb-6">Deploy New Agent</h2>

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-2">Agent Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
            placeholder="my-agent-1"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-2">Inference Backend</label>
          <select
            value={backend}
            onChange={(e) => setBackend(e.target.value as 'drip-hub' | 'external')}
            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="drip-hub">Drip Hub (Gemma 4 - Max Water Production)</option>
            <option value="external">External API (OpenAI/Anthropic)</option>
          </select>
        </div>

        {error && (
          <div className="bg-red-50 text-red-800 p-3 rounded">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
        >
          {loading ? 'Deploying...' : 'Deploy Agent'}
        </button>
      </div>
    </form>
  );
}
```

### Phase 4: Main Dashboard Page (2-3 hours)

**File**: `map-client/app/page.tsx`
```typescript
'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { ThermalGauge } from '@/components/ThermalGauge';
import { WaterProductionChart } from '@/components/WaterProductionChart';
import { AgentCard } from '@/components/AgentCard';
import { DeploymentForm } from '@/components/DeploymentForm';
import { TelemetryData } from '@/lib/types';

export default function Dashboard() {
  const [agents, setAgents] = useState([]);
  const [telemetryBuffer, setTelemetryBuffer] = useState<TelemetryData[]>([]);
  const [latestTemp, setLatestTemp] = useState(0);
  const [latestWater, setLatestWater] = useState(0);
  const [metrics, setMetrics] = useState({
    total_water_produced_g: 0,
    total_inferences: 0,
    uptime_hours: 0
  });

  const loadInitialData = async () => {
    try {
      const [agentsData, bufferData, metricsData] = await Promise.all([
        api.getRegisteredAgents(),
        api.getTelemetryBuffer(),
        api.getMetrics()
      ]);

      setAgents(agentsData);
      setTelemetryBuffer(bufferData);
      setMetrics(metricsData);

      if (bufferData.length > 0) {
        const latest = bufferData[bufferData.length - 1];
        setLatestTemp(latest.cpu_temp);
        setLatestWater(latest.water_production_rate || 0);
      }
    } catch (error) {
      console.error('Failed to load initial data:', error);
    }
  };

  useEffect(() => {
    loadInitialData();

    // Connect to WebSocket for real-time telemetry
    const ws = api.connectTelemetryWebSocket((data: TelemetryData) => {
      setLatestTemp(data.cpu_temp);
      setLatestWater(data.water_production_rate || 0);

      // Add to buffer (keep last 100)
      setTelemetryBuffer((prev) => {
        const updated = [...prev, data];
        return updated.slice(-100);
      });
    });

    // Refresh metrics and agents every 10 seconds
    const interval = setInterval(async () => {
      try {
        const [agentsData, metricsData] = await Promise.all([
          api.getRegisteredAgents(),
          api.getMetrics()
        ]);
        setAgents(agentsData);
        setMetrics(metricsData);
      } catch (error) {
        console.error('Failed to refresh data:', error);
      }
    }, 10000);

    return () => {
      ws.close();
      clearInterval(interval);
    };
  }, []);

  const handleDelete = async (name: string) => {
    if (confirm(`Delete agent ${name}?`)) {
      try {
        await api.deleteAgent(name);
        loadInitialData();
      } catch (error) {
        console.error('Failed to delete:', error);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-blue-600 text-white py-6 shadow">
        <div className="container mx-auto px-4">
          <h1 className="text-3xl font-bold">Drip: Water-Cooled AI Infrastructure</h1>
          <p className="text-blue-100 mt-2">Computing for Water</p>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Deployment Form */}
          <div className="lg:col-span-1">
            <DeploymentForm onSuccess={loadInitialData} />
          </div>

          {/* Thermal Gauge */}
          <div className="lg:col-span-1">
            <ThermalGauge temperature={latestTemp} waterProduction={latestWater} />
          </div>

          {/* Stats */}
          <div className="lg:col-span-1 bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">System Stats</h3>
            <div className="space-y-4">
              <div>
                <div className="text-sm text-gray-600">Active Agents</div>
                <div className="text-3xl font-bold">{agents.length}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Water Produced</div>
                <div className="text-2xl font-bold text-blue-600">
                  {metrics.total_water_produced_g.toFixed(1)} g
                </div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Total Inferences</div>
                <div className="text-xl font-semibold">{metrics.total_inferences}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600">Uptime</div>
                <div className="text-xl font-semibold">{metrics.uptime_hours.toFixed(1)} hrs</div>
              </div>
            </div>
          </div>
        </div>

        {/* Water Production Chart */}
        <div className="mb-8">
          <WaterProductionChart data={telemetryBuffer} />
        </div>

        {/* Agents Grid */}
        <div>
          <h2 className="text-2xl font-bold mb-4">Deployed Agents</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map((agent: any) => (
              <AgentCard key={agent.agent_id} agent={agent} onDelete={handleDelete} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
```

### Phase 5: Environment Configuration (30 min)

**File**: `map-client/.env.local`
```
NEXT_PUBLIC_PI_SERVER_URL=http://100.x.x.x:3000
NEXT_PUBLIC_ASUS_SERVER_URL=http://100.x.x.x:5000
NEXT_PUBLIC_ASUS_WS_URL=ws://100.x.x.x:5000/ws/telemetry
```

### Phase 6: Build & Deploy (1-2 hours)

```bash
npm run build
npm run start

# Or for development
npm run dev
```

**Host on ASUS GX10**:
```bash
# Use PM2 or similar to keep it running
npm install -g pm2
pm2 start "npm run start" --name drip-dashboard
pm2 save
```

---

## Critical Files Modified/Created

### Backend (You)
- **New**: `asus-server/main.py` - FastAPI monitoring server
- **New**: `pi-telemetry/thermal_monitor.py` - Thermal telemetry script
- **Modified**: `server/main.go` - Added list/status/delete endpoints
- **Modified**: `server/picoclaw-utils/utils.go` - Added personality file generation

### Frontend (Teammate)
- **New**: All files in `map-client/` as specified above
- **Modified**: None (starting from scratch)

---

## Timeline Estimation

| Task | Backend (You) | Frontend (Teammate) |
|------|---------------|---------------------|
| Setup | 2h | 2h |
| Core Development | 8h | 8h |
| Integration | 3h | 2h |
| Testing | 2h | 2h |
| Polish/Fixes | 3h | 2h |
| **Total** | **18h** | **16h** |

Both workstreams fit within the 24-hour hackathon timeline with buffer for issues.

---

## Demo Script

1. Show dashboard with live thermal data
2. Deploy new agent via UI
3. Watch agent appear in grid with ngrok URL
4. Click agent link, interact with it
5. Show thermal chart responding to inference load
6. Explain: "This computation just produced X grams of fresh water"

---

## Prerequisites

- [ ] MongoDB Atlas account with connection string
- [ ] Tailscale running on both Pi 5 and ASUS GX10
- [ ] Docker running on Pi 5
- [ ] NGROK_AUTHTOKEN set on Pi 5
- [ ] Python 3.10+ on both machines
- [ ] Node.js 18+ on ASUS for dashboard
- [ ] GPU drivers for vLLM on ASUS


