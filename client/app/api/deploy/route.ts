const DEFAULT_SERVER_URL = "http://localhost:3000";

export async function POST(request: Request) {
  let payload: unknown;

  try {
    payload = await request.json();
  } catch {
    return Response.json(
      { error: "Request body must be valid JSON." },
      { status: 400 }
    );
  }

  const serverBaseUrl = process.env.DRIP_SERVER_URL || DEFAULT_SERVER_URL;
  let deployUrl: URL;

  try {
    deployUrl = new URL("/deploy", serverBaseUrl);
  } catch {
    return Response.json(
      { error: "DRIP_SERVER_URL must be a valid server URL." },
      { status: 500 }
    );
  }

  try {
    const upstreamResponse = await fetch(deployUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
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
      { message: responseText || "Deploy request completed." },
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
