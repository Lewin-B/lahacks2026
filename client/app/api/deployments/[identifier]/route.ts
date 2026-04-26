const DEFAULT_SERVER_URL = "http://localhost:3000";

type RouteContext = {
  params: Promise<{
    identifier: string;
  }>;
};

export async function DELETE(_request: Request, context: RouteContext) {
  const { identifier } = await context.params;
  const serverBaseUrl = process.env.DRIP_SERVER_URL || DEFAULT_SERVER_URL;
  let deploymentUrl: URL;

  try {
    deploymentUrl = new URL(
      `/deployments/${encodeURIComponent(identifier)}`,
      serverBaseUrl
    );
  } catch {
    return Response.json(
      { error: "DRIP_SERVER_URL must be a valid server URL." },
      { status: 500 }
    );
  }

  try {
    const upstreamResponse = await fetch(deploymentUrl, {
      method: "DELETE",
      cache: "no-store",
    });

    const responseText = await upstreamResponse.text();
    const contentType = upstreamResponse.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      return new Response(responseText, {
        status: upstreamResponse.status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (!upstreamResponse.ok) {
      return Response.json(
        {
          error:
            responseText ||
            `Deploy server returned status ${upstreamResponse.status}.`,
        },
        { status: upstreamResponse.status }
      );
    }

    return Response.json(
      { message: responseText || "Deployment deleted." },
      { status: upstreamResponse.status }
    );
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not reach the deploy server.",
      },
      { status: 502 }
    );
  }
}
