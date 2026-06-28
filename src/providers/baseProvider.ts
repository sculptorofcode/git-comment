import { AIProvider, ProviderType } from '../types';

export abstract class BaseProvider implements AIProvider {
    public abstract readonly id: ProviderType;
    public abstract readonly name: string;

    constructor(
        protected readonly apiKey: string,
        protected readonly model: string
    ) {}

    public abstract generateCommitMessage(
        diff: string, 
        prompt: string, 
        onToken: (token: string) => void,
        signal?: AbortSignal
    ): Promise<string>;

    /**
     * Performs a fetch request with retries on transient errors (429, 500, 502, 503, 504)
     * using exponential backoff with jitter.
     */
    protected async fetchWithRetry(
        url: string,
        options: RequestInit,
        maxRetries = 3,
        initialDelayMs = 1000
    ): Promise<Response> {
        let delayMs = initialDelayMs;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            if (options.signal?.aborted) {
                const abortError = new Error('Generation cancelled by the user.');
                abortError.name = 'AbortError';
                throw abortError;
            }

            try {
                const response = await fetch(url, options);

                if (response.ok) {
                    return response;
                }

                const status = response.status;
                const isTransient = [429, 500, 502, 503, 504].includes(status);

                if (!isTransient || attempt === maxRetries) {
                    return response;
                }

                // Log transient error and retry details
                const errText = await response.text().catch(() => '');
                console.warn(
                    `[${this.name}] Request failed with status ${status}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries}). Error details: ${errText}`
                );
                
                try {
                    const { GitService } = require('../services/gitService');
                    GitService.log(`[${this.name}] Request failed with status ${status}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries}).`);
                } catch {
                    // Ignore require errors
                }
            } catch (error: any) {
                if (error.name === 'AbortError' || error.message === 'Generation cancelled by the user.') {
                    throw error;
                }

                if (attempt === maxRetries) {
                    throw error;
                }

                console.warn(
                    `[${this.name}] Request failed with network error: ${error.message}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries}).`
                );
                
                try {
                    const { GitService } = require('../services/gitService');
                    GitService.log(`[${this.name}] Request failed with network error: ${error.message}. Retrying in ${delayMs}ms (attempt ${attempt + 1}/${maxRetries}).`);
                } catch {
                    // Ignore require errors
                }
            }

            // Wait before next attempt, listening to abort signal
            await new Promise<void>((resolve, reject) => {
                if (options.signal?.aborted) {
                    const abortError = new Error('Generation cancelled by the user.');
                    abortError.name = 'AbortError';
                    return reject(abortError);
                }
                const timer = setTimeout(() => {
                    if (options.signal) {
                        options.signal.removeEventListener('abort', onAbort);
                    }
                    resolve();
                }, delayMs);
                
                function onAbort() {
                    clearTimeout(timer);
                    const abortError = new Error('Generation cancelled by the user.');
                    abortError.name = 'AbortError';
                    reject(abortError);
                }
                
                if (options.signal) {
                    options.signal.addEventListener('abort', onAbort);
                }
            });

            // Exponential backoff with jitter
            const jitter = (Math.random() - 0.5) * 0.2 * delayMs;
            delayMs = (delayMs * 2) + jitter;
        }

        throw new Error('Request failed after max retries');
    }

    /**
     * Cleans up the generated commit message by removing potential markdown code block wrappers
     * and extra whitespace.
     * @param message Raw output from the AI model.
     */
    protected cleanMessage(message: string): string {
        let cleaned = message.trim();
        
        // Remove opening code block if exists (e.g., ``` or ```gitcommit)
        if (cleaned.startsWith('```')) {
            const firstLineBreak = cleaned.indexOf('\n');
            if (firstLineBreak !== -1) {
                cleaned = cleaned.substring(firstLineBreak + 1);
            }
        }
        
        // Remove closing code block if exists (e.g., ```)
        if (cleaned.endsWith('```')) {
            cleaned = cleaned.substring(0, cleaned.length - 3);
        }
        
        return cleaned.trim();
    }
}
