"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Send, Loader2 } from "lucide-react";

type Provider = "gemma" | "openai" | "google";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export function ChatInterface() {
  const [provider, setProvider] = useState<Provider>("gemma");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/inference", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider,
          messages: [...messages, userMessage],
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const assistantMessage: Message = {
        role: "assistant",
        content: data.content || data.choices?.[0]?.message?.content || "No response",
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Inference error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Failed to get response"}`,
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <Card className="bg-[#0a1929]/80 border-cyan-900/30 backdrop-blur-sm">
      <div className="p-6">
        {/* Provider Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Inference Provider
          </label>
          <div className="flex gap-2">
            <Button
              variant={provider === "gemma" ? "default" : "outline"}
              onClick={() => setProvider("gemma")}
              className={
                provider === "gemma"
                  ? "bg-cyan-600 hover:bg-cyan-700"
                  : "border-cyan-900/50 hover:bg-cyan-950/30"
              }
            >
              Gemma (Local)
            </Button>
            <Button
              variant={provider === "openai" ? "default" : "outline"}
              onClick={() => setProvider("openai")}
              className={
                provider === "openai"
                  ? "bg-cyan-600 hover:bg-cyan-700"
                  : "border-cyan-900/50 hover:bg-cyan-950/30"
              }
            >
              OpenAI
            </Button>
            <Button
              variant={provider === "google" ? "default" : "outline"}
              onClick={() => setProvider("google")}
              className={
                provider === "google"
                  ? "bg-cyan-600 hover:bg-cyan-700"
                  : "border-cyan-900/50 hover:bg-cyan-950/30"
              }
            >
              Google
            </Button>
          </div>
        </div>

        {/* Messages Display */}
        <div className="h-96 overflow-y-auto mb-4 space-y-4 p-4 bg-[#06111f]/50 rounded-lg border border-cyan-900/20">
          {messages.length === 0 && (
            <div className="text-center text-gray-500 mt-20">
              Start a conversation with {provider === "gemma" ? "your local Gemma model" : provider}
            </div>
          )}
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-lg px-4 py-2 ${
                  message.role === "user"
                    ? "bg-cyan-600 text-white"
                    : "bg-gray-800 text-gray-100"
                }`}
              >
                <div className="text-xs font-semibold mb-1 opacity-70">
                  {message.role === "user" ? "You" : provider.toUpperCase()}
                </div>
                <div className="whitespace-pre-wrap">{message.content}</div>
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-gray-800 text-gray-100 rounded-lg px-4 py-2">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message... (Enter to send, Shift+Enter for new line)"
            className="flex-1 bg-[#06111f] border border-cyan-900/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-cyan-600 resize-none"
            rows={3}
            disabled={isLoading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="bg-cyan-600 hover:bg-cyan-700 px-6"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </Card>
  );
}
