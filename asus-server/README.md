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

# Set up environment variables
cp .env.example .env
# Edit .env and set your MongoDB URI

# Run server
python main.py
```

**Required Environment Variables** (in `.env`):
- `MONGODB_URI`: MongoDB Atlas connection string
- `GEMMA_MODEL`: (Optional) Gemma 4 model to use (defaults to `google/gemma-4-31B-it`)

## Endpoints

- `POST /agents/register` - Register a deployed agent
- `GET /agents` - List all registered agents
- `GET /telemetry/buffer` - Get last 100 telemetry readings
- `GET /metrics` - Get accumulated metrics
- `POST /inference/drip-hub` - Proxy to vLLM for inference
- `WS /ws/telemetry` - WebSocket for real-time telemetry streaming

## vLLM Setup with Gemma 4

On the ASUS GX10, run vLLM via Docker with Gemma 4:

```bash
# Gemma 4 31B (recommended for demos - best quality)
sudo docker run -itd --name gemma4-31b \
  --gpus all \
  --ipc=host \
  --rm \
  -p 8000:8000 \
  -v ~/.cache/huggingface:/root/.cache/huggingface \
  -e HF_TOKEN=<YOUR_HF_TOKEN> \
  -e VLLM_USE_V2_MODEL_RUNNER=1 \
  vllm/vllm-openai:gemma4-cu130 \
  google/gemma-4-31B-it \
  --quantization nvfp4 \
  --max-model-len 32768 \
  --host 0.0.0.0

# Alternative: Gemma 4 9B (faster, lower memory)
# Change "google/gemma-4-31B-it" to "google/gemma-4-9B-it"
```

**To change models**: Set the `GEMMA_MODEL` environment variable before running the FastAPI server:

```bash
# For 31B (default)
export GEMMA_MODEL="google/gemma-4-31B-it"

# For 9B
export GEMMA_MODEL="google/gemma-4-9B-it"

python main.py
```
