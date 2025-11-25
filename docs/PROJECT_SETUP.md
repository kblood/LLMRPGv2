# Project Setup Guide

> Step-by-step instructions to initialize the LLMRPGv2 TypeScript monorepo

## Prerequisites

### Required Software

| Software | Version | Purpose |
|----------|---------|---------|
| **Node.js** | 20.x+ | JavaScript runtime |
| **pnpm** | 8.x+ | Package manager (monorepo support) |
| **Git** | 2.x+ | Version control |
| **VS Code** | Latest | Recommended IDE |

### Optional Software

| Software | Purpose |
|----------|---------|
| **Bun** | Alternative runtime (faster) |
| **Docker** | Containerized development |
| **SQLite CLI** | Database inspection |

---

## Installation

### 1. Install Node.js

```powershell
# Using winget (Windows)
winget install OpenJS.NodeJS.LTS

# Or download from https://nodejs.org/
```

### 2. Install pnpm

```powershell
# Using npm
npm install -g pnpm

# Or using winget
winget install pnpm.pnpm

# Verify installation
pnpm --version
```

### 3. Install VS Code Extensions

Recommended extensions for this project:

```powershell
# Install via CLI
code --install-extension dbaeumer.vscode-eslint
code --install-extension esbenp.prettier-vscode
code --install-extension bradlc.vscode-tailwindcss
code --install-extension yoavbls.pretty-ts-errors
code --install-extension vitest.explorer
code --install-extension ms-vscode.vscode-typescript-next
```

---

## Project Initialization

### Step 1: Create Project Root

```powershell
# Navigate to your projects directory
cd C:\LLM\devstuff

# Create and enter project directory
mkdir llmrpg
cd llmrpg

# Initialize git
git init

# Create .gitignore
@"
# Dependencies
node_modules/
.pnpm-store/

# Build outputs
dist/
build/
*.tsbuildinfo

# Environment
.env
.env.local
.env.*.local

# IDE
.vscode/*
!.vscode/settings.json
!.vscode/extensions.json
.idea/

# OS
.DS_Store
Thumbs.db

# Logs
logs/
*.log
npm-debug.log*
pnpm-debug.log*

# Testing
coverage/

# Data (sessions, etc.)
data/
sessions/

# Debug outputs
debug/
*.debug.json
"@ | Out-File -Encoding utf8 .gitignore
```

### Step 2: Initialize pnpm Workspace

```powershell
# Create root package.json
@"
{
  "name": "llmrpg",
  "version": "0.1.0",
  "private": true,
  "description": "AI-driven RPG with LLM Game Master",
  "scripts": {
    "build": "pnpm -r build",
    "test": "vitest",
    "test:run": "vitest run",
    "lint": "eslint packages apps --ext .ts,.tsx",
    "lint:fix": "eslint packages apps --ext .ts,.tsx --fix",
    "format": "prettier --write \"**/*.{ts,tsx,json,md}\"",
    "typecheck": "pnpm -r typecheck",
    "clean": "pnpm -r clean && rimraf node_modules",
    "dev": "pnpm --filter @llmrpg/server dev",
    "dev:cli": "pnpm --filter @llmrpg/cli dev"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "typescript": "^5.3.0",
    "vitest": "^1.0.0",
    "eslint": "^8.55.0",
    "@typescript-eslint/eslint-plugin": "^6.13.0",
    "@typescript-eslint/parser": "^6.13.0",
    "prettier": "^3.1.0",
    "rimraf": "^5.0.5"
  },
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "packageManager": "pnpm@8.15.0"
}
"@ | Out-File -Encoding utf8 package.json

# Create pnpm workspace config
@"
packages:
  - 'packages/*'
  - 'apps/*'
  - 'tools/*'
"@ | Out-File -Encoding utf8 pnpm-workspace.yaml
```

### Step 3: Create TypeScript Configuration

```powershell
# Base TypeScript config (shared)
@"
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "composite": true,
    "incremental": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
"@ | Out-File -Encoding utf8 tsconfig.base.json

# Root tsconfig for project references
@"
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@llmrpg/core": ["packages/core/src"],
      "@llmrpg/llm": ["packages/llm/src"],
      "@llmrpg/storage": ["packages/storage/src"],
      "@llmrpg/protocol": ["packages/protocol/src"],
      "@llmrpg/debug": ["packages/debug/src"]
    }
  },
  "references": [
    { "path": "packages/protocol" },
    { "path": "packages/core" },
    { "path": "packages/llm" },
    { "path": "packages/storage" },
    { "path": "packages/debug" },
    { "path": "apps/server" },
    { "path": "apps/cli" }
  ],
  "include": [],
  "exclude": ["node_modules", "dist"]
}
"@ | Out-File -Encoding utf8 tsconfig.json
```

### Step 4: Create Vitest Configuration

```powershell
@"
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['packages/*/tests/**/*.test.ts', 'apps/*/tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['packages/*/src/**/*.ts', 'apps/*/src/**/*.ts'],
      exclude: ['**/*.d.ts', '**/index.ts', '**/*.test.ts'],
    },
  },
});
"@ | Out-File -Encoding utf8 vitest.config.ts
```

### Step 5: Create ESLint Configuration

```powershell
@"
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"],
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking"
  ],
  "parserOptions": {
    "project": ["./tsconfig.json", "./packages/*/tsconfig.json", "./apps/*/tsconfig.json"]
  },
  "rules": {
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/prefer-nullish-coalescing": "error",
    "@typescript-eslint/prefer-optional-chain": "error"
  },
  "ignorePatterns": ["dist", "node_modules", "*.js"]
}
"@ | Out-File -Encoding utf8 .eslintrc.json
```

### Step 6: Create Prettier Configuration

```powershell
@"
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "bracketSpacing": true,
  "arrowParens": "always"
}
"@ | Out-File -Encoding utf8 .prettierrc
```

### Step 7: Create VS Code Settings

```powershell
# Create .vscode directory
mkdir .vscode

# VS Code workspace settings
@"
{
  "typescript.tsdk": "node_modules/typescript/lib",
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "eslint.workingDirectories": [
    { "pattern": "packages/*" },
    { "pattern": "apps/*" }
  ],
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/*.tsbuildinfo": true
  }
}
"@ | Out-File -Encoding utf8 .vscode/settings.json

# Recommended extensions
@"
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "esbenp.prettier-vscode",
    "yoavbls.pretty-ts-errors",
    "vitest.explorer",
    "ms-vscode.vscode-typescript-next"
  ]
}
"@ | Out-File -Encoding utf8 .vscode/extensions.json
```

---

## Create Package Structure

### Step 8: Create Directory Structure

```powershell
# Create all directories
$dirs = @(
  "packages/protocol/src",
  "packages/protocol/tests",
  "packages/core/src/engine",
  "packages/core/src/state",
  "packages/core/src/fate",
  "packages/core/src/characters",
  "packages/core/src/context",
  "packages/core/src/types",
  "packages/core/src/ports",
  "packages/core/tests",
  "packages/llm/src/adapters",
  "packages/llm/src/middleware",
  "packages/llm/tests",
  "packages/storage/src/adapters",
  "packages/storage/src/session",
  "packages/storage/src/replay",
  "packages/storage/tests",
  "packages/debug/src",
  "packages/debug/tests",
  "apps/server/src/api",
  "apps/server/tests",
  "apps/cli/src",
  "apps/cli/tests",
  "tools/session-viewer/src",
  "tools/world-editor/src"
)

foreach ($dir in $dirs) {
  New-Item -ItemType Directory -Path $dir -Force | Out-Null
  Write-Host "Created: $dir"
}
```

### Step 9: Initialize Each Package

Run the following to create all package configurations:

```powershell
# ============================================
# packages/protocol
# ============================================
@"
{
  "name": "@llmrpg/protocol",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "zod": "^3.22.4"
  }
}
"@ | Out-File -Encoding utf8 packages/protocol/package.json

@"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@ | Out-File -Encoding utf8 packages/protocol/tsconfig.json

# ============================================
# packages/core
# ============================================
@"
{
  "name": "@llmrpg/core",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llmrpg/protocol": "workspace:*",
    "zod": "^3.22.4",
    "immer": "^10.0.3",
    "pino": "^8.17.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.0"
  }
}
"@ | Out-File -Encoding utf8 packages/core/package.json

@"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../protocol" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@ | Out-File -Encoding utf8 packages/core/tsconfig.json

# ============================================
# packages/llm
# ============================================
@"
{
  "name": "@llmrpg/llm",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llmrpg/protocol": "workspace:*",
    "openai": "^4.20.0",
    "@anthropic-ai/sdk": "^0.10.0",
    "zod": "^3.22.4",
    "pino": "^8.17.0"
  }
}
"@ | Out-File -Encoding utf8 packages/llm/package.json

@"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../protocol" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@ | Out-File -Encoding utf8 packages/llm/tsconfig.json

# ============================================
# packages/storage
# ============================================
@"
{
  "name": "@llmrpg/storage",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llmrpg/protocol": "workspace:*",
    "@llmrpg/core": "workspace:*",
    "better-sqlite3": "^9.2.2",
    "zod": "^3.22.4",
    "pino": "^8.17.0"
  },
  "devDependencies": {
    "@types/better-sqlite3": "^7.6.8"
  }
}
"@ | Out-File -Encoding utf8 packages/storage/package.json

@"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../protocol" },
    { "path": "../core" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@ | Out-File -Encoding utf8 packages/storage/tsconfig.json

# ============================================
# packages/debug
# ============================================
@"
{
  "name": "@llmrpg/debug",
  "version": "0.1.0",
  "private": true,
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rimraf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llmrpg/protocol": "workspace:*",
    "@llmrpg/core": "workspace:*",
    "@llmrpg/storage": "workspace:*",
    "pino": "^8.17.0",
    "chalk": "^5.3.0"
  }
}
"@ | Out-File -Encoding utf8 packages/debug/package.json

@"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../protocol" },
    { "path": "../core" },
    { "path": "../storage" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@ | Out-File -Encoding utf8 packages/debug/tsconfig.json

# ============================================
# apps/server
# ============================================
@"
{
  "name": "@llmrpg/server",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "clean": "rimraf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llmrpg/core": "workspace:*",
    "@llmrpg/llm": "workspace:*",
    "@llmrpg/storage": "workspace:*",
    "@llmrpg/protocol": "workspace:*",
    "@llmrpg/debug": "workspace:*",
    "hono": "^3.11.0",
    "@hono/node-server": "^1.3.0",
    "ws": "^8.14.2",
    "inversify": "^6.0.2",
    "reflect-metadata": "^0.2.1",
    "dotenv": "^16.3.1",
    "pino": "^8.17.0",
    "pino-pretty": "^10.3.0",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/ws": "^8.5.10",
    "tsx": "^4.6.0"
  }
}
"@ | Out-File -Encoding utf8 apps/server/package.json

@"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "references": [
    { "path": "../../packages/protocol" },
    { "path": "../../packages/core" },
    { "path": "../../packages/llm" },
    { "path": "../../packages/storage" },
    { "path": "../../packages/debug" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@ | Out-File -Encoding utf8 apps/server/tsconfig.json

# ============================================
# apps/cli
# ============================================
@"
{
  "name": "@llmrpg/cli",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "bin": {
    "llmrpg": "./dist/index.js"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "clean": "rimraf dist *.tsbuildinfo",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@llmrpg/core": "workspace:*",
    "@llmrpg/llm": "workspace:*",
    "@llmrpg/storage": "workspace:*",
    "@llmrpg/protocol": "workspace:*",
    "@llmrpg/debug": "workspace:*",
    "commander": "^11.1.0",
    "inquirer": "^9.2.12",
    "chalk": "^5.3.0",
    "ora": "^7.0.1",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/inquirer": "^9.0.7",
    "tsx": "^4.6.0"
  }
}
"@ | Out-File -Encoding utf8 apps/cli/package.json

@"
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "references": [
    { "path": "../../packages/protocol" },
    { "path": "../../packages/core" },
    { "path": "../../packages/llm" },
    { "path": "../../packages/storage" },
    { "path": "../../packages/debug" }
  ],
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
"@ | Out-File -Encoding utf8 apps/cli/tsconfig.json

Write-Host "`n✅ All package configurations created!" -ForegroundColor Green
```

---

## Create Initial Source Files

### Step 10: Create Protocol Package (Foundation)

```powershell
# packages/protocol/src/index.ts
@"
// Re-export all protocol types
export * from './messages.js';
export * from './events.js';
export * from './commands.js';
export * from './state.js';
export * from './characters.js';
export * from './fate.js';
"@ | Out-File -Encoding utf8 packages/protocol/src/index.ts
```

See **PROTOCOL_PACKAGE.md** for full protocol implementation.

### Step 11: Install Dependencies

```powershell
# Install all dependencies
pnpm install

# Verify installation
pnpm list --depth 0
```

### Step 12: Verify Setup

```powershell
# Type check all packages
pnpm typecheck

# Run tests (will be empty initially)
pnpm test:run

# Build all packages
pnpm build
```

---

## Environment Configuration

### Step 13: Create Environment File

```powershell
# Create .env.example
@"
# LLM Configuration
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o
LLM_API_KEY=your-api-key-here
LLM_BASE_URL=
LLM_MAX_TOKENS=4096
LLM_TEMPERATURE=0.7

# Storage Configuration
STORAGE_TYPE=filesystem
STORAGE_PATH=./data
SNAPSHOT_INTERVAL=10

# Server Configuration
PORT=3000
HOST=localhost

# Debug Configuration
DEBUG=false
LOG_LEVEL=info
SAVE_PROMPTS=false
SAVE_RESPONSES=false
"@ | Out-File -Encoding utf8 .env.example

# Copy to .env for local development
Copy-Item .env.example .env

Write-Host "`n⚠️  Remember to update .env with your actual API keys!" -ForegroundColor Yellow
```

---

## Quick Start Commands

After setup is complete:

```powershell
# Development
pnpm dev           # Start server in watch mode
pnpm dev:cli       # Start CLI in watch mode

# Testing
pnpm test          # Run tests in watch mode
pnpm test:run      # Run tests once
pnpm test -- --coverage  # Run with coverage

# Building
pnpm build         # Build all packages
pnpm typecheck     # Type check without emitting

# Linting
pnpm lint          # Check for issues
pnpm lint:fix      # Auto-fix issues
pnpm format        # Format with Prettier

# Cleaning
pnpm clean         # Remove all build artifacts
```

---

## Project Structure After Setup

```
llmrpg/
├── .vscode/
│   ├── settings.json
│   └── extensions.json
├── packages/
│   ├── protocol/          # Shared types and schemas
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   └── tests/
│   ├── core/              # Game engine
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   └── tests/
│   ├── llm/               # LLM adapters
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   └── tests/
│   ├── storage/           # Persistence
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── src/
│   │   └── tests/
│   └── debug/             # Debug tools
│       ├── package.json
│       ├── tsconfig.json
│       ├── src/
│       └── tests/
├── apps/
│   ├── server/            # Backend API
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── src/
│   └── cli/               # Command line
│       ├── package.json
│       ├── tsconfig.json
│       └── src/
├── tools/
│   ├── session-viewer/
│   └── world-editor/
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
├── tsconfig.base.json
├── vitest.config.ts
├── .eslintrc.json
├── .prettierrc
├── .gitignore
├── .env.example
└── .env
```

---

## Next Steps

1. **Read**: `PROTOCOL_PACKAGE.md` - Implement the protocol package
2. **Read**: `CORE_PACKAGE.md` - Implement the core game engine
3. **Read**: `LLM_PACKAGE.md` - Implement LLM adapters
4. **Read**: `STORAGE_PACKAGE.md` - Implement storage adapters

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| `pnpm: command not found` | Run `npm install -g pnpm` |
| `Cannot find module` | Run `pnpm install` then `pnpm build` |
| TypeScript errors in IDE | Restart TS server: `Ctrl+Shift+P` → "Restart TS Server" |
| `EACCES` permission errors | Run as administrator or fix npm permissions |
| `better-sqlite3` build fails | Install Visual Studio Build Tools |

### Windows-Specific: better-sqlite3

```powershell
# Install build tools if better-sqlite3 fails
npm install -g windows-build-tools

# Or install Visual Studio Build Tools manually
winget install Microsoft.VisualStudio.2022.BuildTools
```

---

## Validation Checklist

- [ ] Node.js 20+ installed (`node --version`)
- [ ] pnpm 8+ installed (`pnpm --version`)
- [ ] All directories created
- [ ] All package.json files created
- [ ] All tsconfig.json files created
- [ ] `pnpm install` succeeds
- [ ] `pnpm typecheck` succeeds
- [ ] `.env` configured with API keys
- [ ] VS Code extensions installed
