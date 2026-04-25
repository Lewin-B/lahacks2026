
# Creating the context-and-plan.md file for the user.

content = """# Drip: Project Context & Technical Blueprint

## 1. Project Context
**Project Name:** Drip  
**Origin:** Developed for LA Hacks 2026.  
**Vision:** "Computing for Water."  

### The Problem
Modern AI data centers are "thirsty"—they consume billions of gallons of fresh water for cooling and dissipate massive amounts of heat as waste. As AI scaling accelerates, this environmental toll becomes unsustainable.

### The Solution: Drip
Drip is a prototype for a circular-economy data center. It transforms the "waste" of computation (heat) into a "resource" (fresh water) through a membrane distillation loop. The project combines high-performance supercomputing with sustainable edge infrastructure. 

### Development Journey
The project began as a hardware-focused hack involving a water-cooled Raspberry Pi 5 linked to a desalination membrane. It evolved into a sophisticated "Software-Defined Data Center" (SDDC) architecture. By using a distributed approach, we separate the "Intelligence Hub" (ASUS GX10) from the "Thermal Factory" (Pi 5), allowing users to deploy private, automated AI agents that physically produce water as they compute.

---

## 2. Technical Plan: The HydraCompute Infrastructure

### A. The Nervous System (Networking)
To satisfy high-performance and security requirements, the architecture is split into a private backbone for inference and a public gateway for users.

* **Private Backbone (Tailscale):** The Raspberry Pi 5 and ASUS GX10 communicate over a secure, encrypted mesh. All inference requests and thermal telemetry move over this low-latency private link.
* **Public Gateway (ngrok):** Each deployed PicoClaw agent on the Pi 5 is projected to the internet via an automated ngrok tunnel. This provides a stable, "Vercel-style" URL for users to access their private agents from any device.
* **Thermal Heart:** The water-cooled Raspberry Pi 5 serves as the physical site for membrane distillation. All agent orchestration happens here to maximize the CPU heat available for the desalination loop.

### B. The Drip Hub (ASUS Ascent GX10)
The ASUS machine acts as the centralized high-performance Inference Engine.

* **vLLM Hub:** Serves **Gemma 4** using continuous batching. This ensures that multiple users can chat with their respective PicoClaw agents simultaneously without "locking" the GPU.
* **FastAPI Proxy:** An asynchronous Python server that manages the "Drip Hub" API.
    * **User Attribution:** It checks an `X-Drip-Agent-ID` header in incoming requests to track which user is generating compute and attribute water production correctly.
    * **Telemetry Logging:** It correlates compute load with the Pi 5's temperature data, logging "Inferences per Drop" in MongoDB Atlas.

### C. The Agent Factory (Raspberry Pi 5)
Using the ultra-lightweight **PicoClaw** framework, the Pi 5 automates the deployment of unique AI assistants.

#### Automated Configuration
When a user deploys an agent via the Drip frontend, the Pi 5 creates a unique `PICOCLAW_HOME` directory and generates five critical configuration files:
1.  **AGENT.md:** Sets the core behavior and domain expertise.
2.  **SOUL.md:** Defines the personality and tone.
3.  **IDENTITY.md:** Contains agent-specific facts.
4.  **USER.md:** Stores user preferences and context.
5.  **HEARTBEAT.md:** Injected with recurring tasks that ensure the Pi 5 CPU remains "warm" enough for desalination during idle periods.

#### Isolated Runtime
Each agent runs as a standalone process on a unique local port. Because PicoClaw tracks file `mtime` (modification time), users can update their agent's personality on the Drip dashboard, and the running agent will pick up the changes instantly without a restart.

### D. User Experience: Intelligence Choices
The Drip frontend allows users to choose their "Compute Utility" based on their needs and sustainability goals.

| Choice | Backend Workflow | Sustainability Impact |
| :--- | :--- | :--- |
| **Drip Hub (Gemma 4)** | **Pi 5 (PicoClaw)** → **Tailscale** → **ASUS GX10 (vLLM)**. | **Maximum**. High-throughput processing on the GX10 ensures the Pi stays at peak thermal efficiency for water production. |
| **Personal Provider** | **Pi 5 (PicoClaw)** → **Public Internet** → **OpenAI/Google API**. | **Partial**. Generates heat on the Pi for orchestration, but the heavy lifting occurs in external cloud data centers. |

---

## 3. Implementation Roadmap for AI Agents

1.  **Backend Factory:** Script the automated creation of `PICOCLAW_HOME` directories and `.md` files.
2.  **Network Tunneling:** Automate `ngrok` tunnel creation via the ngrok Python API for every new port assignment.
3.  **FastAPI Hub:** Build the ASUS-side proxy to handle request routing to vLLM and log telemetry.
4.  **Digital Twin Dashboard:** Create a frontend that visualizes the Antoine Equation:
    * $P = 10^{8.07131 - \\frac{1730.63}{233.426 + T}}$
    * $J_w = C \cdot (P_{hot} - P_{cold})$
    * Update values in real-time based on the Pi 5's `vcgencmd measure_temp`.
"""

with open("context-and-plan.md", "w") as f:
    f.write(content)
