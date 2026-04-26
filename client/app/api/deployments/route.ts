const DEFAULT_SERVER_URL = "http://localhost:3000";

export async function GET() {
  const serverBaseUrl = process.env.DRIP_SERVER_URL || DEFAULT_SERVER_URL;
  let deploymentsUrl: URL;

  try {
    deploymentsUrl = new URL("/deployments", serverBaseUrl);
  } catch {
    return Response.json(
      { error: "DRIP_SERVER_URL must be a valid server URL." },
      { status: 500 }
    );
  }

  try {
    const upstreamResponse = await fetch(deploymentsUrl, {
      method: "GET",
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
      { deployments: [], message: responseText || "No deployments returned." },
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
