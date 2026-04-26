# ASUS GX10 Server

FastAPI server for the Drip Intelligence Hub running on ASUS GX10.

## Features
- WebSocket endpoint for real-time telemetry streaming from Pi 5
- Agent registry (MongoDB)
- Accumulated metrics tracking (total water produced, inferences, uptime)
- Ollama proxy endpoint for Gemma 4 e4b Q4 inference with concurrent user support

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
- `GEMMA_MODEL`: (Optional) Ollama model to use (defaults to `gemma4:e4b-q4`)

## Endpoints

- `POST /agents/register` - Register a deployed agent
- `GET /agents` - List all registered agents
- `GET /telemetry/buffer` - Get last 100 telemetry readings
- `GET /metrics` - Get accumulated metrics
- `POST /inference/drip-hub` - Proxy to Ollama for inference
- `WS /ws/telemetry` - WebSocket for real-time telemetry streaming

## Ollama Setup with Gemma 4 e4b Q4

On the ASUS GX10, install and run Ollama with concurrent user support:

### 1. Install Ollama

```bash
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Pull Gemma 4 e4b Q4 Model

```bash
# Pull the Gemma 4 e4b Q4_K_M quantized model
ollama pull gemma4:e4b-it-q4_K_M
```

### 3. Run Ollama with Concurrent User Support

For hackathon with multiple users, set `OLLAMA_NUM_PARALLEL` to handle concurrent requests:

```bash
# Set environment variable for concurrent users (adjust based on VRAM)
# Start with 8 for safety, can increase to 16-32 if you have headroom
export OLLAMA_NUM_PARALLEL=8

# Start Ollama server
ollama serve
```

This will:
- Load multiple "slots" of the model into VRAM
- Handle 8 concurrent inference requests
- Automatically queue additional requests if all slots are busy

### 4. Test Ollama is Running

```bash
curl http://localhost:11434/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "model": "gemma4:e4b-it-q4_K_M",
    "messages": [{"role": "user", "content": "Hello!"}]
  }'
```

**To change models**: Set the `GEMMA_MODEL` environment variable before running the FastAPI server:

```bash
# For e4b Q4_K_M (default)
export GEMMA_MODEL="gemma4:e4b-it-q4_K_M"

# For other Gemma variants
export GEMMA_MODEL="gemma4:27b-it-q4_K_M"  # Larger model

python main.py
```

**Why Ollama over vLLM for Hackathons:**
- Much more stable on ARM/SBSA (Grace Blackwell)
- No C++ build errors or dependency nightmares
- Quick setup (5 minutes vs 5 hours)
- Good enough performance for demo with dozens of concurrent users
- Easy model management with `ollama pull/list/rm`
