import { NextRequest, NextResponse } from "next/server";

const ASUS_INFERENCE_URL = process.env.ASUS_INFERENCE_URL || "http://100.89.241.84:5000/inference/drip-hub";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;

interface Message {
  role: string;
  content: string;
}

interface InferenceRequest {
  provider: "gemma" | "openai" | "google";
  messages: Message[];
}

export async function POST(request: NextRequest) {
  try {
    const body: InferenceRequest = await request.json();
    const { provider, messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json(
        { error: "Messages array is required" },
        { status: 400 }
      );
    }

    switch (provider) {
      case "gemma": {
        // Forward to ASUS FastAPI server
        const response = await fetch(ASUS_INFERENCE_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Drip-Agent-ID": "web-client",
          },
          body: JSON.stringify({ messages }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Gemma inference error:", errorText);
          return NextResponse.json(
            { error: `Gemma inference failed: ${errorText}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        // Extract message from Ollama/OpenAI-compatible response
        return NextResponse.json({
          content: data.choices?.[0]?.message?.content || "No response",
          raw: data,
        });
      }

      case "openai": {
        if (!OPENAI_API_KEY) {
          return NextResponse.json(
            { error: "OpenAI API key not configured" },
            { status: 500 }
          );
        }

        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4",
            messages,
            temperature: 0.7,
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error("OpenAI inference error:", errorText);
          return NextResponse.json(
            { error: `OpenAI inference failed: ${errorText}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        return NextResponse.json({
          content: data.choices?.[0]?.message?.content || "No response",
          raw: data,
        });
      }

      case "google": {
        if (!GOOGLE_API_KEY) {
          return NextResponse.json(
            { error: "Google API key not configured" },
            { status: 500 }
          );
        }

        // Convert OpenAI-style messages to Google Gemini format
        const contents = messages.map((msg) => ({
          role: msg.role === "assistant" ? "model" : "user",
          parts: [{ text: msg.content }],
        }));

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GOOGLE_API_KEY}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents }),
          }
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.error("Google inference error:", errorText);
          return NextResponse.json(
            { error: `Google inference failed: ${errorText}` },
            { status: response.status }
          );
        }

        const data = await response.json();
        return NextResponse.json({
          content: data.candidates?.[0]?.content?.parts?.[0]?.text || "No response",
          raw: data,
        });
      }

      default:
        return NextResponse.json(
          { error: `Unknown provider: ${provider}` },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Inference API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
