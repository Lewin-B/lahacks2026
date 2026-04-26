import { ChatInterface } from "./chat-interface";

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#06111f] to-[#0a1929] text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Drip Inference
          </h1>
          <p className="text-gray-400 mb-8">
            Chat with AI models - use your local Gemma or external providers
          </p>
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}
