# ASUS GX10 Server

FastAPI server for the Drip Intelligence Hub running on ASUS GX10.

## Features
- WebSocket endpoint for real-time telemetry streaming from Pi 5
- Agent registry (MongoDB)
- Accumulated metrics tracking (total water produced, inferences, uptime)
- vLLM proxy endpoint for Gemma 4 inference

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set MongoDB URI
export MONGODB_URI="mongodb+srv://username:password@cluster.mongodb.net/drip"

# Run server
python main.py
```

## Endpoints

- `POST /agents/register` - Register a deployed agent
- `GET /agents` - List all registered agents
- `GET /telemetry/buffer` - Get last 100 telemetry readings
- `GET /metrics` - Get accumulated metrics
- `POST /inference/drip-hub` - Proxy to vLLM for inference
- `WS /ws/telemetry` - WebSocket for real-time telemetry streaming

## vLLM Setup

In a separate terminal on the ASUS GX10:

```bash
pip install vllm

vllm serve google/gemma-2-9b-it \
  --host 0.0.0.0 \
  --port 8000 \
  --dtype auto \
  --api-key drip-internal-key
```
