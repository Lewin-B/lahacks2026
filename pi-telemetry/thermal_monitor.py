import subprocess
import asyncio
import os
from datetime import datetime, UTC
import websockets
import json
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# ASUS server WebSocket endpoint (via Tailscale)
ASUS_WS_URL = os.getenv("ASUS_WS_URL")
if not ASUS_WS_URL:
    raise ValueError("ASUS_WS_URL environment variable is required. Copy .env.example to .env and set your ASUS Tailscale IP.")

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
                        "timestamp": datetime.now(UTC).isoformat(),
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
