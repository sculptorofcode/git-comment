import { AIProvider, ExtensionConfig } from '../types';
import { GeminiProvider } from './geminiProvider';
import { OpenAICompatibleProvider, AnthropicProvider } from './openaiProvider';

export class ProviderFactory {
    /**
     * Creates and returns the configured AI provider.
     * @param config The current extension configuration.
     * @param apiKey The API key for the selected provider.
     */
    public static createProvider(config: ExtensionConfig, apiKey: string): AIProvider {
        const { provider } = config;

        switch (provider) {
            case 'gemini':
                return new GeminiProvider(apiKey, config.gemini.model);

            case 'openai':
                return new OpenAICompatibleProvider(
                    'openai',
                    'OpenAI',
                    apiKey,
                    config.openai.model,
                    config.openai.baseUrl
                );

            case 'anthropic':
                return new AnthropicProvider(apiKey, config.anthropic.model);

            case 'groq':
                return new OpenAICompatibleProvider(
                    'groq',
                    'Groq',
                    apiKey,
                    config.groq.model,
                    'https://api.groq.com/openai/v1'
                );

            case 'deepseek':
                return new OpenAICompatibleProvider(
                    'deepseek',
                    'DeepSeek',
                    apiKey,
                    config.deepseek.model,
                    'https://api.deepseek.com/v1'
                );

            case 'ollama':
                return new OpenAICompatibleProvider(
                    'ollama',
                    'Ollama',
                    apiKey || 'ollama', // Ollama doesn't require a key, but we pass a dummy value
                    config.ollama.model,
                    config.ollama.baseUrl
                );

            case 'openrouter':
                return new OpenAICompatibleProvider(
                    'openrouter',
                    'OpenRouter',
                    apiKey,
                    config.openrouter.model,
                    'https://openrouter.ai/api/v1',
                    {
                        'HTTP-Referer': 'https://github.com/sculptorofcode/git-comment',
                        'X-Title': 'Git Comment VS Code Extension'
                    }
                );

            default:
                throw new Error(`Unsupported provider: ${provider}`);
        }
    }
}
