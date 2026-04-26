import ComputeShell from "@/app/_components/compute-shell";

import AgentConfigurator from "./agent-configurator";

export default function AgentComputePage() {
  return (
    <ComputeShell
      eyebrow="Agent Compute"
      title="Deploy an agent launcher"
      description="Configure the deploy request through guided controls. Drip keeps the request human-readable and sends the generated payload through the server proxy."
    >
      <AgentConfigurator />
    </ComputeShell>
  );
}
