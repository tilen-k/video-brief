import { OpenRouterAIProvider } from "./openrouter-ai-provider";
import type { AIProvider } from "./provider";

let defaultProvider: AIProvider | null = null;

export function getDefaultAIProvider(): AIProvider {
  if (!defaultProvider) {
    defaultProvider = new OpenRouterAIProvider();
  }
  return defaultProvider;
}
