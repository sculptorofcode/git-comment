import * as vscode from 'vscode';
import { GitExtension, API, Repository, Change } from '../git';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class GitService {
    private static instance: GitService;
    private static outputChannel = vscode.window.createOutputChannel('Git Comment');
    private gitAPI?: API;

    public static log(message: string) {
        this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
    }

    private constructor() {
        this.init();
    }

    /**
     * Gets the singleton instance of the GitService.
     */
    public static getInstance(): GitService {
        if (!GitService.instance) {
            GitService.instance = new GitService();
        }
        return GitService.instance;
    }

    /**
     * Initializes the Git extension API wrapper.
     */
    private init(): void {
        try {
            const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git')?.exports;
            if (gitExtension) {
                this.gitAPI = gitExtension.getAPI(1);
            }
        } catch (error) {
            console.error('Failed to initialize GitService:', error);
        }
    }

    /**
     * Returns the underlying Git extension API instance.
     */
    public getAPI(): API | undefined {
        if (!this.gitAPI) {
            this.init();
        }
        return this.gitAPI;
    }

    /**
     * Gets all repositories currently open in VS Code.
     */
    public getRepositories(): Repository[] {
        return this.getAPI()?.repositories || [];
    }

    /**
     * Gets the active Git repository.
     * It tries to find the repository associated with the active text editor's file.
     * If not found or no editor is active, it returns the first repository.
     */
    public getActiveRepository(): Repository | undefined {
        const repositories = this.getRepositories();
        if (repositories.length === 0) {
            return undefined;
        }
        if (repositories.length === 1) {
            return repositories[0];
        }

        // If there are multiple repos, try to find the one matching the active editor
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const fileUri = activeEditor.document.uri;
            const matchingRepo = repositories.find(repo => 
                fileUri.fsPath.startsWith(repo.rootUri.fsPath)
            );
            if (matchingRepo) {
                return matchingRepo;
            }
        }

        return repositories[0];
    }

    /**
     * Checks if the repository has any staged changes.
     */
    public hasStagedChanges(repository: Repository): boolean {
        return repository.state.indexChanges.length > 0;
    }

    /**
     * Checks if the repository has any changes (staged, unstaged, or untracked).
     */
    public hasChanges(repository: Repository): boolean {
        return repository.state.indexChanges.length > 0 || 
               repository.state.workingTreeChanges.length > 0 ||
               repository.state.untrackedChanges.length > 0;
    }

    /**
     * Returns the staged diff of the specified repository.
     * @param repository The Git repository to get the diff from.
     */
    public async getStagedDiff(repository: Repository): Promise<string> {
        try {
            // Get cached/staged changes diff (true indicates cached/staged)
            let diff = await repository.diff(true);
            if (!diff || diff.trim().length === 0) {
                diff = await this.runGitDiffFallback(repository, true);
            }
            return diff;
        } catch (error) {
            console.error('Failed to get staged diff:', error);
            throw new Error('Failed to retrieve staged diff from Git. Make sure Git is installed and configured.');
        }
    }

    /**
     * Helper to run git diff via CLI as a fallback.
     */
    private async runGitDiffFallback(repository: Repository, cached: boolean): Promise<string> {
        const gitPath = this.gitAPI?.git.path || 'git';
        const cwd = repository.rootUri.fsPath;
        const args = ['diff'];
        if (cached) {
            args.push('--cached');
        }
        const { stdout } = await execFileAsync(gitPath, args, { cwd });
        return stdout;
    }

    /**
     * Checks if a file is a binary file by extension and null byte check.
     */
    private isBinaryFile(filePath: string): boolean {
        const fs = require('fs');
        const binaryExtensions = /\.(png|jpg|jpeg|gif|webp|ico|pdf|zip|gz|tar|tgz|bz2|7z|rar|exe|dll|so|dylib|bin|woff|woff2|ttf|eot)$/i;
        if (binaryExtensions.test(filePath)) {
            return true;
        }

        try {
            const buffer = Buffer.alloc(1024);
            const fd = fs.openSync(filePath, 'r');
            const bytesRead = fs.readSync(fd, buffer, 0, 1024, 0);
            fs.closeSync(fd);
            for (let i = 0; i < bytesRead; i++) {
                if (buffer[i] === 0) {
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        }
    }

    /**
     * Returns the diff of changes. Prioritizes staged changes if present, otherwise returns unstaged changes diff.
     * @param repository The Git repository.
     */
    public async getDiff(repository: Repository): Promise<{ diff: string; isStaged: boolean; isDiffTooLarge?: boolean }> {
        GitService.log(`Starting getDiff. rootPath: ${repository.rootUri.fsPath}`);
        GitService.log(`Staged changes: ${repository.state.indexChanges.length}, Unstaged changes: ${repository.state.workingTreeChanges.length}, Untracked changes: ${repository.state.untrackedChanges.length}`);
        
        try {
            let diff = '';
            let isStaged = false;
            let fallbackError = '';

            if (this.hasStagedChanges(repository)) {
                GitService.log('Attempting to get staged diff via VS Code API...');
                diff = await repository.diff(true);
                isStaged = true;
                GitService.log(`VS Code API staged diff length: ${diff?.length || 0}`);
                if (!diff || diff.trim().length === 0) {
                    GitService.log('VS Code API staged diff was empty. Attempting Git CLI fallback...');
                    try {
                        diff = await this.runGitDiffFallback(repository, true);
                        GitService.log(`Fallback staged diff length: ${diff?.length || 0}`);
                    } catch (e: any) {
                        fallbackError = e.message || String(e);
                        GitService.log(`Fallback staged diff failed: ${fallbackError}`);
                    }
                }
            } else {
                GitService.log('Attempting to get unstaged diff via VS Code API...');
                diff = await repository.diff(false);
                isStaged = false;
                GitService.log(`VS Code API unstaged diff length: ${diff?.length || 0}`);
                if (!diff || diff.trim().length === 0) {
                    GitService.log('VS Code API unstaged diff was empty. Attempting Git CLI fallback...');
                    try {
                        diff = await this.runGitDiffFallback(repository, false);
                        GitService.log(`Fallback unstaged diff length: ${diff?.length || 0}`);
                    } catch (e: any) {
                        fallbackError = e.message || String(e);
                        GitService.log(`Fallback unstaged diff failed: ${fallbackError}`);
                    }
                }

                // Add untracked files contents formatted as addition diffs.
                // Note: VS Code Git extension may group untracked files under workingTreeChanges with status 7 (UNTRACKED).
                const untrackedChanges = [
                    ...(repository.state.untrackedChanges || []),
                    ...(repository.state.workingTreeChanges || []).filter(c => c.status === 7)
                ];
                GitService.log(`Processing untracked files. Count: ${untrackedChanges.length}`);
                if (untrackedChanges.length > 0) {
                    const fs = require('fs');
                    let untrackedDiff = '';
                    for (const change of untrackedChanges) {
                        try {
                            const filePath = change.uri.fsPath;
                            const stats = fs.statSync(filePath);
                            if (stats.isFile()) {
                                const relPath = vscode.workspace.asRelativePath(change.uri);
                                if (this.isBinaryFile(filePath)) {
                                    untrackedDiff += `\nBinary files /dev/null and b/${relPath} differ\n`;
                                    GitService.log(`Skipped reading binary file content for diff: ${relPath}`);
                                } else {
                                    const content = fs.readFileSync(filePath, 'utf8');
                                    untrackedDiff += `\n--- /dev/null\n+++ b/${relPath}\n@@ -0,0 +1,${content.split('\n').length} @@\n`;
                                    untrackedDiff += content.split('\n').map((line: string) => `+${line}`).join('\n') + '\n';
                                    GitService.log(`Added untracked file to diff: ${relPath}`);
                                }
                            }
                        } catch (e: any) {
                            GitService.log(`Failed to read untracked file ${change.uri.fsPath}: ${e.message}`);
                        }
                    }
                    if (untrackedDiff) {
                        diff = (diff + '\n' + untrackedDiff).trim();
                    }
                }
            }

            GitService.log(`Final diff length: ${diff?.length || 0}`);
            if (!diff || diff.trim().length === 0) {
                // Return details in error
                const details = `No changes found in the diff.
Repository Root: ${repository.rootUri.fsPath}
Staged Files: ${repository.state.indexChanges.map(c => vscode.workspace.asRelativePath(c.uri)).join(', ') || 'none'}
Unstaged Files: ${repository.state.workingTreeChanges.map(c => vscode.workspace.asRelativePath(c.uri)).join(', ') || 'none'}
Untracked Files: ${repository.state.untrackedChanges.map(c => vscode.workspace.asRelativePath(c.uri)).join(', ') || 'none'}
Fallback Error: ${fallbackError || 'none'}`;
                throw new Error(details);
            }

            let isDiffTooLarge = false;
            const DIFF_LIMIT = 20000;
            if (diff.length > DIFF_LIMIT) {
                isDiffTooLarge = true;
                const originalLength = diff.length;
                
                // Construct fallback file list
                const formatChangesList = (changes: Change[]): string => {
                    return changes.map(c => {
                        const statusLabel = getStatusLabel(c.status);
                        const relPath = vscode.workspace.asRelativePath(c.uri);
                        return `- ${statusLabel}: ${relPath}`;
                    }).join('\n');
                };

                let fileList = '';
                if (isStaged) {
                    fileList = formatChangesList(repository.state.indexChanges);
                } else {
                    fileList = [
                        ...repository.state.indexChanges,
                        ...repository.state.workingTreeChanges,
                        ...repository.state.untrackedChanges
                    ].map(c => {
                        const statusLabel = getStatusLabel(c.status);
                        const relPath = vscode.workspace.asRelativePath(c.uri);
                        return `- ${statusLabel}: ${relPath}`;
                    }).join('\n');
                }

                diff = `(Note: The git diff is too large (${originalLength} characters) to send. Showing the list of changed files instead.)\n\nList of Changed Files:\n${fileList}`;
                GitService.log(`Diff too large (${originalLength} chars). Fallback to file list: ${fileList.length} chars.`);
            }

            return { diff, isStaged, isDiffTooLarge };
        } catch (error: any) {
            GitService.log(`getDiff Error: ${error.message}`);
            throw error;
        }
    }

    /**
     * Sets the generated commit message in the Source Control input box of the repository.
     * @param repository The Git repository.
     * @param message The commit message to set.
     */
    public setCommitMessage(repository: Repository, message: string): void {
        repository.inputBox.value = message;
    }
}

function getStatusLabel(status: number): string {
    switch (status) {
        case 1: return 'modified';
        case 2: return 'added';
        case 3: return 'deleted';
        case 4: return 'renamed';
        case 5: return 'copied';
        case 6: return 'modified';
        case 7: return 'added';
        case 8: return 'deleted';
        case 9: return 'renamed';
        case 10: return 'copied';
        case 11: return 'added';
        default: return 'modified';
    }
}
