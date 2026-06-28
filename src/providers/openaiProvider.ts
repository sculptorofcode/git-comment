import { BaseProvider } from './baseProvider';
import { ProviderType } from '../types';
import { parseStream } from './streamHelper';

export class OpenAICompatibleProvider extends BaseProvider {
    constructor(
        public readonly id: ProviderType,
        public readonly name: string,
        apiKey: string,
        model: string,
        private readonly baseUrl: string,
        private readonly extraHeaders: Record<string, string> = {}
    ) {
        super(apiKey, model);
    }

    public async generateCommitMessage(
        _diff: string, 
        prompt: string, 
        onToken: (token: string) => void,
        signal?: AbortSignal
    ): Promise<string> {
        const url = `${this.baseUrl}/chat/completions`;
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...this.extraHeaders
        };

        if (this.apiKey) {
            headers['Authorization'] = `Bearer ${this.apiKey}`;
        }

        try {
            const requestInit: RequestInit = {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: this.model,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    stream: true
                })
            };
            if (signal) {
                requestInit.signal = signal;
            }
            const response = await this.fetchWithRetry(url, requestInit);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`${this.name} API returned status ${response.status}: ${errText}`);
            }

            const rawMessage = await parseStream(
                response,
                onToken,
                (line: string) => {
                    if (line.startsWith('data: ')) {
                        const dataStr = line.substring(6).trim();
                        if (dataStr === '[DONE]') {
                            return undefined;
                        }
                        try {
                            const parsed = JSON.parse(dataStr);
                            return parsed.choices?.[0]?.delta?.content;
                        } catch (e) {
                            // Ignore json parse errors for partial lines
                        }
                    }
                    return undefined;
                }
            );

            return this.cleanMessage(rawMessage);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('Generation cancelled by the user.');
            }
            console.error(`${this.name} Provider Error:`, error.message);
            throw new Error(`${this.name} Provider failed: ${error.message}`);
        }
    }
}

export class AnthropicProvider extends BaseProvider {
    public readonly id: ProviderType = 'anthropic';
    public readonly name = 'Anthropic Claude';

    public async generateCommitMessage(
        _diff: string, 
        prompt: string, 
        onToken: (token: string) => void,
        signal?: AbortSignal
    ): Promise<string> {
        const url = 'https://api.anthropic.com/v1/messages';
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'x-api-key': this.apiKey,
            'anthropic-version': '2023-06-01'
        };

        try {
            const requestInit: RequestInit = {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    model: this.model,
                    max_tokens: 1024,
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    temperature: 0.2,
                    stream: true
                })
            };
            if (signal) {
                requestInit.signal = signal;
            }
            const response = await this.fetchWithRetry(url, requestInit);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Anthropic API returned status ${response.status}: ${errText}`);
            }

            const rawMessage = await parseStream(
                response,
                onToken,
                (line: string) => {
                    if (line.startsWith('data: ')) {
                        try {
                            const dataStr = line.substring(6).trim();
                            const parsed = JSON.parse(dataStr);
                            if (parsed.type === 'content_block_delta' && parsed.delta?.text) {
                                return parsed.delta.text;
                            }
                        } catch (e) {
                            // Ignore json parse errors for partial lines
                        }
                    }
                    return undefined;
                }
            );

            return this.cleanMessage(rawMessage);
        } catch (error: any) {
            if (error.name === 'AbortError') {
                throw new Error('Generation cancelled by the user.');
            }
            console.error('Anthropic Provider Error:', error.message);
            throw new Error(`Anthropic Provider failed: ${error.message}`);
        }
    }
}
