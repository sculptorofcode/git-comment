export type ProviderType = 'gemini' | 'openai' | 'anthropic' | 'groq' | 'deepseek' | 'ollama' | 'openrouter';

export interface ExtensionConfig {
    provider: ProviderType;
    promptTemplate: string;
    useConventionalCommits: boolean;
    openai: {
        model: string;
        baseUrl: string;
    };
    gemini: {
        model: string;
    };
    anthropic: {
        model: string;
    };
    groq: {
        model: string;
    };
    deepseek: {
        model: string;
    };
    ollama: {
        model: string;
        baseUrl: string;
    };
    openrouter: {
        model: string;
    };
}

export interface AIProvider {
    readonly id: ProviderType;
    readonly name: string;
    generateCommitMessage(
        diff: string, 
        prompt: string, 
        onToken: (token: string) => void,
        signal?: AbortSignal
    ): Promise<string>;
}
