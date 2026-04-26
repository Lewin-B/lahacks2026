const DEFAULT_DEPLOY_SERVER_URL = "http://localhost:3000";
const DEFAULT_TELEMETRY_PATH = "/telemetry";

export async function GET() {
  const explicitWebsocketUrl =
    process.env.DRIP_TELEMETRY_WS_URL ||
    process.env.NEXT_PUBLIC_DRIP_TELEMETRY_WS_URL ||
    process.env.ASUS_WS_URL ||
    "";

  if (explicitWebsocketUrl.trim()) {
    try {
      return Response.json({
        wsUrl: frontendTelemetryUrl(explicitWebsocketUrl),
      });
    } catch {
      return Response.json(
        { error: "DRIP_TELEMETRY_WS_URL must be a valid WebSocket URL." },
        { status: 500 },
      );
    }
  }

  const serverBaseUrl =
    process.env.DRIP_TELEMETRY_SERVER_URL ||
    process.env.DRIP_SERVER_URL ||
    DEFAULT_DEPLOY_SERVER_URL;

  try {
    return Response.json({
      wsUrl: websocketUrlFromServer(serverBaseUrl, DEFAULT_TELEMETRY_PATH),
    });
  } catch {
    return Response.json(
      { error: "DRIP_TELEMETRY_SERVER_URL must be a valid server URL." },
      { status: 500 },
    );
  }
}

function websocketUrlFromServer(serverBaseUrl: string, path: string) {
  const url = new URL(path, serverBaseUrl);

  if (url.protocol === "https:") {
    url.protocol = "wss:";
  } else if (url.protocol === "http:") {
    url.protocol = "ws:";
  } else if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Unsupported telemetry server protocol.");
  }

  return url.toString();
}

function frontendTelemetryUrl(value: string) {
  const url = new URL(value);

  if (url.protocol !== "ws:" && url.protocol !== "wss:") {
    throw new Error("Telemetry URL must use ws or wss.");
  }

  if (url.pathname === "/ws/telemetry" && !url.searchParams.has("role")) {
    url.searchParams.set("role", "client");
  }

  return url.toString();
}
