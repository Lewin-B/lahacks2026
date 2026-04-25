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
