import { Uri, Event } from 'vscode';

export interface Git {
	readonly path: string;
}

export interface InputBox {
	value: string;
}

export interface Ref {
	readonly name?: string;
	readonly commit?: string;
}

export interface Branch extends Ref {
	readonly upstream?: { remote: string; name: string };
}

export interface Change {
	readonly uri: Uri;
	readonly originalUri: Uri;
	readonly renameUri: Uri | undefined;
	readonly status: number;
}

export interface RepositoryState {
	readonly HEAD: Branch | undefined;
	readonly indexChanges: Change[];
	readonly workingTreeChanges: Change[];
	readonly untrackedChanges: Change[];
	readonly onDidChange: Event<void>;
}

export interface Repository {
	readonly rootUri: Uri;
	readonly inputBox: InputBox;
	readonly state: RepositoryState;
	diff(cached?: boolean): Promise<string>;
}

export interface API {
	readonly git: Git;
	readonly repositories: Repository[];
	readonly onDidOpenRepository: Event<Repository>;
	readonly onDidCloseRepository: Event<Repository>;
}

export interface GitExtension {
	enabled: boolean;
	getAPI(version: number): API;
}
