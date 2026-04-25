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
