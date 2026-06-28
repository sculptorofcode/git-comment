import { BaseProvider } from './baseProvider';
import { ProviderType } from '../types';
import { parseStream } from './streamHelper';

export class GeminiProvider extends BaseProvider {
    public readonly id: ProviderType = 'gemini';
    public readonly name = 'Google Gemini';

    public async generateCommitMessage(
        _diff: string, 
        prompt: string, 
        onToken: (token: string) => void,
        signal?: AbortSignal
    ): Promise<string> {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:streamGenerateContent?key=${this.apiKey}&alt=sse`;
        
        try {
            const requestInit: RequestInit = {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: [
                                {
                                    text: prompt
                                }
                            ]
                        }
                    ],
                    generationConfig: {
                        temperature: 0.2
                    }
                })
            };
            if (signal) {
                requestInit.signal = signal;
            }
            const response = await this.fetchWithRetry(url, requestInit);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
            }

            const rawMessage = await parseStream(
                response,
                onToken,
                (line: string) => {
                    if (line.startsWith('data: ')) {
                        try {
                            const dataStr = line.substring(6).trim();
                            const parsed = JSON.parse(dataStr);
                            return parsed.candidates?.[0]?.content?.parts?.[0]?.text;
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
            console.error('Gemini Provider Error:', error.message);
            throw new Error(`Gemini Provider failed: ${error.message}`);
        }
    }
}
