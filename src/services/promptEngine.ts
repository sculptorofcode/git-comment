import { ExtensionConfig } from '../types';

export class PromptEngine {
    private static readonly DEFAULT_TEMPLATE = `Write a clean and concise git commit message for the following git diff.
Only output the commit message. Do NOT wrap the message in markdown code blocks, do not write "Here is the commit message:", and do not include any other explanations or introductory text.

Structure:
- A short summary line (maximum 50 characters)
- A blank line
- A body explaining the changes (maximum 72 characters per line)

Git Diff:
{{diff}}`;

    private static readonly CONVENTIONAL_TEMPLATE = `Write a clean and concise git commit message following the Conventional Commits specification for the git diff below.
Only output the commit message. Do NOT wrap the message in markdown code blocks, do not write "Here is the commit message:", and do not include any other explanations or introductory text.

Format: <type>(<scope>): <subject>

Types:
- feat: A new feature
- fix: A bug fix
- docs: Documentation changes
- style: Changes that do not affect the meaning of the code (formatting, missing semi-colons, etc.)
- refactor: A code change that neither fixes a bug nor adds a feature
- perf: A code change that improves performance
- test: Adding missing tests or correcting existing tests
- chore: Changes to the build process or auxiliary tools and libraries

Structure:
- A title matching the Conventional Commits format (maximum 50 characters)
- A blank line
- A body explaining what was changed and why (maximum 72 characters per line)

Git Diff:
{{diff}}`;

    /**
     * Builds the prompt to be sent to the AI provider.
     * @param diff The staged git diff.
     * @param config The current extension configuration.
     */
    public static buildPrompt(diff: string, config: ExtensionConfig, userComment?: string): string {
        let template = config.promptTemplate;

        // If no custom template is provided, use the default based on Conventional Commits flag
        if (!template) {
            template = config.useConventionalCommits 
                ? this.CONVENTIONAL_TEMPLATE 
                : this.DEFAULT_TEMPLATE;
        }

        // Replace the placeholder {{diff}} with the actual diff
        let prompt = template.includes('{{diff}}') 
            ? template.replace('{{diff}}', diff)
            : `${template}\n\nGit Diff:\n${diff}`;

        // Inject user comment/context if provided
        if (userComment && userComment.trim().length > 0) {
            prompt = `User's comment/context about this change: "${userComment.trim()}"\nYou MUST incorporate the user's comment/context into the commit message where appropriate (e.g. to explain the 'why' of the change or specify details).\n\n${prompt}`;
        }

        return prompt;
    }
}
