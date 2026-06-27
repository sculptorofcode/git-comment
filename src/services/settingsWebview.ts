import * as vscode from 'vscode';
import { ExtensionConfig, ProviderType } from '../types';
import { SecretManager } from './secretManager';

export class SettingsWebview {
    private static currentPanel: SettingsWebview | undefined;
    private readonly panel: vscode.WebviewPanel;
    private disposables: vscode.Disposable[] = [];

    private constructor(panel: vscode.WebviewPanel) {
        this.panel = panel;
        
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        this.panel.webview.onDidReceiveMessage(
            message => this.handleMessage(message),
            null,
            this.disposables
        );
        this.updateHtml();
    }

    /**
     * Creates or shows the settings webview panel.
     */
    public static createOrShow(_context: vscode.ExtensionContext): void {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (SettingsWebview.currentPanel) {
            SettingsWebview.currentPanel.panel.reveal(column);
            SettingsWebview.currentPanel.updateHtml();
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'gitCommentSettings',
            'Git Comment Settings',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: []
            }
        );

        SettingsWebview.currentPanel = new SettingsWebview(panel);
    }

    /**
     * Disposes the webview panel and clean up resources.
     */
    public dispose() {
        SettingsWebview.currentPanel = undefined;
        this.panel.dispose();
        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }

    /**
     * Updates the webview panel HTML with the latest configuration and API key statuses.
     */
    private async updateHtml() {
        this.panel.webview.html = '<div style="padding: 20px; font-family: sans-serif; color: #ccc;">Loading Settings...</div>';
        const initialData = await this.getInitialData();
        this.panel.webview.html = this.getHtmlContent(initialData);
    }

    /**
     * Gathers all extension settings and API key statuses for rendering.
     */
    private async getInitialData() {
        const config = vscode.workspace.getConfiguration('git-comment');
        
        const extensionConfig: ExtensionConfig = {
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

        const secretManager = SecretManager.getInstance();
        const providers: ProviderType[] = ['gemini', 'openai', 'anthropic', 'groq', 'deepseek', 'openrouter', 'ollama'];
        const apiKeysStatus: Record<string, boolean> = {};

        for (const provider of providers) {
            const key = await secretManager.getApiKey(provider);
            apiKeysStatus[provider] = !!key;
        }

        return {
            config: extensionConfig,
            apiKeysStatus
        };
    }

    /**
     * Handles messages sent from the Webview (using vscode.postMessage).
     */
    private async handleMessage(message: any) {
        const config = vscode.workspace.getConfiguration('git-comment');
        const secretManager = SecretManager.getInstance();

        try {
            switch (message.command) {
                case 'saveSettings':
                    const data = message.data as ExtensionConfig;
                    
                    // Save standard settings
                    await config.update('provider', data.provider, vscode.ConfigurationTarget.Global);
                    await config.update('useConventionalCommits', data.useConventionalCommits, vscode.ConfigurationTarget.Global);
                    await config.update('promptTemplate', data.promptTemplate, vscode.ConfigurationTarget.Global);
                    
                    // Save provider specific models & urls
                    await config.update('gemini.model', data.gemini.model, vscode.ConfigurationTarget.Global);
                    await config.update('openai.model', data.openai.model, vscode.ConfigurationTarget.Global);
                    await config.update('openai.baseUrl', data.openai.baseUrl, vscode.ConfigurationTarget.Global);
                    await config.update('anthropic.model', data.anthropic.model, vscode.ConfigurationTarget.Global);
                    await config.update('groq.model', data.groq.model, vscode.ConfigurationTarget.Global);
                    await config.update('deepseek.model', data.deepseek.model, vscode.ConfigurationTarget.Global);
                    await config.update('openrouter.model', data.openrouter.model, vscode.ConfigurationTarget.Global);
                    await config.update('ollama.model', data.ollama.model, vscode.ConfigurationTarget.Global);
                    await config.update('ollama.baseUrl', data.ollama.baseUrl, vscode.ConfigurationTarget.Global);

                    vscode.window.showInformationMessage('Git Comment settings saved successfully.');
                    this.panel.webview.postMessage({ command: 'saveSuccess' });
                    break;

                case 'saveApiKey':
                    const { provider, apiKey } = message;
                    if (apiKey && apiKey.trim().length > 0) {
                        await secretManager.storeApiKey(provider, apiKey.trim());
                        vscode.window.showInformationMessage(`API Key for ${provider} saved securely.`);
                        this.panel.webview.postMessage({ 
                            command: 'keyStatusUpdate', 
                            provider, 
                            hasKey: true 
                        });
                    }
                    break;

                case 'deleteApiKey':
                    const provToDelete = message.provider;
                    await secretManager.deleteApiKey(provToDelete);
                    vscode.window.showInformationMessage(`API Key for ${provToDelete} removed.`);
                    this.panel.webview.postMessage({ 
                        command: 'keyStatusUpdate', 
                        provider: provToDelete, 
                        hasKey: false 
                    });
                    break;

                case 'close':
                    this.dispose();
                    break;
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Failed to perform settings operation: ${error.message}`);
        }
    }

    /**
     * HTML template containing custom vanilla CSS and Javascript.
     */
    private getHtmlContent(initialData: { config: ExtensionConfig; apiKeysStatus: Record<string, boolean> }): string {
        const configJson = JSON.stringify(initialData.config);
        const apiKeysJson = JSON.stringify(initialData.apiKeysStatus);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Git Comment Settings</title>
    <style>
        :root {
            --bg-main: #1e1e24;
            --bg-card: #25252e;
            --bg-hover: #2f2f3b;
            --border-color: #383846;
            --text-main: #f0f0f5;
            --text-secondary: #a0a0b8;
            --accent: #7c4dff;
            --accent-glow: rgba(124, 77, 255, 0.4);
            --accent-success: #00e676;
            --accent-error: #ff1744;
            --input-bg: #15151a;
        }

        body {
            background-color: var(--bg-main);
            color: var(--text-main);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            margin: 0;
            padding: 0;
            display: flex;
            height: 100vh;
            overflow: hidden;
            font-size: 14px;
        }

        /* Sidebar Navigation */
        .sidebar {
            width: 220px;
            background-color: #17171d;
            border-right: 1px solid var(--border-color);
            display: flex;
            flex-direction: column;
            padding: 20px 0;
            box-sizing: border-box;
        }

        .sidebar-title {
            padding: 0 20px 20px 20px;
            font-size: 16px;
            font-weight: 600;
            letter-spacing: 1px;
            color: var(--text-main);
            border-bottom: 1px solid var(--border-color);
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 8px;
        }

        .tab-btn {
            background: none;
            border: none;
            color: var(--text-secondary);
            padding: 12px 20px;
            text-align: left;
            font-size: 13px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.25s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            width: 100%;
        }

        .tab-btn:hover {
            color: var(--text-main);
            background-color: var(--bg-hover);
        }

        .tab-btn.active {
            color: var(--text-main);
            background-color: var(--bg-card);
            border-left: 4px solid var(--accent);
            padding-left: 16px;
        }

        /* Main Content Container */
        .content {
            flex: 1;
            padding: 30px;
            overflow-y: auto;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
        }

        .tab-content {
            display: none;
            flex-direction: column;
            gap: 20px;
            animation: fadeIn 0.3s ease;
        }

        .tab-content.active {
            display: flex;
        }

        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(5px); }
            to { opacity: 1; transform: translateY(0); }
        }

        h2 {
            margin-top: 0;
            margin-bottom: 10px;
            font-size: 18px;
            font-weight: 600;
        }

        p.description {
            color: var(--text-secondary);
            margin-top: 0;
            margin-bottom: 20px;
            line-height: 1.5;
        }

        /* Card System */
        .card {
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 20px;
            box-sizing: border-box;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }

        .form-group {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-bottom: 18px;
        }

        .form-group:last-child {
            margin-bottom: 0;
        }

        label {
            font-weight: 600;
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-secondary);
        }

        /* Inputs */
        input[type="text"], select, textarea {
            background-color: var(--input-bg);
            border: 1px solid var(--border-color);
            color: var(--text-main);
            padding: 10px 12px;
            border-radius: 6px;
            font-size: 13px;
            outline: none;
            transition: border-color 0.2s, box-shadow 0.2s;
            font-family: inherit;
        }

        input[type="text"]:focus, select:focus, textarea:focus {
            border-color: var(--accent);
            box-shadow: 0 0 0 3px var(--accent-glow);
        }

        textarea {
            resize: vertical;
            min-height: 150px;
            font-family: "Courier New", Courier, monospace;
        }

        .row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        /* Switch toggle button */
        .switch-group {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background-color: var(--bg-card);
            border: 1px solid var(--border-color);
            border-radius: 8px;
            padding: 15px 20px;
            margin-bottom: 18px;
        }

        .switch-label-desc {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .switch-title {
            font-weight: 600;
        }

        .switch-desc {
            color: var(--text-secondary);
            font-size: 12px;
        }

        .switch {
            position: relative;
            display: inline-block;
            width: 46px;
            height: 24px;
        }

        .switch input {
            opacity: 0;
            width: 0;
            height: 0;
        }

        .slider {
            position: absolute;
            cursor: pointer;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background-color: var(--input-bg);
            transition: .3s;
            border-radius: 24px;
            border: 1px solid var(--border-color);
        }

        .slider:before {
            position: absolute;
            content: "";
            height: 16px;
            width: 16px;
            left: 3px;
            bottom: 3px;
            background-color: var(--text-secondary);
            transition: .3s;
            border-radius: 50%;
        }

        input:checked + .slider {
            background-color: var(--accent);
            border-color: var(--accent);
        }

        input:checked + .slider:before {
            transform: translateX(22px);
            background-color: white;
        }

        /* Key lists card */
        .key-row {
            display: grid;
            grid-template-columns: 180px 1fr auto;
            align-items: center;
            gap: 15px;
            padding: 12px 0;
            border-bottom: 1px solid var(--border-color);
        }

        .key-row:last-child {
            border-bottom: none;
            padding-bottom: 0;
        }

        .key-provider-name {
            font-weight: 600;
            color: var(--text-main);
        }

        .key-status-tag {
            font-size: 11px;
            padding: 4px 8px;
            border-radius: 4px;
            font-weight: 600;
            width: fit-content;
        }

        .key-status-tag.configured {
            background-color: rgba(0, 230, 118, 0.15);
            color: var(--accent-success);
        }

        .key-status-tag.missing {
            background-color: rgba(255, 23, 68, 0.15);
            color: var(--accent-error);
        }

        /* Buttons */
        .btn {
            background-color: var(--accent);
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            font-size: 13px;
            font-weight: 600;
            cursor: pointer;
            transition: background-color 0.2s, transform 0.1s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 8px;
            width: fit-content;
        }

        .btn:hover {
            background-color: #6200ea;
        }

        .btn:active {
            transform: scale(0.98);
        }

        .btn-secondary {
            background: none;
            border: 1px solid var(--border-color);
            color: var(--text-main);
        }

        .btn-secondary:hover {
            background-color: var(--bg-hover);
        }

        .btn-error {
            background: none;
            border: 1px solid var(--accent-error);
            color: var(--accent-error);
            padding: 6px 12px;
            font-size: 12px;
        }

        .btn-error:hover {
            background-color: rgba(255, 23, 68, 0.1);
        }

        .btn-save {
            margin-top: 15px;
            padding: 12px 24px;
            font-size: 14px;
        }

        .key-input-container {
            display: flex;
            gap: 10px;
            width: 100%;
        }

        .key-input-container input {
            flex: 1;
        }

        /* Footer / Meta info */
        .footer {
            margin-top: auto;
            padding: 0 20px;
            font-size: 11px;
            color: var(--text-secondary);
            text-align: center;
            border-top: 1px solid var(--border-color);
            padding-top: 15px;
        }
    </style>
</head>
<body>
    <div class="sidebar">
        <div class="sidebar-title">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            Git Comment
        </div>
        <button class="tab-btn active" onclick="switchTab(event, 'general-tab')">
            General Settings
        </button>
        <button class="tab-btn" onclick="switchTab(event, 'providers-tab')">
            AI Providers
        </button>
        <button class="tab-btn" onclick="switchTab(event, 'keys-tab')">
            API Keys Secure
        </button>
        <button class="tab-btn" onclick="switchTab(event, 'prompt-tab')">
            Prompt Template
        </button>

        <div class="footer">
            v0.1.0 &bull; Open Source
        </div>
    </div>

    <div class="content">
        <!-- GENERAL TAB -->
        <div id="general-tab" class="tab-content active">
            <h2>General Settings</h2>
            <p class="description">Configure the active AI provider and Conventional Commits options.</p>

            <div class="card">
                <div class="form-group">
                    <label for="provider-select">Active AI Provider</label>
                    <select id="provider-select" onchange="onProviderChange()">
                        <option value="gemini">Google Gemini</option>
                        <option value="openai">OpenAI</option>
                        <option value="anthropic">Anthropic Claude</option>
                        <option value="groq">Groq</option>
                        <option value="deepseek">DeepSeek</option>
                        <option value="openrouter">OpenRouter</option>
                        <option value="ollama">Ollama (Local LLM)</option>
                    </select>
                </div>
            </div>

            <div class="switch-group">
                <div class="switch-label-desc">
                    <div class="switch-title">Conventional Commits</div>
                    <div class="switch-desc">Enforce formatting specification (e.g. feat: add login, fix: resolve leak).</div>
                </div>
                <label class="switch">
                    <input type="checkbox" id="conventional-checkbox">
                    <span class="slider"></span>
                </label>
            </div>

            <button class="btn btn-save" onclick="saveAllSettings()">Save Configuration</button>
        </div>

        <!-- PROVIDERS TAB -->
        <div id="providers-tab" class="tab-content">
            <h2>AI Providers Configuration</h2>
            <p class="description">Select models and custom endpoints for individual providers.</p>

            <!-- Gemini Config Card -->
            <div class="card provider-config-card" id="gemini-config-card">
                <h3>Google Gemini</h3>
                <div class="form-group">
                    <label for="gemini-model">Model Name</label>
                    <input type="text" id="gemini-model" placeholder="gemini-1.5-flash">
                </div>
            </div>

            <!-- OpenAI Config Card -->
            <div class="card provider-config-card" id="openai-config-card" style="margin-top: 15px;">
                <h3>OpenAI / Compatible</h3>
                <div class="row">
                    <div class="form-group">
                        <label for="openai-model">Model Name</label>
                        <input type="text" id="openai-model" placeholder="gpt-4o-mini">
                    </div>
                    <div class="form-group">
                        <label for="openai-baseurl">API Base URL</label>
                        <input type="text" id="openai-baseurl" placeholder="https://api.openai.com/v1">
                    </div>
                </div>
            </div>

            <!-- Anthropic Config Card -->
            <div class="card provider-config-card" id="anthropic-config-card" style="margin-top: 15px;">
                <h3>Anthropic Claude</h3>
                <div class="form-group">
                    <label for="anthropic-model">Model Name</label>
                    <input type="text" id="anthropic-model" placeholder="claude-3-5-sonnet-latest">
                </div>
            </div>

            <!-- Groq Config Card -->
            <div class="card provider-config-card" id="groq-config-card" style="margin-top: 15px;">
                <h3>Groq</h3>
                <div class="form-group">
                    <label for="groq-model">Model Name</label>
                    <input type="text" id="groq-model" placeholder="llama-3.1-70b-versatile">
                </div>
            </div>

            <!-- DeepSeek Config Card -->
            <div class="card provider-config-card" id="deepseek-config-card" style="margin-top: 15px;">
                <h3>DeepSeek</h3>
                <div class="form-group">
                    <label for="deepseek-model">Model Name</label>
                    <input type="text" id="deepseek-model" placeholder="deepseek-coder">
                </div>
            </div>

            <!-- OpenRouter Config Card -->
            <div class="card provider-config-card" id="openrouter-config-card" style="margin-top: 15px;">
                <h3>OpenRouter</h3>
                <div class="form-group">
                    <label for="openrouter-model">Model Name</label>
                    <input type="text" id="openrouter-model" placeholder="google/gemini-2.5-flash">
                </div>
            </div>

            <!-- Ollama Config Card -->
            <div class="card provider-config-card" id="ollama-config-card" style="margin-top: 15px;">
                <h3>Ollama (Local)</h3>
                <div class="row">
                    <div class="form-group">
                        <label for="ollama-model">Model Name</label>
                        <input type="text" id="ollama-model" placeholder="codellama">
                    </div>
                    <div class="form-group">
                        <label for="ollama-baseurl">API Base URL</label>
                        <input type="text" id="ollama-baseurl" placeholder="http://localhost:11434/v1">
                    </div>
                </div>
            </div>

            <button class="btn btn-save" onclick="saveAllSettings()">Save Configuration</button>
        </div>

        <!-- API KEYS TAB -->
        <div id="keys-tab" class="tab-content">
            <h2>Secure API Keys</h2>
            <p class="description">Manage API keys securely. Keys are saved in VS Code SecretStorage, not in plain config.</p>

            <div class="card">
                <!-- Gemini Key -->
                <div class="key-row">
                    <div>
                        <div class="key-provider-name">Google Gemini</div>
                        <span id="gemini-key-status" class="key-status-tag"></span>
                    </div>
                    <div class="key-input-container">
                        <input type="password" id="gemini-key-input" placeholder="Paste Gemini API Key..." style="background-color: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 6px 12px; border-radius: 4px; outline: none; font-size: 12px; width: 100%;">
                        <button class="btn" onclick="saveKey('gemini')">Save</button>
                    </div>
                    <button class="btn btn-error" id="gemini-delete-btn" onclick="deleteKey('gemini')">Delete</button>
                </div>

                <!-- OpenAI Key -->
                <div class="key-row">
                    <div>
                        <div class="key-provider-name">OpenAI</div>
                        <span id="openai-key-status" class="key-status-tag"></span>
                    </div>
                    <div class="key-input-container">
                        <input type="password" id="openai-key-input" placeholder="Paste OpenAI API Key..." style="background-color: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 6px 12px; border-radius: 4px; outline: none; font-size: 12px; width: 100%;">
                        <button class="btn" onclick="saveKey('openai')">Save</button>
                    </div>
                    <button class="btn btn-error" id="openai-delete-btn" onclick="deleteKey('openai')">Delete</button>
                </div>

                <!-- Anthropic Key -->
                <div class="key-row">
                    <div>
                        <div class="key-provider-name">Anthropic Claude</div>
                        <span id="anthropic-key-status" class="key-status-tag"></span>
                    </div>
                    <div class="key-input-container">
                        <input type="password" id="anthropic-key-input" placeholder="Paste Anthropic API Key..." style="background-color: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 6px 12px; border-radius: 4px; outline: none; font-size: 12px; width: 100%;">
                        <button class="btn" onclick="saveKey('anthropic')">Save</button>
                    </div>
                    <button class="btn btn-error" id="anthropic-delete-btn" onclick="deleteKey('anthropic')">Delete</button>
                </div>

                <!-- Groq Key -->
                <div class="key-row">
                    <div>
                        <div class="key-provider-name">Groq</div>
                        <span id="groq-key-status" class="key-status-tag"></span>
                    </div>
                    <div class="key-input-container">
                        <input type="password" id="groq-key-input" placeholder="Paste Groq API Key..." style="background-color: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 6px 12px; border-radius: 4px; outline: none; font-size: 12px; width: 100%;">
                        <button class="btn" onclick="saveKey('groq')">Save</button>
                    </div>
                    <button class="btn btn-error" id="groq-delete-btn" onclick="deleteKey('groq')">Delete</button>
                </div>

                <!-- DeepSeek Key -->
                <div class="key-row">
                    <div>
                        <div class="key-provider-name">DeepSeek</div>
                        <span id="deepseek-key-status" class="key-status-tag"></span>
                    </div>
                    <div class="key-input-container">
                        <input type="password" id="deepseek-key-input" placeholder="Paste DeepSeek API Key..." style="background-color: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 6px 12px; border-radius: 4px; outline: none; font-size: 12px; width: 100%;">
                        <button class="btn" onclick="saveKey('deepseek')">Save</button>
                    </div>
                    <button class="btn btn-error" id="deepseek-delete-btn" onclick="deleteKey('deepseek')">Delete</button>
                </div>

                <!-- OpenRouter Key -->
                <div class="key-row">
                    <div>
                        <div class="key-provider-name">OpenRouter</div>
                        <span id="openrouter-key-status" class="key-status-tag"></span>
                    </div>
                    <div class="key-input-container">
                        <input type="password" id="openrouter-key-input" placeholder="Paste OpenRouter API Key..." style="background-color: var(--input-bg); border: 1px solid var(--border-color); color: white; padding: 6px 12px; border-radius: 4px; outline: none; font-size: 12px; width: 100%;">
                        <button class="btn" onclick="saveKey('openrouter')">Save</button>
                    </div>
                    <button class="btn btn-error" id="openrouter-delete-btn" onclick="deleteKey('openrouter')">Delete</button>
                </div>
            </div>
        </div>

        <!-- PROMPT TEMPLATE TAB -->
        <div id="prompt-tab" class="tab-content">
            <h2>Custom Prompt Template</h2>
            <p class="description">Customize the exact instructions sent to the AI model. Ensure you include the <code>{{diff}}</code> placeholder.</p>

            <div class="card">
                <div class="form-group">
                    <label for="template-textarea">Prompt Template</label>
                    <textarea id="template-textarea" placeholder="Write a clean and concise git commit message... Use {{diff}} for the git changes."></textarea>
                </div>
            </div>

            <button class="btn btn-save" onclick="saveAllSettings()">Save Configuration</button>
        </div>
    </div>

    <script>
        const vscode = acquireVsCodeApi();
        
        // Initial configuration values injected by the extension
        const currentData = ${configJson};
        const apiKeysStatus = ${apiKeysJson};

        // Populate fields on load
        document.addEventListener('DOMContentLoaded', () => {
            // Populate General Settings
            document.getElementById('provider-select').value = currentData.provider;
            document.getElementById('conventional-checkbox').checked = currentData.useConventionalCommits;

            // Populate Providers Details
            document.getElementById('gemini-model').value = currentData.gemini.model;
            document.getElementById('openai-model').value = currentData.openai.model;
            document.getElementById('openai-baseurl').value = currentData.openai.baseUrl;
            document.getElementById('anthropic-model').value = currentData.anthropic.model;
            document.getElementById('groq-model').value = currentData.groq.model;
            document.getElementById('deepseek-model').value = currentData.deepseek.model;
            document.getElementById('openrouter-model').value = currentData.openrouter.model;
            document.getElementById('ollama-model').value = currentData.ollama.model;
            document.getElementById('ollama-baseurl').value = currentData.ollama.baseUrl;

            // Populate Prompt Template
            document.getElementById('template-textarea').value = currentData.promptTemplate;

            // Update API Key fields & tags
            updateApiKeyUI();
            onProviderChange(); // Trigger initial view filter
        });

        function updateApiKeyUI() {
            const providers = ['gemini', 'openai', 'anthropic', 'groq', 'deepseek', 'openrouter'];
            providers.forEach(p => {
                const statusTag = document.getElementById(p + '-key-status');
                const deleteBtn = document.getElementById(p + '-delete-btn');
                const keyInput = document.getElementById(p + '-key-input');

                if (apiKeysStatus[p]) {
                    statusTag.textContent = 'Configured';
                    statusTag.className = 'key-status-tag configured';
                    deleteBtn.style.display = 'block';
                    keyInput.placeholder = '•••••••••••••••• (API Key Saved)';
                } else {
                    statusTag.textContent = 'Missing';
                    statusTag.className = 'key-status-tag missing';
                    deleteBtn.style.display = 'none';
                    keyInput.placeholder = 'Paste ' + p.toUpperCase() + ' API Key...';
                }
                keyInput.value = '';
            });
        }

        // Handle Tab Switching
        function switchTab(evt, tabId) {
            const tabContents = document.getElementsByClassName('tab-content');
            for (let i = 0; i < tabContents.length; i++) {
                tabContents[i].classList.remove('active');
            }

            const tabBtns = document.getElementsByClassName('tab-btn');
            for (let i = 0; i < tabBtns.length; i++) {
                tabBtns[i].classList.remove('active');
            }

            document.getElementById(tabId).classList.add('active');
            evt.currentTarget.classList.add('active');
        }

        // When provider is changed, we can highlight relevant options or show/hide configs
        function onProviderChange() {
            const selected = document.getElementById('provider-select').value;
            const cards = document.getElementsByClassName('provider-config-card');
            for (let i = 0; i < cards.length; i++) {
                cards[i].style.borderColor = 'var(--border-color)';
            }
            const activeCard = document.getElementById(selected + '-config-card');
            if (activeCard) {
                activeCard.style.borderColor = 'var(--accent)';
            }
        }

        // Save Standard settings
        function saveAllSettings() {
            const updatedConfig = {
                provider: document.getElementById('provider-select').value,
                useConventionalCommits: document.getElementById('conventional-checkbox').checked,
                promptTemplate: document.getElementById('template-textarea').value,
                gemini: {
                    model: document.getElementById('gemini-model').value
                },
                openai: {
                    model: document.getElementById('openai-model').value,
                    baseUrl: document.getElementById('openai-baseurl').value
                },
                anthropic: {
                    model: document.getElementById('anthropic-model').value
                },
                groq: {
                    model: document.getElementById('groq-model').value
                },
                deepseek: {
                    model: document.getElementById('deepseek-model').value
                },
                openrouter: {
                    model: document.getElementById('openrouter-model').value
                },
                ollama: {
                    model: document.getElementById('ollama-model').value,
                    baseUrl: document.getElementById('ollama-baseurl').value
                }
            };

            vscode.postMessage({
                command: 'saveSettings',
                data: updatedConfig
            });
        }

        // Save Specific API Key
        function saveKey(provider) {
            const apiKey = document.getElementById(provider + '-key-input').value;
            if (!apiKey || apiKey.trim().length === 0) {
                return;
            }
            vscode.postMessage({
                command: 'saveApiKey',
                provider: provider,
                apiKey: apiKey
            });
        }

        // Delete API Key
        function deleteKey(provider) {
            vscode.postMessage({
                command: 'deleteApiKey',
                provider: provider
            });
        }

        // Listen for messages from extension to update UI dynamically without reload
        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.command) {
                case 'keyStatusUpdate':
                    apiKeysStatus[message.provider] = message.hasKey;
                    updateApiKeyUI();
                    break;
                case 'saveSuccess':
                    // Settings saved successfully
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
