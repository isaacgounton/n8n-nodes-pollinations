# Feature Request: Add Pollinations Chat Model to AI Agent whitelist

## Summary

Add support for [n8n-nodes-pollinations](https://github.com/isaacgounton/n8n-nodes-pollinations) chat model to the AI Agent node's allowed models list.

## Problem

Community-built chat model nodes cannot connect to the AI Agent node due to a hardcoded whitelist in `Agent.node.ts`. This limits users to only the official n8n chat models and prevents the community from extending n8n's AI capabilities.

## Current Behavior

The AI Agent node only accepts these hardcoded node IDs:
```typescript
'@n8n/n8n-nodes-langchain.lmChatAnthropic',
'@n8n/n8n-nodes-langchain.lmChatAwsBedrock',
'@n8n/n8n-nodes-langchain.lmChatGroq',
'@n8n/n8n-nodes-langchain.lmChatOllama',
'@n8n/n8n-nodes-langchain.lmChatOpenAi',
'@n8n/n8n-nodes-langchain.lmChatGoogleGemini',
'@n8n/n8n-nodes-langchain.lmChatGoogleVertex',
'@n8n/n8n-nodes-langchain.lmChatMistralCloud',
'@n8n/n8n-nodes-langchain.lmChatAzureOpenAi',
'@n8n/n8n-nodes-langchain.lmChatDeepSeek',
'@n8n/n8n-nodes-langchain.lmChatOpenRouter',
'@n8n/n8n-nodes-langchain.lmChatXAiGrok',
```

Community nodes (using package scopes like `n8n-nodes-pollinations-v2`) cannot be added to this list without modifying n8n's core code.

## Proposed Solution

**Short-term:** Add `n8n-nodes-pollinations-v2.pollinationsChatModel` to the AI Agent whitelist.

**Long-term:** Implement capability-based filtering instead of hardcoded node IDs, allowing any properly implemented chat model (that uses `supplyData` and outputs `NodeConnectionTypes.AiLanguageModel`) to work with AI Agent.

## Why Pollinations?

[Pollinations.ai](https://pollinations.ai) is a free, open AI service that provides:

- **Text Generation** - Multiple LLMs (OpenAI, Claude, Gemini, Mistral, DeepSeek, Grok, etc.)
- **Image Generation** - Flux and other models
- **Video Generation** - From text or images
- **Audio/TTS** - Speech synthesis
- **No API key required** for basic usage
- **OpenAI-compatible API** for chat completions

This makes it an excellent option for:
- Users who want free AI capabilities
- Privacy-conscious deployments (self-hosted option)
- Testing and development without API costs

## Node Implementation

The Pollinations Chat Model node follows the same pattern as Ollama Chat Model:

```typescript
export class PollinationsChatModel implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'Pollinations Chat Model',
    name: 'pollinationsChatModel',
    icon: 'file:pollinations.svg',
    group: ['transform'],
    version: 1,
    description: 'Use Pollinations.ai language models with AI Agents',
    inputs: [],
    outputs: [NodeConnectionTypes.AiLanguageModel],
    outputNames: ['Model'],
    usableAsTool: true,
    codex: {
      categories: ['AI'],
      subcategories: {
        AI: ['Language Models'],
      },
    },
    credentials: [
      {
        name: 'pollinationsApi',
        required: true,
      },
    ],
    properties: [
      // Model selection, temperature, maxTokens, etc.
    ],
  };

  async supplyData(this: ISupplyDataFunctions): Promise<SupplyData> {
    // Returns a LangChain-compatible chat model instance
    const chatModel = new PollinationsChatModelInstance({ /* ... */ });
    return { response: chatModel };
  }
}
```

The node works correctly with:
- Basic LLM Chain
- Summarization Chain
- Text Classifier Chain
- Other LangChain nodes

Only AI Agent refuses the connection due to the whitelist.

## Related Issues

- #16121 - Custom AI chat model cannot connect
- [Community Discussion](https://community.n8n.io/t/how-to-use-custom-ai-model-with-ai-agent-node/97750)

## Impact

Adding this would:
1. Enable users to use Pollinations' free AI services with AI Agent
2. Provide a working example for other community chat model developers
3. Be a step toward the long-term goal of capability-based filtering

## Alternative Workaround (for users)

Until this is implemented, users can:
1. Use Basic LLM Chain instead of AI Agent
2. Manually fork n8n and add their node to the whitelist
3. Use n8n's official nodes with paid API services

## Package Information

- **Package:** `n8n-nodes-pollinations-v2`
- **Node ID:** `n8n-nodes-pollinations-v2.pollinationsChatModel`
- **Repository:** https://github.com/isaacgounton/n8n-nodes-pollinations
- **npm:** https://www.npmjs.com/package/n8n-nodes-pollinations-v2

Thank you for considering this request!
