# n8n-nodes-pollinations-v2

This is an n8n community node for [Pollinations.ai](https://pollinations.ai) - a unified platform for AI-powered image, video, text, and audio generation.

[n8n](https://n8n.io/) is a [fair-code licensed](https://docs.n8n.io/reference/license/) workflow automation platform.

## Features

- **Image Generation**: Create images using multiple AI models (Flux, Turbo, GPT Image, Kontext, and more)
- **Video Generation**: Generate videos from text or images (Veo, Seedance models)
- **Text Generation**: Use 20+ language models including OpenAI, Claude, Gemini, Mistral, and more
- **Audio Generation**: Convert text to speech with 13 different voices and 5 audio formats
- **Chat Model**: Use Pollinations models with n8n AI Agents, AI Chains, and AI workflows
- **OpenAI-Compatible**: Chat completions endpoint compatible with OpenAI API format
- **Vision Support**: Analyze and describe images using multimodal models

## Installation

Follow the [installation guide](https://docs.n8n.io/integrations/community-nodes/installation/) in the n8n community nodes documentation.

### Manual Installation

1. Go to **Settings** > **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-pollinations-v2` in **Enter npm package name**
4. Agree to the risks and select **Install**

## Credentials

To use this node, you'll need a Pollinations API key:

1. Visit [enter.pollinations.ai](https://enter.pollinations.ai)
2. Sign up or log in
3. **Create a Secret Key (sk\_)** - Required for n8n server-side use
4. Add the API key to your n8n credentials

### API Key Types

Pollinations offers two types of API keys:

- **Secret Keys (`sk_`)** ⭐ **Recommended for n8n**
  - Server-side only, no rate limits
  - Keep secret - never expose publicly
  - Perfect for n8n workflows

- **Publishable Keys (`pk_`)** ⚠️ **Not recommended for n8n**
  - Beta - not ready for production
  - IP rate-limited (1 pollen per IP per hour)
  - For client-side apps only
  - Will consume your Pollen if exposed in public code

**Important**: Always use **Secret Keys (sk\_)** in n8n for unlimited, server-side access.

## Operations

### Image Generation

Generate images from text prompts using various AI models.

**Models Available**:

- Flux (default) - High-quality image generation
- Turbo - Fast image generation
- GPT Image - GPT-powered images
- Kontext - Supports image-to-image transformation
- Seedream - Creative generation
- Nanobanana / Nanobanana Pro - Lightweight models

**Parameters**:

- Prompt (required)
- Model selection
- Width & Height (16-2048px)
- Seed (for reproducibility)
- **Advanced Options**:
  - Image Count (1-4 for premium models)
  - Negative Prompt (exclude content)
  - Quality Level (for `gptimage` model)
  - Transparent Background (for `gptimage` model)
  - Content Filters (Safe Mode)
  - Prompt Enhancement
- Input image URL (for image-to-image/edit)

### Video Generation

Create videos from text descriptions or images.

**Models Available**:

- Veo - Text-to-video (4-8 seconds)
- Seedance - Text-to-video and image-to-video (2-10 seconds)

**Parameters**:

- Prompt (required)
- Model selection
- Width & Height
- Seed
- **Advanced Options**:
  - Aspect Ratio (16:9, 9:16)
  - Duration (2-10 seconds)
  - Enable Audio (for `veo` model)
  - Negative Prompt
  - Safe Mode Filtering
- Input image URL (for image-to-video or frame interpolation)

### Text Generation

Generate text using advanced language models.

**Generation Types**:

1. **Simple Text**: Quick text generation from a prompt
2. **Chat Completion**: OpenAI-compatible chat with conversation history

**Models Available**: OpenAI, Claude, Gemini, Mistral, DeepSeek, Grok, Qwen Coder, Perplexity, and more (20+ models)

**Parameters**:

- Messages (for chat completion)
- Temperature, Max Tokens, Top P
- Seed for reproducibility
- **Advanced Options**:
  - JSON Mode (returns structured data)
  - Reasoning Effort (for thinking models)
  - Thinking Budget Tokens (for o1/o3/R1 models)

### Audio Generation

Convert text to speech with multiple voices and formats.

**Voices Available**: Alloy, Echo, Fable, Onyx, Nova, Shimmer, Coral, Verse, Ballad, Ash, Sage, Amuch, Dan

**Audio Formats**: WAV, MP3, FLAC, Opus, PCM16

## Chat Model (AI Agent Support)

Use Pollinations language models with n8n's AI Agent, AI Chain, and other AI workflow nodes.

**How to Use**:

1. Add the **Pollinations Chat Model** node to your workflow
2. Select your preferred model (OpenAI, Claude, Gemini, Mistral, etc.)
3. Configure options:
   - **Temperature**: Controls randomness (0-2)
   - **Max Tokens**: Maximum response length
   - **Top P**: Nucleus sampling parameter
4. Connect to AI Agent or AI Chain nodes

**Benefits**:

- Use any of 20+ Pollinations models in AI workflows
- Seamless integration with n8n's AI ecosystem
- Full langchain compatibility
- Cost-effective alternative to direct API providers

## Usage Examples

### Generate an Image

1. Add the Pollinations node to your workflow
2. Select **Image Generation** operation
3. Enter your prompt: "A beautiful sunset over mountains"
4. Choose model (e.g., Flux)
5. Set dimensions (e.g., 1024x1024)
6. Execute the node

The generated image will be available as binary data.

### Create a Video

1. Add the Pollinations node
2. Select **Video Generation** operation
3. Enter prompt: "A cat playing with a ball"
4. Choose model (Veo or Seedance)
5. Execute the node

### Generate Text with Chat

1. Add the Pollinations node
2. Select **Text Generation** operation
3. Choose **Chat Completion** type
4. Select model (e.g., OpenAI, Claude, Gemini)
5. Add messages with roles (system, user, assistant)
6. Execute the node

### Text-to-Speech

1. Add the Pollinations node
2. Select **Audio Generation** operation
3. Enter text to convert
4. Choose voice (e.g., Nova, Alloy)
5. Select audio format (MP3, WAV, etc.)
6. Execute the node

## Resources

- [n8n community nodes documentation](https://docs.n8n.io/integrations/community-nodes/)
- [Pollinations.ai Official Site](https://pollinations.ai)
- [Pollinations API Documentation](https://enter.pollinations.ai/api/docs)
- [GitHub Repository](https://github.com/isaacgounton/n8n-nodes-pollinations)

## Version History

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

[MIT](LICENSE.md)
