#!/bin/bash
# Startup script for Ollama with proven stable configuration for Gemma 4 e4b

export OLLAMA_NUM_PARALLEL=2
export OLLAMA_CONTEXT_LENGTH=131072
export OLLAMA_MAX_LOADED_MODELS=1

echo "Starting Ollama with configuration:"
echo "  OLLAMA_NUM_PARALLEL=2 (2 concurrent users)"
echo "  OLLAMA_CONTEXT_LENGTH=131072 (matches model training)"
echo "  OLLAMA_MAX_LOADED_MODELS=1 (single model instance)"
echo ""
echo "Model: gemma4:e4b-it-q4_K_M"
echo "Expected memory usage: ~14.7 GiB"
echo ""

ollama serve
