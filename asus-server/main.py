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
if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=5000)
