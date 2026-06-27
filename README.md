# Git Comment

Git Comment is a fast, secure, and provider-agnostic VS Code extension that automatically generates high-quality Git commit messages from your changes using state-of-the-art AI models.

## ✨ Features

- **One-Click Commit Generation**: Click the sparkles `(✨)` icon in the Source Control view title to instantly generate commit messages.
- **Staged & Unstaged Fallback**: Automatically reads staged changes, or falls back to unstaged working tree changes if nothing is staged.
- **Real-Time Streaming**: Watch the commit message write itself character-by-character directly into your Source Control input box.
- **Interactive Settings GUI**: Customize your settings using a beautiful dashboard. Configure active providers, model names, and prompt templates easily.
- **Secure Key Storage**: Credentials and API keys are stored securely using VS Code's `SecretStorage` (never saved in plain-text configuration files).
- **Conventional Commits**: Built-in support for the Conventional Commits specification (e.g. `feat(auth): add google sign-in`, `fix(style): resolve form alignment`).
- **Bring Your Own Key (BYOK)**: Supports multiple cloud and local providers out-of-the-box:
  - Google Gemini
  - OpenAI (or any OpenAI-compatible API)
  - Anthropic Claude
  - Groq
  - DeepSeek
  - OpenRouter
  - Ollama (Local LLMs)

---

## 🚀 How to Use

1. **Modify Files**: Edit any files in your workspace.
2. **Open Source Control**: Open the VS Code Source Control view (`Ctrl + Shift + G`).
3. **Generate**: Click the Sparkle `(✨)` button in the SCM title menu (or run **`Git Comment: Generate Commit Message`** from the Command Palette).
4. **Enter API Key**: On the first run, the extension will prompt you to enter the API Key for your active provider. It will be saved securely.

---

## ⚙️ Configuration

Open the Command Palette (`Ctrl + Shift + P`) and run **`Git Comment: Settings`** to open the interactive settings panel.

You can also search for `git-comment` in the standard VS Code settings to configure:
- `git-comment.provider`: Active AI provider.
- `git-comment.useConventionalCommits`: Enable or disable Conventional Commits structure.
- `git-comment.promptTemplate`: Custom instructions for the AI generator.
- `<provider>.model`: Custom model name for the selected provider.
- `<provider>.baseUrl`: Custom endpoints (for Ollama or OpenAI-compatible APIs).

---

## 🔒 Security

- Your API keys are saved securely in VS Code's credential store.
- Your code diffs are **only** sent to your configured AI provider when you explicitly click the generate button.
- Plain-text logs never expose your keys.
