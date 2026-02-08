# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

An n8n community node package (`n8n-nodes-pollinations-v2`) that integrates [Pollinations.ai](https://pollinations.ai) into n8n workflows. It provides two nodes:
- **Pollinations** — Multi-operation node for image/video/text/audio generation and analysis
- **Pollinations Chat Model** — LangChain-compatible chat model for use with n8n AI Agents

## Commands

```bash
npm run build          # Build with n8n-node-cli (outputs to dist/)
npm run lint           # Lint with n8n's ESLint config
npm run lint:fix       # Lint and auto-fix
npm test               # Run Jest tests
npm test -- --watch    # Watch mode
npm test -- __tests__/Pollinations.test.ts  # Single test file
```

Requires Node >= 22. The `n8n-workflow` package is a peer dependency.

## Architecture

### Two Nodes, One Credential

Both nodes use the `pollinationsApi` credential (`credentials/PollinationsApi.credentials.ts`), which authenticates via `Authorization: Bearer` header against `https://gen.pollinations.ai`.

### Pollinations Node (`nodes/Pollinations/`)

The main node uses a **resource + operation** pattern:
- `Pollinations.node.ts` — Node definition with resource/operation selectors and a `switch`-based `execute()` that dispatches to operation handlers
- `operations/*.ts` — Each file exports two things:
  1. An `INodeProperties[]` array defining the UI fields (spread into the node's `properties`)
  2. An `execute*` function that runs with `this: IExecuteFunctions`

Operations: `imageGeneration`, `videoGeneration`, `textGeneration`, `audioGeneration`, `audioTranscription`, `imageAnalysis`, `imageToImage`, `videoAnalysis`

Model lists are fetched dynamically via `loadOptions` methods that call the Pollinations API endpoints (`/image/models`, `/v1/models`, `/text/models`).

### Chat Model Node (`nodes/PollinationsChatModel/`)

A standalone `PollinationsChatModelInstance` class implements the LangChain Runnable interface (`invoke`, `batch`, `pipe`, `bindTools`, `_generate`) without importing LangChain. It uses `fetch()` directly against `/v1/chat/completions`. The node's `supplyData()` returns this instance for n8n's AI Agent system.

### API Base URL

All API calls go to `https://gen.pollinations.ai`. Key endpoints:
- `GET /image/{prompt}` — Image/video generation (returns binary)
- `POST /v1/chat/completions` — OpenAI-compatible text completions
- `GET /text/{prompt}` — Simple text generation
- `POST /v1/chat/completions` with audio modalities — Audio generation
- Model discovery: `GET /image/models`, `GET /v1/models`, `GET /text/models`

API reference is in `api.yaml` (markdown format, not actual YAML).

### Adding a New Operation

1. Create `nodes/Pollinations/operations/newOperation.ts` exporting `newOperationOperation` (properties) and `executeNewOperation` (handler)
2. Import and spread properties + add the execute case in `Pollinations.node.ts`
3. Add any needed `loadOptions` methods if the operation requires dynamic model lists
4. Wire the operation into the resource's operation selector

### Prompt Sanitization

Prompts sent via URL path (image/video GET endpoints) are sanitized to avoid API errors — this was added in v1.2.34.

### Binary Data Handling

Image, video, and audio operations return binary data attached to `INodeExecutionData`. Some operations (imageToImage, videoAnalysis, audioTranscription) accept binary input and support both URL and binary property input sources.

## TypeScript Config

Strict mode enabled with `noImplicitAny`, `strictNullChecks`, `noUnusedLocals`, `noImplicitReturns`. Target is ES2019/CommonJS. Output goes to `dist/`.
