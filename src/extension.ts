import * as vscode from 'vscode';
import { GitService } from './services/gitService';
import { SecretManager } from './services/secretManager';
import { PromptEngine } from './services/promptEngine';
import { ProviderFactory } from './providers/providerFactory';
import { SettingsWebview } from './services/settingsWebview';
import { ExtensionConfig, ProviderType } from './types';

export function activate(context: vscode.ExtensionContext) {
    // Initialize SecretManager with the extension context
    SecretManager.getInstance().init(context);

    let isGenerating = false;

    // Register Generate Commit Message Command
    const generateCommand = vscode.commands.registerCommand(
        'git-comment.generateCommitMessage',
        async () => {
            const gitService = GitService.getInstance();
            
            const repo = gitService.getActiveRepository();
            if (!repo) {
                vscode.window.showErrorMessage('Git Comment: No active Git repository found.');
                return;
            }

            if (isGenerating) {
                vscode.window.showWarningMessage('Git Comment: Generation is already in progress.');
                return;
            }

            if (!gitService.hasChanges(repo)) {
                vscode.window.showWarningMessage('Git Comment: No changes found. Please modify some files first.');
                return;
            }

            const config = getExtensionConfig();
            
            // Get or prompt for API Key
            let apiKey = '';
            if (config.provider !== 'ollama') {
                const secretManager = SecretManager.getInstance();
                let storedKey = await secretManager.getApiKey(config.provider);
                
                if (!storedKey) {
                    const userInput = await vscode.window.showInputBox({
                        prompt: `Enter API Key for ${config.provider} (will be saved securely)`,
                        password: true,
                        ignoreFocusOut: true
                    });
                    
                    if (!userInput) {
                        return; // User cancelled
                    }
                    
                    storedKey = userInput;
                    await secretManager.storeApiKey(config.provider, userInput);
                    vscode.window.showInformationMessage(`API Key for ${config.provider} saved successfully.`);
                }
                apiKey = storedKey;
            }

            isGenerating = true;
            const abortController = new AbortController();

            try {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: 'Generating AI commit message...',
                    cancellable: true
                }, async (_progress, token) => {
                    token.onCancellationRequested(() => {
                        abortController.abort();
                    });

                    const { diff, isStaged: _isStaged, isDiffTooLarge } = await gitService.getDiff(repo);
                    if (!diff || diff.trim().length === 0) {
                        throw new Error('No changes found in the diff. If you only have untracked (new) files, please stage them first so Git can process them.');
                    }
                    if (isDiffTooLarge) {
                        vscode.window.showInformationMessage('Git Comment: Diff is too large. Generating commit message from changed file list instead.');
                    }
                    const prompt = PromptEngine.buildPrompt(diff, config);
                    const provider = ProviderFactory.createProvider(config, apiKey);
                    
                    let accumulatedMessage = '';
                    const commitMessage = await provider.generateCommitMessage(
                        diff, 
                        prompt, 
                        (chunk) => {
                            accumulatedMessage += chunk;
                            // Clean up markdown block fences on the fly
                            let cleaned = accumulatedMessage.trim();
                            if (cleaned.startsWith('```')) {
                                const firstLineBreak = cleaned.indexOf('\n');
                                if (firstLineBreak !== -1) {
                                    cleaned = cleaned.substring(firstLineBreak + 1);
                                } else {
                                    cleaned = ''; // Hide backticks until content starts
                                }
                            }
                            if (cleaned.endsWith('```')) {
                                cleaned = cleaned.substring(0, cleaned.length - 3);
                            }
                            gitService.setCommitMessage(repo, cleaned);
                        },
                        abortController.signal
                    );
                    
                    gitService.setCommitMessage(repo, commitMessage);
                });
            } catch (error: any) {
                if (error.message !== 'Generation cancelled by the user.') {
                    vscode.window.showErrorMessage(`Git Comment: ${error.message}`);
                }
            } finally {
                isGenerating = false;
            }
        }
    );

    // Register Set API Key Command
    const setApiKeyCommand = vscode.commands.registerCommand(
        'git-comment.setApiKey',
        async () => {
            const providers: { label: string; value: ProviderType }[] = [
                { label: 'Google Gemini', value: 'gemini' },
                { label: 'OpenAI', value: 'openai' },
                { label: 'Anthropic Claude', value: 'anthropic' },
                { label: 'Groq', value: 'groq' },
                { label: 'DeepSeek', value: 'deepseek' },
                { label: 'OpenRouter', value: 'openrouter' },
                { label: 'Ollama', value: 'ollama' }
            ];

            const selected = await vscode.window.showQuickPick(providers, {
                placeHolder: 'Select the AI provider to set the API Key for'
            });

            if (!selected) {
                return;
            }

            const apiKey = await vscode.window.showInputBox({
                prompt: `Enter API Key for ${selected.label}`,
                password: true,
                ignoreFocusOut: true
            });

            if (!apiKey) {
                return;
            }

            await SecretManager.getInstance().storeApiKey(selected.value, apiKey);
            vscode.window.showInformationMessage(`API Key for ${selected.label} has been saved securely.`);
        }
    );

    // Register Delete API Key Command
    const deleteApiKeyCommand = vscode.commands.registerCommand(
        'git-comment.deleteApiKey',
        async () => {
            const providers: { label: string; value: ProviderType }[] = [
                { label: 'Google Gemini', value: 'gemini' },
                { label: 'OpenAI', value: 'openai' },
                { label: 'Anthropic Claude', value: 'anthropic' },
                { label: 'Groq', value: 'groq' },
                { label: 'DeepSeek', value: 'deepseek' },
                { label: 'OpenRouter', value: 'openrouter' },
                { label: 'Ollama', value: 'ollama' }
            ];

            const selected = await vscode.window.showQuickPick(providers, {
                placeHolder: 'Select the AI provider to delete the API Key for'
            });

            if (!selected) {
                return;
            }

            await SecretManager.getInstance().deleteApiKey(selected.value);
            vscode.window.showInformationMessage(`API Key for ${selected.label} has been deleted.`);
        }
    );

    // Register Configure Extension Command (Settings Webview GUI)
    const configureCommand = vscode.commands.registerCommand(
        'git-comment.configureExtension',
        () => {
            SettingsWebview.createOrShow(context);
        }
    );

    context.subscriptions.push(generateCommand, setApiKeyCommand, deleteApiKeyCommand, configureCommand);
}

export function deactivate() {}

function getExtensionConfig(): ExtensionConfig {
    const config = vscode.workspace.getConfiguration('git-comment');
    
    return {
        provider: config.get<ProviderType>('provider', 'gemini'),
        promptTemplate: config.get<string>('promptTemplate', ''),
        useConventionalCommits: config.get<boolean>('useConventionalCommits', true),
        openai: {
            model: config.get<string>('openai.model', 'gpt-4o-mini'),
            baseUrl: config.get<string>('openai.baseUrl', 'https://api.openai.com/v1')
        },
        gemini: {
            model: config.get<string>('gemini.model', 'gemini-1.5-flash')
        },
        anthropic: {
            model: config.get<string>('anthropic.model', 'claude-3-5-sonnet-latest')
        },
        groq: {
            model: config.get<string>('groq.model', 'llama-3.1-70b-versatile')
        },
        deepseek: {
            model: config.get<string>('deepseek.model', 'deepseek-coder')
        },
        ollama: {
            model: config.get<string>('ollama.model', 'codellama'),
            baseUrl: config.get<string>('ollama.baseUrl', 'http://localhost:11434/v1')
        },
        openrouter: {
            model: config.get<string>('openrouter.model', 'google/gemini-2.5-flash')
        }
    };
}
