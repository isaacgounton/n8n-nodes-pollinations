import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	IDataObject,
	INodeExecutionData,
} from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { BaseModel, type ModelConfig, type AsyncResultResponse } from '../../../shared/baseModel';

export abstract class BaseFalModel extends BaseModel {
	protected apiKey: string | null = null;
	protected asyncBaseUrl = 'https://queue.fal.run';
	protected syncBaseUrl = 'https://fal.run';

	constructor(executeFunctions: IExecuteFunctions, itemIndex: number) {
		super(executeFunctions, itemIndex, 'fal');
		// 不在构造函数中获取 credentials，延迟到第一次使用时获取
	}

	/**
	 * 获取状态查询的基础路径
	 * 对于某些模型，需要从 endpoint 中提取基础路径
	 * - kling-video: /fal-ai/kling-video/o1/standard/image-to-video -> /fal-ai/kling-video
	 * - wan: /wan/v2.6/text-to-video -> /wan/v2.6
	 * - z-image: /fal-ai/z-image/turbo -> /fal-ai/z-image
	 * - nano-banana-pro: /fal-ai/nano-banana-pro/edit -> /fal-ai/nano-banana-pro
	 * - seedream: /fal-ai/bytedance/seedream/v4.5/text-to-image -> /fal-ai/bytedance
	 */
	protected getStatusBasePath(endpoint: string): string {
		// 检查是否是 kling-video 相关模型
		if (endpoint.includes('/kling-video/')) {
			// 提取基础路径：/fal-ai/kling-video
			const match = endpoint.match(/^(\/fal-ai\/kling-video)/);
			if (match) {
				return match[1];
			}
		}
		// 检查是否是 WAN 相关模型
		if (endpoint.startsWith('/wan/v2.6/')) {
			// 提取基础路径：/wan/v2.6
			return '/wan/v2.6';
		}
		// 检查是否是 z-image 相关模型
		if (endpoint.includes('/z-image/')) {
			// 提取基础路径：/fal-ai/z-image
			const match = endpoint.match(/^(\/fal-ai\/z-image)/);
			if (match) {
				return match[1];
			}
		}
		// 检查是否是 nano-banana-pro 相关模型
		if (endpoint.includes('/nano-banana-pro/')) {
			// 提取基础路径：/fal-ai/nano-banana-pro
			const match = endpoint.match(/^(\/fal-ai\/nano-banana-pro)/);
			if (match) {
				return match[1];
			}
		}
		// 检查是否是 seedream (bytedance) 相关模型
		if (endpoint.includes('/bytedance/')) {
			// 提取基础路径：/fal-ai/bytedance
			const match = endpoint.match(/^(\/fal-ai\/bytedance)/);
			if (match) {
				return match[1];
			}
		}
		// 对于其他模型，使用完整的 endpoint
		return endpoint;
	}

	protected async ensureApiKey(): Promise<void> {
		if (this.apiKey !== null) {
			return; // 已经获取过了
		}

		const credentials = await this.getCredentialsAsync();
		
		// 检查 credentials 是否存在
		if (!credentials) {
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				'FAL API credentials not found. Please select the FAL API credential in the node settings.',
				{ itemIndex: this.itemIndex },
			);
		}
		
		// 检查 credentials 类型
		if (typeof credentials !== 'object') {
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				`Invalid FAL API credentials format. Expected object, got ${typeof credentials}.`,
				{ itemIndex: this.itemIndex },
			);
		}
		
		// 检查 credentials 对象是否为空
		const credentialKeys = Object.keys(credentials);
		if (credentialKeys.length === 0) {
			const credentialsDebug = `\n\nCredentials Debug Info:\nCredentials object: ${JSON.stringify(credentials, null, 2)}\nCredential keys: ${credentialKeys.join(', ') || '(none)'}\nCredentials type: ${typeof credentials}`;
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				`FAL API credentials are empty. The credential was selected but contains no data.${credentialsDebug}\n\nPlease: 1) Go to Credentials page, 2) Edit your FAL API credential, 3) Re-enter your API Key, 4) Click "Test" to verify, 5) Click "Save", 6) Go back to the node and re-select the credential.`,
				{ itemIndex: this.itemIndex },
			);
		}
		
		// 获取 API Key
		const apiKey = credentials.apiKey;
		if (!apiKey) {
			const availableKeys = credentialKeys.length > 0 ? credentialKeys.join(', ') : 'none';
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				`FAL API Key is required. Found keys in credentials: ${availableKeys}. Expected 'apiKey'. Please check your credential configuration and ensure the API Key field is saved.`,
				{ itemIndex: this.itemIndex },
			);
		}
		
		// 验证 API Key 类型
		if (typeof apiKey !== 'string' && typeof apiKey !== 'number') {
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				`Invalid FAL API Key type. Expected string or number, got ${typeof apiKey}.`,
				{ itemIndex: this.itemIndex },
			);
		}
		
		// 验证 API Key 不为空
		const apiKeyString = String(apiKey).trim();
		if (apiKeyString === '') {
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				'FAL API Key is empty. Please enter a valid API key in your credential configuration.',
				{ itemIndex: this.itemIndex },
			);
		}
		
		this.apiKey = apiKeyString;
	}

	getCredentials(): IDataObject | Promise<IDataObject> {
		// 返回 getCredentials 的原始结果，可能是 Promise 或对象
		return this.executeFunctions.getCredentials('falApi') as IDataObject | Promise<IDataObject>;
	}

	protected async getCredentialsAsync(): Promise<IDataObject> {
		// 在 n8n 中，getCredentials 可能返回 Promise 或直接返回对象
		// 使用 await 来处理两种情况
		const credentialsResult = this.executeFunctions.getCredentials('falApi');
		
		// 如果已经是 Promise，直接 await
		// 如果不是 Promise，await 会直接返回原值
		const credentials = await Promise.resolve(credentialsResult) as IDataObject;
		
		if (!credentials || typeof credentials !== 'object') {
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				'FAL API credentials not found. Please select the FAL API credential in the node settings.',
				{ itemIndex: this.itemIndex },
			);
		}
		
		return credentials;
	}

	getAsyncBaseUrl(): string {
		return this.asyncBaseUrl;
	}

	getSyncBaseUrl(): string {
		return this.syncBaseUrl;
	}

	abstract getConfig(): ModelConfig;
	abstract buildRequestParams(): Promise<IDataObject>;
	protected abstract processSyncResponse(response: IDataObject): IDataObject;
	protected abstract processAsyncResponse(response: IDataObject): IDataObject;

	/**
	 * 重写 executeAsync 方法以正确处理 FAL API 的状态查询端点
	 * 特别是对于 kling-video 相关模型，状态查询端点格式不同
	 */
	async executeAsync(): Promise<INodeExecutionData> {
		const config = this.getConfig();
		if (!config.supportsAsync) {
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				`Model ${config.displayName} does not support asynchronous requests`,
				{ itemIndex: this.itemIndex },
			);
		}

		// 确保 credentials 已加载
		await this.ensureApiKey();

		// 提交异步请求
		const params = await this.buildRequestParams();
		const asyncUrl = `${this.getAsyncBaseUrl()}${config.endpoint}`;
		const submitResponse = await this.makeRequest('POST', asyncUrl, params);

		const requestId = submitResponse.request_id as string;
		if (!requestId) {
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				'Failed to get request_id from async submission',
				{ itemIndex: this.itemIndex },
			);
		}

		// 获取状态查询的基础路径
		const statusBasePath = this.getStatusBasePath(config.endpoint);

		// 轮询状态
		const pollInterval = 2000; // 每2秒轮询一次

		while (true) {
			// FAL API 的状态检查端点格式：/statusBasePath/requests/{requestId}/status
			// 对于 kling-video：/fal-ai/kling-video/requests/{requestId}/status
			// 对于其他模型：/endpoint/requests/{requestId}/status
			const statusUrl = `${this.getAsyncBaseUrl()}${statusBasePath}/requests/${requestId}/status`;
			
			let statusResponse: IDataObject;
			try {
				statusResponse = await this.makeRequest('GET', statusUrl);
			} catch (error: unknown) {
				// 如果状态查询失败（如 405），尝试直接查询结果端点
				const err = error as { response?: { statusCode?: number } };
				if (err.response?.statusCode === 405) {
					// 405 表示方法不允许，可能状态端点不支持 GET，尝试直接获取结果
					try {
						const resultUrl = `${this.getAsyncBaseUrl()}${statusBasePath}/requests/${requestId}`;
						const resultResponse = await this.makeRequest('GET', resultUrl);
						// 如果能够获取结果，说明任务已完成
						if (resultResponse.video || resultResponse.images || (resultResponse as IDataObject).output) {
							return {
								json: this.processAsyncResponse(resultResponse as AsyncResultResponse),
								pairedItem: { item: this.itemIndex },
							};
						}
						// 如果结果中还没有数据，继续等待
					} catch (resultError: unknown) {
						// 如果获取结果也失败，继续轮询
						const resultErr = resultError as { response?: { statusCode?: number } };
						if (resultErr.response?.statusCode === 404 || resultErr.response?.statusCode === 422) {
							// 404 或 422 表示任务可能还在进行中，继续等待
							const delay = (ms: number) => {
								const start = Date.now();
								while (Date.now() - start < ms) {
									// Busy wait - acceptable for short polling intervals
								}
							};
							delay(pollInterval);
							continue;
						}
						// 其他错误，抛出
						throw resultError;
					}
					// 继续等待
					const delay = (ms: number) => {
						const start = Date.now();
						while (Date.now() - start < ms) {
							// Busy wait - acceptable for short polling intervals
						}
					};
					delay(pollInterval);
					continue;
				}
				throw error;
			}

			if (statusResponse.status === 'COMPLETED') {
				// FAL API 的结果获取端点格式：/statusBasePath/requests/{requestId}
				// 先检查状态响应中是否已包含结果数据（如 images 或 video 字段）
				let resultResponse: IDataObject;
				
				// 检查状态响应中是否已包含结果数据
				if (statusResponse.images || statusResponse.video || (statusResponse as IDataObject).output) {
					// 状态响应中已包含结果数据，直接使用
					resultResponse = statusResponse as IDataObject;
				} else {
					// 需要单独获取结果
					try {
						const resultUrl = `${this.getAsyncBaseUrl()}${statusBasePath}/requests/${requestId}`;
						resultResponse = await this.makeRequest('GET', resultUrl);
					} catch (error: unknown) {
						// 如果获取结果失败（422/404），尝试使用状态响应
						const err = error as { response?: { statusCode?: number; body?: IDataObject } };
						if (err.response?.statusCode === 422 || err.response?.statusCode === 404) {
							// 422 或 404 可能表示结果已经在状态响应中，或者端点格式不对
							// 尝试使用状态响应作为结果
							resultResponse = statusResponse as IDataObject;
						} else {
							throw error;
						}
					}
				}

				return {
					json: this.processAsyncResponse(resultResponse as AsyncResultResponse),
					pairedItem: { item: this.itemIndex },
				};
			}

			if (statusResponse.status === 'FAILED') {
				throw new NodeOperationError(
					this.executeFunctions.getNode(),
					`Async request failed: ${(statusResponse.error as string) || 'Unknown error'}`,
					{ itemIndex: this.itemIndex },
				);
			}

			// 等待后继续轮询
			// Use a simple delay using busy wait to avoid restricted globals
			const delay = (ms: number) => {
				const start = Date.now();
				while (Date.now() - start < ms) {
					// Busy wait - acceptable for short polling intervals
				}
			};
			delay(pollInterval);
		}
	}

	async makeRequest(
		method: 'GET' | 'POST',
		url: string,
		body?: IDataObject,
		timeout?: number,
	): Promise<IDataObject> {
		// 确保 API Key 已获取
		await this.ensureApiKey();
		
		const options: IHttpRequestOptions = {
			method,
			url,
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Key ${this.apiKey}`,
			},
			body,
			json: true,
		};

		// 如果指定了超时时间，添加到选项中
		if (timeout) {
			options.timeout = timeout;
		}

		try {
			return await this.executeFunctions.helpers.httpRequest(options);
		} catch (error: unknown) {
			// 构建请求的原始数据用于调试
			const requestRaw = {
				method,
				url,
				headers: options.headers,
				body: body ? JSON.stringify(body, null, 2) : undefined,
			};
			
			const err = error as { response?: { body?: { detail?: string; message?: string }; statusCode?: number }; message?: string };
			if (err.response) {
				const errorMessage = err.response.body?.detail || err.response.body?.message || err.message || 'Unknown error';
				const requestDetails = `\n\nRequest Details:\nMethod: ${requestRaw.method}\nURL: ${requestRaw.url}\nHeaders: ${JSON.stringify(requestRaw.headers, null, 2)}\n${requestRaw.body ? `Body: ${requestRaw.body}` : 'Body: (empty)'}\n\nResponse Status: ${err.response.statusCode}`;
				throw new NodeOperationError(
					this.executeFunctions.getNode(),
					`API request failed: ${errorMessage}${requestDetails}`,
					{
						itemIndex: this.itemIndex,
						description: `URL: ${url}, Status: ${err.response.statusCode}`,
					},
				);
			}
			
			// 如果没有 response，也显示请求信息
			const requestDetails = `\n\nRequest Details:\nMethod: ${requestRaw.method}\nURL: ${requestRaw.url}\nHeaders: ${JSON.stringify(requestRaw.headers, null, 2)}\n${requestRaw.body ? `Body: ${requestRaw.body}` : 'Body: (empty)'}`;
			throw new NodeOperationError(
				this.executeFunctions.getNode(),
				`API request failed: ${err.message || 'Unknown error'}${requestDetails}`,
				{
					itemIndex: this.itemIndex,
					description: `URL: ${url}`,
				},
			);
		}
	}
}

