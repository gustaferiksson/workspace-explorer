# Publishing Guide

## Prerequisites

1. **VS Code Marketplace Account**
   - Go to https://marketplace.visualstudio.com/manage
   - Sign in with your Microsoft/Azure account
   - Create a publisher if you haven't (use ID: `gustaferiksson`)

2. **Personal Access Token (PAT)**
   
   **Method 1: Direct Link**
   - Go directly to: https://dev.azure.com/_usersSettings/tokens
   - Or go to https://dev.azure.com → Click your avatar/initials (top right) → **User settings** (gear icon) → **Personal Access Tokens**
   
   **Method 2: Via Azure DevOps Organization**
   - If you don't have an Azure DevOps account, you may need to create one first
   - Go to https://aex.dev.azure.com/signup/
   - Then follow Method 1 above
   
   **Creating the Token:**
   - Click **+ New Token**
   - Name: "VS Code Marketplace"
   - Organization: **All accessible organizations**
   - Expiration: Custom defined (recommended 90+ days)
   - Scopes: Click **Custom defined**
   - Click **Show all scopes** link at the bottom
   - Find **Marketplace** section and check **Acquire** and **Manage**
   - Click **Create**
   - **Copy the token immediately** (you won't see it again!)
   
   > **Note:** If you still can't find it, you might not have an Azure DevOps organization. Visit https://marketplace.visualstudio.com/manage first to create a publisher, which will set up your Azure DevOps account.

3. **Install vsce**
   ```bash
   npm install -g @vscode/vsce
   ```

## First-Time Publishing (Manual)

### Step 1: Test the Extension
```bash
# Test in development mode
code --extensionDevelopmentPath=/Users/gustaf/Repos/Gustaf/workspace-explorer

# Or press F5 in VS Code
```

### Step 2: Package the Extension
```bash
npm run compile
vsce package
# Creates: multi-repo-workspace-explorer-0.0.1.vsix
```

### Step 3: Test the VSIX Package
```bash
code --install-extension multi-repo-workspace-explorer-0.0.1.vsix
```

### Step 4: Publish to Marketplace
```bash
vsce publish -p YOUR_PERSONAL_ACCESS_TOKEN

# Or login first (token will be stored):
vsce login gustaferiksson
vsce publish
```

## Using GitHub Actions (Automated)

### Setup GitHub Secrets

1. Go to your GitHub repo: https://github.com/gustaferiksson/workspace-explorer
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **New repository secret**
4. Add secret:
   - Name: `VSCE_PAT`
   - Value: Your Personal Access Token from Azure DevOps

### Manual Release Process

```bash
# 1. Update version in package.json (e.g., 0.0.1 → 0.1.0)
npm version patch  # or minor, or major

# 2. Update CHANGELOG.md with changes

# 3. Commit changes
git add .
git commit -m "Release v0.1.0"

# 4. Create and push tag
git tag v0.1.0
git push origin main
git push origin v0.1.0

# GitHub Actions will automatically:
# - Build and compile the extension
# - Publish to VS Code Marketplace
# - Create a GitHub release with the .vsix file
```

### CI Workflow

Every push to `main` or pull request will:
- Install dependencies
- Run linting
- Compile TypeScript
- Package the extension
- Upload .vsix as artifact

## Post-Publishing

### Update Extension on VS Code Marketplace
- Your extension page: https://marketplace.visualstudio.com/items?itemName=gustaferiksson.multi-repo-workspace-explorer
- Add screenshots, update description, etc.

### Install Published Extension
```bash
# In VS Code
# 1. Open Extensions view (Cmd+Shift+X)
# 2. Search for "Multi-Repo Workspace Explorer"
# 3. Click Install

# Or via command line:
code --install-extension gustaferiksson.multi-repo-workspace-explorer
```

## Version Bumping

```bash
# Patch (0.0.1 → 0.0.2) - Bug fixes
npm version patch

# Minor (0.0.1 → 0.1.0) - New features
npm version minor

# Major (0.0.1 → 1.0.0) - Breaking changes
npm version major
```

## Troubleshooting

### "Publisher not found"
- Create publisher at https://marketplace.visualstudio.com/manage/createpublisher
- Use ID: `gustaferiksson`

### "Invalid Personal Access Token"
- Ensure token has **Marketplace → Manage** scope
- Token must be from Azure DevOps, not GitHub

### "Extension validation failed"
- Check package.json has all required fields
- Ensure icon is 128x128 PNG (if provided)
- Run `vsce package` to see validation errors

## Quick Commands Reference

```bash
# Package only (creates .vsix)
vsce package

# Publish (bumps version and publishes)
vsce publish patch  # or minor, major

# Publish specific version
vsce publish 0.1.0

# Unpublish (careful!)
vsce unpublish gustaferiksson.multi-repo-workspace-explorer
```
