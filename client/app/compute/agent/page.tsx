import ComputeShell from "@/app/_components/compute-shell";

import AgentNav from "./agent-nav";
import AgentConfigurator from "./agent-configurator";

export default function AgentComputePage() {
  return (
    <ComputeShell
      eyebrow="Agent Compute"
      title="Deploy an agent launcher"
      description="Configure the deploy request through guided controls. Drip keeps the request human-readable and sends the generated payload through the server proxy."
    >
      <AgentNav active="deploy" />
      <AgentConfigurator />
    </ComputeShell>
  );
}
