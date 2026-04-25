# Pi 5 Thermal Telemetry

Real-time thermal monitoring script for the Raspberry Pi 5, streaming telemetry to the ASUS server via WebSocket.

## Features
- Reads CPU temperature via `vcgencmd`
- Calculates water vapor pressure using Antoine Equation
- Estimates water production rate based on thermal gradient
- Streams data via WebSocket to ASUS server
- Auto-reconnection on connection loss

## Setup

```bash
# Create virtual environment
python3 -m venv venv
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Edit .env and set your ASUS Tailscale IP

# Run monitoring script
python thermal_monitor.py

# Or run in background
nohup python thermal_monitor.py > thermal.log 2>&1 &
```

## Configuration

**Required Environment Variables** (in `.env`):
- `ASUS_WS_URL`: WebSocket URL of ASUS server (via Tailscale)
  - Example: `ws://100.64.1.2:5000/ws/telemetry`

**Script Parameters**:
- Default interval: 5 seconds between readings
- Membrane coefficient: 0.01 kg/hr/mmHg (adjustable in code)

## Output

The script logs:
- CPU temperature (°C)
- Water vapor pressure (mmHg)
- Estimated water production rate (kg/hr)

Example:
```
[2026-04-25 16:30:00] Temp: 55.2°C | P: 118.45 mmHg | Water: 0.0089 kg/hr
```
