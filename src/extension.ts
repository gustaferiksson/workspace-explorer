import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    // Repository browser for discovering and adding repos
    const repoBrowserProvider = new RepoBrowserProvider();
    const repoBrowserView = vscode.window.createTreeView('repoBrowser', {
        treeDataProvider: repoBrowserProvider,
        showCollapseAll: true,
    });

    context.subscriptions.push(repoBrowserView);

    // Manager for workspace folder views
    const workspaceViewManager = new WorkspaceViewManager();
    context.subscriptions.push(workspaceViewManager);

    // Commands for repository management
    context.subscriptions.push(
        vscode.commands.registerCommand('gitWorkspaceManager.addToWorkspace', async (node: RepoNode) => {
            if (node?.repoPath) {
                const uri = vscode.Uri.file(node.repoPath);
                const success = vscode.workspace.updateWorkspaceFolders(
                    vscode.workspace.workspaceFolders?.length ?? 0,
                    0,
                    { uri, name: node.label }
                );
                if (success) {
                    repoBrowserProvider.refresh();
                    vscode.window.showInformationMessage(`Added ${node.label} to workspace`);
                }
            }
        }),

        vscode.commands.registerCommand('gitWorkspaceManager.removeFromWorkspace', async (node: RepoNode) => {
            if (node?.repoPath) {
                const folderIndex = vscode.workspace.workspaceFolders?.findIndex((f) => f.uri.fsPath === node.repoPath);
                if (folderIndex !== undefined && folderIndex !== -1) {
                    vscode.workspace.updateWorkspaceFolders(folderIndex, 1);
                    repoBrowserProvider.refresh();
                    vscode.window.showInformationMessage(`Removed ${node.label} from workspace`);
                }
            }
        }),

        vscode.commands.registerCommand('gitWorkspaceManager.openInNewWindow', async (node: RepoNode) => {
            if (node?.repoPath) {
                const uri = vscode.Uri.file(node.repoPath);
                await vscode.commands.executeCommand('vscode.openFolder', uri, true);
            }
        }),

        vscode.commands.registerCommand('gitWorkspaceManager.refreshRepos', () => {
            repoBrowserProvider.refresh();
            vscode.window.showInformationMessage('Refreshed repositories');
        })
    );

    // Refresh repo browser when workspace folders change
    context.subscriptions.push(
        vscode.workspace.onDidChangeWorkspaceFolders(() => {
            repoBrowserProvider.refresh();
        })
    );
}

class WorkspaceViewManager {
    private viewPool: Map<string, { view: vscode.TreeView<FileNode>; provider: FolderTreeDataProvider }> = new Map();
    private disposables: vscode.Disposable[] = [];
    private folderPathToViewId: Map<string, string> = new Map();
    private availableViewIds = [
        'multiRepoExplorer0',
        'multiRepoExplorer1',
        'multiRepoExplorer2',
        'multiRepoExplorer3',
        'multiRepoExplorer4',
        'multiRepoExplorer5',
        'multiRepoExplorer6',
        'multiRepoExplorer7',
        'multiRepoExplorer8',
        'multiRepoExplorer9',
    ];

    constructor() {
        // Pre-create all view pools
        for (const viewId of this.availableViewIds) {
            const provider = new FolderTreeDataProvider(null);
            const view = vscode.window.createTreeView(viewId, {
                treeDataProvider: provider,
                showCollapseAll: true,
            });
            view.title = '';
            view.description = 'No folder assigned';
            this.viewPool.set(viewId, { view, provider });
            this.disposables.push(view);
            
            // Set initial context key to false
            const viewIndex = viewId.replace('multiRepoExplorer', '');
            vscode.commands.executeCommand('setContext', `gitWorkspaceManager.view${viewIndex}.hasFolder`, false);
        }

        // Initialize views for current workspace folders
        this.updateViews();

        // Listen for workspace folder changes
        this.disposables.push(
            vscode.workspace.onDidChangeWorkspaceFolders(() => {
                this.updateViews();
            })
        );
    }

    private updateViews() {
        const workspaceFolders = vscode.workspace.workspaceFolders ?? [];
        const currentFolderPaths = new Set(workspaceFolders.map((f) => f.uri.fsPath));

        // Find folders that were removed and free their view IDs
        for (const [folderPath, viewId] of this.folderPathToViewId.entries()) {
            if (!currentFolderPaths.has(folderPath)) {
                const poolItem = this.viewPool.get(viewId);
                if (poolItem) {
                    poolItem.view.title = '';
                    poolItem.view.description = 'No folder assigned';
                    poolItem.provider.updateFolder(null);
                    
                    // Update context key
                    const viewIndex = viewId.replace('multiRepoExplorer', '');
                    vscode.commands.executeCommand('setContext', `gitWorkspaceManager.view${viewIndex}.hasFolder`, false);
                }
                this.folderPathToViewId.delete(folderPath);
            }
        }

        // Assign views to workspace folders
        for (const folder of workspaceFolders) {
            const folderPath = folder.uri.fsPath;
            let viewId = this.folderPathToViewId.get(folderPath);

            if (!viewId) {
                // Find an available view ID
                viewId = this.availableViewIds.find((id) => !Array.from(this.folderPathToViewId.values()).includes(id));
                if (!viewId) {
                    continue; // No more views available
                }
                this.folderPathToViewId.set(folderPath, viewId);
            }

            // Update the view with folder information
            const poolItem = this.viewPool.get(viewId);
            if (poolItem) {
                const repoName = getRepoName(folder.uri.fsPath);
                poolItem.view.title = repoName;
                poolItem.view.description = undefined;
                poolItem.provider.updateFolder(folder);
                
                // Update context key
                const viewIndex = viewId.replace('multiRepoExplorer', '');
                vscode.commands.executeCommand('setContext', `gitWorkspaceManager.view${viewIndex}.hasFolder`, true);
            }
        }
    }

    dispose() {
        for (const d of this.disposables) {
            d.dispose();
        }
        this.viewPool.clear();
        this.folderPathToViewId.clear();
    }
}

// Scan configured paths for git repositories (one level deep)
function scanForGitRepos(basePath: string): Map<string, string[]> {
    const repos = new Map<string, string[]>();
    const expandedPath = basePath.replace(/^~/, require('node:os').homedir());

    if (!fs.existsSync(expandedPath)) {
        return repos;
    }

    try {
        const entries = fs.readdirSync(expandedPath, { withFileTypes: true });

        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const entryPath = path.join(expandedPath, entry.name);
            const gitPath = path.join(entryPath, '.git');

            // Check if this directory is a git repo
            if (fs.existsSync(gitPath)) {
                if (!repos.has('.')) {
                    repos.set('.', []);
                }
                repos.get('.')?.push(entryPath);
            } else {
                // Check one level deeper for git repos
                try {
                    const subEntries = fs.readdirSync(entryPath, { withFileTypes: true });
                    const reposInFolder: string[] = [];

                    for (const subEntry of subEntries) {
                        if (!subEntry.isDirectory()) {
                            continue;
                        }

                        const subEntryPath = path.join(entryPath, subEntry.name);
                        const subGitPath = path.join(subEntryPath, '.git');

                        if (fs.existsSync(subGitPath)) {
                            reposInFolder.push(subEntryPath);
                        }
                    }

                    if (reposInFolder.length > 0) {
                        repos.set(entry.name, reposInFolder);
                    }
                } catch {
                    // Skip directories we can't read
                }
            }
        }
    } catch {
        // Skip paths we can't read
    }

    return repos;
}

class RepoBrowserProvider implements vscode.TreeDataProvider<FolderNode | RepoNode | EmptyStateNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FolderNode | RepoNode | EmptyStateNode | undefined | undefined> =
        new vscode.EventEmitter<FolderNode | RepoNode | EmptyStateNode | undefined | undefined>();
    readonly onDidChangeTreeData: vscode.Event<FolderNode | RepoNode | EmptyStateNode | undefined | undefined> =
        this._onDidChangeTreeData.event;

    refresh(): void {
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: FolderNode | RepoNode | EmptyStateNode): vscode.TreeItem {
        return element;
    }

    async getChildren(
        element?: FolderNode | RepoNode | EmptyStateNode
    ): Promise<(FolderNode | RepoNode | EmptyStateNode)[]> {
        if (!element) {
            // Top level: scan configured paths
            const config = vscode.workspace.getConfiguration('gitWorkspaceManager');
            const repoPaths: string[] = config.get('repoPaths', []);

            if (repoPaths.length === 0) {
                return [new EmptyStateNode()];
            }

            const allRepos = new Map<string, string[]>();

            for (const basePath of repoPaths) {
                const repos = scanForGitRepos(basePath);
                repos.forEach((paths, folder) => {
                    if (!allRepos.has(folder)) {
                        allRepos.set(folder, []);
                    }
                    allRepos.get(folder)?.push(...paths);
                });
            }

            const nodes: (FolderNode | RepoNode)[] = [];

            for (const [folderName, repoPaths] of allRepos.entries()) {
                if (folderName === '.') {
                    // Repos directly in the base path
                    nodes.push(...repoPaths.map((p) => new RepoNode(path.basename(p), p, this.isInWorkspace(p))));
                } else {
                    // Repos in a subfolder
                    nodes.push(new FolderNode(folderName, repoPaths));
                }
            }

            return nodes;
        }

        if (element instanceof FolderNode) {
            return element.repoPaths.map((p) => new RepoNode(path.basename(p), p, this.isInWorkspace(p)));
        }

        return [];
    }

    private isInWorkspace(repoPath: string): boolean {
        return vscode.workspace.workspaceFolders?.some((f) => f.uri.fsPath === repoPath) ?? false;
    }
}

class FolderNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly repoPaths: string[]
    ) {
        super(label, vscode.TreeItemCollapsibleState.Collapsed);
        this.iconPath = new vscode.ThemeIcon('folder');
        this.contextValue = 'folder';
        this.description = `${repoPaths.length} repos`;
    }
}

class EmptyStateNode extends vscode.TreeItem {
    constructor() {
        super('No repository paths configured', vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon('info');
        this.tooltip = 'Add paths to gitWorkspaceManager.repoPaths in settings to scan for repositories';
        this.description = 'Click to open settings';
        this.command = {
            command: 'workbench.action.openSettings',
            title: 'Open Settings',
            arguments: ['gitWorkspaceManager.repoPaths'],
        };
    }
}

class RepoNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly repoPath: string,
        public readonly isActive: boolean
    ) {
        super(label, vscode.TreeItemCollapsibleState.None);
        this.iconPath = new vscode.ThemeIcon(
            isActive ? 'repo' : 'repo',
            isActive ? new vscode.ThemeColor('charts.green') : undefined
        );
        this.contextValue = isActive ? 'activeRepo' : 'gitRepo';
        this.description = isActive ? '✓ In workspace' : '';
        this.tooltip = repoPath;
    }
}

function getRepoName(folderPath: string): string {
    try {
        const _gitPath = path.join(folderPath, '.git');
        const remote = execSync('git remote get-url origin', {
            cwd: folderPath,
            encoding: 'utf8',
        }).trim();

        // Extract repo name from git remote URL
        const match = remote.match(/([^/]+?)(?:\.git)?$/);
        return match ? match[1] : path.basename(folderPath);
    } catch {
        return path.basename(folderPath);
    }
}

class FolderTreeDataProvider implements vscode.TreeDataProvider<FileNode> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileNode | undefined | undefined> = new vscode.EventEmitter<
        FileNode | undefined | undefined
    >();
    readonly onDidChangeTreeData: vscode.Event<FileNode | undefined | undefined> = this._onDidChangeTreeData.event;

    constructor(private folder: vscode.WorkspaceFolder | null) {}

    updateFolder(folder: vscode.WorkspaceFolder | null) {
        this.folder = folder;
        this._onDidChangeTreeData.fire(undefined);
    }

    getTreeItem(element: FileNode): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: FileNode): Promise<FileNode[]> {
        if (!this.folder) {
            return [];
        }
        
        if (!element) {
            // Root level: show files/folders in workspace folder
            const files = await vscode.workspace.fs.readDirectory(this.folder.uri);
            return files
                .map(
                    ([name, type]) =>
                        new FileNode(
                            name,
                            vscode.Uri.joinPath(this.folder!.uri, name),
                            type === vscode.FileType.Directory
                        )
                )
                .sort((a, b) => {
                    // Folders first, then files
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.label.localeCompare(b.label);
                });
        }

        if (element.isDirectory) {
            const files = await vscode.workspace.fs.readDirectory(element.uri);
            return files
                .map(
                    ([name, type]) =>
                        new FileNode(name, vscode.Uri.joinPath(element.uri, name), type === vscode.FileType.Directory)
                )
                .sort((a, b) => {
                    // Folders first, then files
                    if (a.isDirectory && !b.isDirectory) return -1;
                    if (!a.isDirectory && b.isDirectory) return 1;
                    return a.label.localeCompare(b.label);
                });
        }

        return [];
    }
}

class FileNode extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly uri: vscode.Uri,
        public readonly isDirectory: boolean
    ) {
        super(label, isDirectory ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None);
        this.resourceUri = uri;
        this.iconPath = isDirectory ? new vscode.ThemeIcon('folder') : new vscode.ThemeIcon('file');
        this.command = !isDirectory
            ? {
                  command: 'vscode.open',
                  title: 'Open File',
                  arguments: [uri],
              }
            : undefined;
    }
}

export function deactivate() {}
