import subprocess
import asyncio
import os
from datetime import datetime
import websockets
import json

# ASUS server WebSocket endpoint (via Tailscale)
# I want this to be an env secret actually.
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

