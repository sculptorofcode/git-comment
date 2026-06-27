# Git Comment

## Overview

Git Comment is an open-source VS Code extension that helps developers generate high-quality Git-related content using multiple AI providers.

The project is provider-agnostic and focuses on improving the Git workflow rather than locking users into a specific AI model.

---

# Vision

Build the best AI Git Assistant for developers.

Git Comment should assist developers throughout the entire Git lifecycle, including commits, pull requests, code reviews, releases, and repository management.

---

# Core Principles

* Provider agnostic
* Privacy first
* Bring Your Own API Key
* Local LLM support
* Fast and lightweight
* Extensible architecture
* Excellent developer experience
* Open source first

---

# Supported AI Providers

* OpenAI
* OpenRouter
* Google Gemini
* Anthropic Claude
* Groq
* DeepSeek
* Ollama
* Any OpenAI-compatible API

Adding new providers should require minimal changes.

---

# Version 1 Features

* AI-generated Git commit messages
* Conventional Commit support
* Custom prompt templates
* Multiple AI providers
* Secure API key storage
* Generate from staged Git diff
* One-click commit generation

---

# Future Roadmap

## Git

* Commit messages
* Branch name suggestions
* Explain Git diff
* Commit history summaries
* Git command explanations

## Pull Requests

* PR titles
* PR descriptions
* Review summaries

## Code Review

* AI review comments
* Suggest improvements
* Security hints
* Performance suggestions

## Releases

* Changelog generation
* Release notes
* Version summaries

## Productivity

* Prompt library
* Team prompt sharing
* Workspace profiles
* Prompt history
* Favorite models

---

# Tech Stack

* TypeScript
* VS Code Extension API
* Node.js
* Git CLI / Git Extension API
* esbuild

---

# Architecture

The project must follow a modular architecture.

* Providers
* Git Services
* Prompt Engine
* Commands
* UI
* Storage
* Utilities

Every AI provider should implement a common interface.

Avoid provider-specific logic outside the provider layer.

---

# Coding Standards

* Prefer composition over inheritance.
* Write clean and readable code.
* Keep functions small.
* Use async/await.
* Handle errors gracefully.
* Add JSDoc for public APIs.
* Maintain consistent naming.
* Avoid unnecessary dependencies.

---

# Security

* Never log API keys.
* Store secrets using VS Code SecretStorage.
* Validate all external inputs.
* Never send repository contents without explicit user action.

---

# UX Principles

* One-click workflows.
* Minimal configuration.
* Fast responses.
* Clear error messages.
* Respect user privacy.
* Do not interrupt developer flow.

---

# Long-Term Goal

Git Comment should become the developer's AI companion for every Git operation, supporting both cloud and local AI models while remaining fast, secure, extensible, and open source.
