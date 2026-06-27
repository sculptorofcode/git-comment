import * as vscode from 'vscode';
import { ProviderType } from '../types';

export class SecretManager {
    private static instance: SecretManager;
    private secrets!: vscode.SecretStorage;

    private constructor() {}

    /**
     * Gets the singleton instance of the SecretManager.
     */
    public static getInstance(): SecretManager {
        if (!SecretManager.instance) {
            SecretManager.instance = new SecretManager();
        }
        return SecretManager.instance;
    }

    /**
     * Initializes the SecretManager with the extension context.
     * @param context The VS Code extension context.
     */
    public init(context: vscode.ExtensionContext): void {
        this.secrets = context.secrets;
    }

    /**
     * Returns the key used to store the API key for a provider.
     */
    private getSecretKey(provider: ProviderType): string {
        return `git-comment.${provider}.apiKey`;
    }

    /**
     * Retrieves the API key for the specified provider.
     * @param provider The AI provider.
     */
    public async getApiKey(provider: ProviderType): Promise<string | undefined> {
        if (!this.secrets) {
            throw new Error('SecretManager not initialized');
        }
        return await this.secrets.get(this.getSecretKey(provider));
    }

    /**
     * Stores the API key securely for the specified provider.
     * @param provider The AI provider.
     * @param apiKey The API key to store.
     */
    public async storeApiKey(provider: ProviderType, apiKey: string): Promise<void> {
        if (!this.secrets) {
            throw new Error('SecretManager not initialized');
        }
        await this.secrets.store(this.getSecretKey(provider), apiKey.trim());
    }

    /**
     * Deletes the API key for the specified provider.
     * @param provider The AI provider.
     */
    public async deleteApiKey(provider: ProviderType): Promise<void> {
        if (!this.secrets) {
            throw new Error('SecretManager not initialized');
        }
        await this.secrets.delete(this.getSecretKey(provider));
    }
}
