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
