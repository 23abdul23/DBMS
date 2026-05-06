# Pre-Commit Checks & Formatting Guide

This document outlines all the formatting and linting checks that run automatically before commits in the Aegis project.

## Automatic Pre-Commit Hook

When you attempt to commit code, Husky automatically runs a pre-commit hook that executes `lint-staged`. This hook checks only the files you've staged for commit and ensures they pass linting and formatting standards.

### What Gets Checked

The pre-commit hook validates staged files against the following rules:

#### Frontend (`frontend/` directory)

- **ESLint**: Checks all `.js`, `.jsx`, `.ts`, `.tsx` files
  - Uses `eslint-config-expo` for React Native/Expo standards
  - **Warnings allowed**, only errors block commits
- **Prettier**: Formats all `.json`, `.md`, `.yml`, `.yaml` files
  - Single quotes (`'`)
  - Semicolons enabled (`;`)

#### Backend (`backend/` directory)

- **ESLint**: Checks all `.js`, `.ts` files
  - Uses `@eslint/js` flat config for Node.js standards
  - Warns on unused variables (must prefix with `_` to suppress)
  - **Warnings allowed**, only errors block commits
- **Prettier**: Formats all `.json`, `.md`, `.yml`, `.yaml` files
  - Double quotes (`"`)
  - No semicolons

#### Root Level

- **Prettier**: Formats all `.json`, `.md`, `.yml`, `.yaml` files in the root
  - Uses root `.prettierignore` to exclude `package-lock.json` and `eslint.config.js`

## Manual Formatting Commands

Run these from the repository root before every commit. The `check` commands now automatically fix formatting and linting issues, then verify everything passes.

### Single Command Checks (Recommended)

These commands auto-fix Prettier and ESLint issues first, then verify everything is clean. Warnings are allowed, but errors will block the check:

```bash
# Frontend: auto-fix formatting & linting, then check
npm run check:frontend

# Backend: auto-fix formatting & linting, then check
npm run check:backend

# Both: auto-fix and check everything
npm run check
```

### Individual Commands

If you need to run commands separately:

```bash
# Frontend
npm --prefix frontend run format           # Auto-fix formatting with Prettier
npm --prefix frontend run lint:fix         # Auto-fix ESLint issues
npm --prefix frontend run lint             # Check for ESLint errors (warnings allowed)
npm --prefix frontend run format:check     # Verify formatting

# Backend
npm --prefix backend run format            # Auto-fix formatting with Prettier
npm --prefix backend run lint:fix          # Auto-fix ESLint issues
npm --prefix backend run lint              # Check for ESLint errors (warnings allowed)
npm --prefix backend run format:check      # Verify formatting
```

## Formatting Conventions

### Frontend (Expo/React Native)

- **Quote Style**: Single quotes (`'`)
- **Semicolons**: Yes (`;`)
- **Config**: `frontend/.prettierrc.json` and `frontend/eslint.config.js`

Example:

```javascript
import React from 'react';

const MyComponent = () => {
  return <Text>Hello World</Text>;
};

export default MyComponent;
```

### Backend (Node.js/Express)

- **Quote Style**: Double quotes (`"`)
- **Semicolons**: No
- **Config**: `backend/.prettierrc.json` and `backend/eslint.config.js`

Example:

```javascript
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());

module.exports = app;
```

## Ignored Files

Files automatically excluded from formatting checks:

- `node_modules/`
- `dist/`, `build/`, `web-build/`
- `.expo/`, `android/`, `ios/`
- `prisma/migrations/`
- `package-lock.json`
- `eslint.config.js`

## Troubleshooting Failed Commits

### Issue: "ESLint KILLED" or Process Timeout

**Cause**: Dependencies not fully installed or ESLint config issue

**Solution**:

```bash
# Reinstall dependencies
npm install
npm --prefix frontend install
npm --prefix backend install

# Verify ESLint works
npm --prefix backend run lint
npm --prefix frontend run lint
```

### Issue: Prettier Finds Code Style Issues

**Cause**: Files don't match the Prettier format standard

**Solution**: Auto-fix the issues:

```bash
# For frontend
npm --prefix frontend run format

# For backend
npm --prefix backend run format

# Then retry the commit
git add .
git commit -m "your message"
```

### Issue: ESLint Reports Errors

**Cause**: Code violates ESLint rules (not just formatting)

**Solution**: Review the reported errors and fix them manually, or use auto-fix when available:

```bash
npm --prefix backend run lint:fix
npm --prefix frontend run lint:fix
```

Common ESLint issues:

- Unused variables: Prefix with `_` (e.g., `_error`)
- Missing error handling: Chain caught errors with `{ cause: error }`
- Undefined variables: Check imports and module definitions

### Issue: Pre-Commit Hook Still Fails After Fixes

**Solution**:

1. Ensure all changes are staged:

   ```bash
   git add .
   ```

2. Run manual checks to confirm:

   ```bash
   npm run check
   ```

3. Try committing again:
   ```bash
   git commit -m "your message"
   ```

If problems persist, check the `.husky/pre-commit` script is executable.

## Bypassing Pre-Commit Hook (Not Recommended)

To skip the pre-commit hook in exceptional cases:

```bash
git commit --no-verify -m "your message"
```

**Warning**: Only use this if you have a valid reason. The pre-commit checks help maintain code quality across the team.

## Installation & Setup

If you haven't set up the pre-commit hook yet:

```bash
# Install root dependencies (enables Husky)
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd frontend && npm install

# Verify the hook is ready
npm run check
```

The `.husky/pre-commit` script will now run automatically on every commit attempt.
