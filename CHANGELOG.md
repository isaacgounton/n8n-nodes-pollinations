# Changelog

All notable changes to this project will be documented in this file.

## [1.0.0] - 2026-01-17

### BREAKING CHANGES

- **Complete Migration to Pollinations.ai**: This version represents a complete rewrite of the plugin
- Package renamed from `n8n-nodes-ai-media-generate` to `n8n-nodes-pollinations`
- Removed all previous platform integrations (Genbo, Fal, Replicate)
- New unified API using Pollinations.ai

### Added

- **Dynamic Model Loading**: AI models for Image, Video, and Text generation are now fetched dynamically from Pollinations.ai at runtime.
- **Image Generation**: Support for 7+ AI models (Flux, Turbo, GPT Image, Kontext, Seedream, Nanobanana, Nanobanana Pro)
  - Width & Height configuration (16-2048px)
  - Seed for reproducibility
  - Enhancement options (nologo, enhance, transparent, safe mode)
  - **New Parameters**: `negative_prompt`, `quality` (gptimage), `transparent` background
  - Image-to-image transformation with Kontext model
- **Video Generation**: Support for multiple video models (Veo, Seedance, Seedance Pro)
  - **Advanced Controls**: `duration` (2-10s), `aspectRatio` (16:9, 9:16)
  - **Audio Support**: Optional audio generation for `veo` model
  - Image-to-video and frame interpolation for `veo` (image[0]=first, image[1]=last)
  - Support for `negative_prompt` and `safe` filtering
- **Text Generation**: Support for 20+ language models
  - Simple text endpoint for quick generation
  - OpenAI-compatible chat completions
  - **Vision Support**: Analyze images via optional Image URL in chat messages
  - **JSON Mode**: Support for `response_format: json_object` for structured data
  - **Advanced Reasoning**: Controls for `reasoning_effort` and `thinking_budget` (o1/o3/R1)
  - Models: OpenAI, Claude, Gemini, Mistral, DeepSeek, Grok, Qwen Coder, Perplexity, and more
  - Advanced parameters: temperature, max_tokens, top_p, seed
- **Audio Generation**: Text-to-speech with 13 voices
  - Voices: Alloy, Echo, Fable, Onyx, Nova, Shimmer, Coral, Verse, Ballad, Ash, Sage, Amuch, Dan
  - Audio formats: WAV, MP3, FLAC, Opus, PCM16
- **New Credentials**: PollinationsApi credentials with API key authentication
- **Comprehensive Documentation**: Updated README with all features and usage examples
- **Alphabetized Selection**: All remaining static options are now alphabetized for a cleaner UI.

### Removed

- Genbo platform integration and all Genbo models
- Fal platform integration and all Fal models
- Replicate platform integration and all Replicate models
- Old credentials: GenboApi, FalApi, ReplicateApi
- Old node files: AiMediaGenerateGenbo, AiMediaGenerateFal, AiMediaGenerateReplicate

## [0.1.40] - 2025-01-XX

### Fixed

- Fixed FAL API status check endpoint for seedream (bytedance) models - Now correctly uses `/fal-ai/bytedance/requests/{requestId}/status` instead of the full endpoint path

## [0.1.39] - 2025-01-XX

### Fixed

- Fixed FAL API status check endpoint for nano-banana-pro (Gemini 3 Pro Image) models - Now correctly uses `/fal-ai/nano-banana-pro/requests/{requestId}/status` instead of the full endpoint path

## [0.1.38] - 2025-01-XX

### Fixed

- Fixed FAL API status check endpoint for z-image models - Now correctly uses `/fal-ai/z-image/requests/{requestId}/status` instead of the full endpoint path

## [0.1.37] - 2025-01-XX

### Fixed

- Fixed FAL API status check endpoint for kling-video models - Now correctly uses `/fal-ai/kling-video/requests/{requestId}/status` instead of the full endpoint path
- Fixed FAL API status check endpoint for WAN 2.6 models - Now correctly uses `/wan/v2.6/requests/{requestId}/status` instead of the full endpoint path
- Added fallback handling for 405 errors when status endpoint doesn't support GET method - Will try to fetch result directly instead

## [0.1.36] - 2025-01-XX

### Added

- Added new FAL model: Hunyuan Video 1.5 Image-to-Video (`hunyuanVideo15I2V`) - Generate videos from images using Hunyuan Video model
  - Support for 480p resolution
  - Aspect ratios: 16:9, 9:16
  - Configurable number of frames (default: 121)
  - Configurable inference steps (default: 28)
  - Prompt expansion support
  - Negative prompt support

## [0.1.34] - 2025-01-XX

### Changed

- Version bump to 0.1.34

## [0.1.33] - 2025-01-XX

### Changed

- Version bump to 0.1.33

## [0.1.31] - 2025-01-XX

### Changed

- Updated model display names with platform prefixes:
  - Added "Vidu" prefix to Q2 models (Text To Image Q2, Q2 ReferenceToVideo, Q2 Image To Video Pro, Q2 Text To Video, Q2Video Extension Pro, Reference To Image Q2)
  - Added "MiniMax" prefix to Text To Music V2
  - Added "ElevenLabs" prefix to Text To Dialogue
  - Changed "Flux 2 Pro" and "Flux 2 Pro Edit" to "FLUX.2 Pro" and "FLUX.2 Pro Edit"

## [0.1.30] - 2025-01-XX

### Added

- Added new FAL model: Reference To Image Q2 (`q2ReferenceToImage`) - Generate images from reference images using Q2 model

## [0.1.29] - 2024-12-19

### Changed

- Version bump to 0.1.29

## [0.1.28] - Previous version
