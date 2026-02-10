# Multi-Repo Workspace Explorer

A VS Code extension that helps you manage multiple Git repositories in your workspace with an intuitive repository browser and individual workspace folder views.

## Features

### Repository Browser
- **Discover Repositories**: Automatically scans configured paths for Git repositories
- **Organize by Folder**: Groups repositories by parent folder (e.g., `~/Repos/Gustaf`, `~/Repos/Plugsoftware`)
- **Quick Actions**: Add to workspace, remove from workspace, or open in new window with a single click
- **Status Indicators**: See which repositories are currently active in your workspace

### Workspace Folder Views
- **Separate Views**: Each workspace folder gets its own collapsible tree view in the Explorer
- **Stable Display**: Adding or removing folders doesn't disrupt other views
- **Folder-First Sorting**: Folders appear before files, just like the standard Explorer
- **Git-Aware Names**: Views show repository names extracted from Git remotes

## Setup

1. Install the extension
2. Open Settings (`Cmd+,` or `Ctrl+,`)
3. Search for `Multi-Repo Workspace Explorer: Repo Paths`
4. Add base paths to scan for repositories (e.g., `~/Repos`, `/Users/username/Projects`)
5. Click the folder-library icon in the Activity Bar to open the Repository Browser

## Usage

### Adding Repositories
1. Open the Repository Browser from the Activity Bar
2. Browse your configured paths
3. Click the `+` icon next to any repository to add it to your workspace

**Note:** Adding the first or second repository will cause VS Code to reload (unavoidable platform behavior).

### Removing Repositories
1. Find the repository in the Repository Browser (marked with "✓ In workspace")
2. Click the `-` icon to remove it from your workspace

**Note:** Removing the first folder will cause a reload. Users are warned before this happens.

### Opening in New Window
- Click the window icon next to any repository to open it in a separate VS Code window

## Important Technical Details

### VS Code Workspace Reload Behavior
The extension uses `vscode.workspace.updateWorkspaceFolders()` API which **will restart all extensions** in these cases:

1. Adding the first workspace folder (empty → single-folder workspace)
2. Adding the second workspace folder (single-folder → multi-root workspace)
3. Removing or changing the first workspace folder (index 0)

**Important:** There is NO workaround for case #3. VS Code will always reload when index 0 is modified because it needs to update the deprecated `rootPath` property. Any attempt to "swap" or "replace" folders still modifies index 0 and triggers a reload.

The extension warns users before removing the first folder and suggests removing other folders first as a workaround.

## Configuration

- `gitWorkspaceManager.repoPaths`: Array of base paths to scan for Git repositories

## Development

1. Install dependencies: `npm install`
2. Compile TypeScript: `npm run compile`
3. Press F5 to launch Extension Development Host

## Project Structure
- `src/extension.ts` - Main extension entry point
- `package.json` - Extension manifest
- `tsconfig.json` - TypeScript configuration
- `biome.json` - Code linting and formatting
