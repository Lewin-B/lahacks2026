import ComputeShell from "@/app/_components/compute-shell";

import AgentNav from "../agent-nav";
import DeploymentsView from "./deployments-view";

export default function AgentDeploymentsPage() {
  return (
    <ComputeShell
      eyebrow="Agent Compute"
      title="Current agent deployments"
      description="Monitor the Picoclaw agent containers available through the deploy server and jump into their local or public endpoints."
    >
      <AgentNav active="deployments" />
      <DeploymentsView />
    </ComputeShell>
  );
}
