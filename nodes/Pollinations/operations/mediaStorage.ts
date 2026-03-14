import type { IExecuteFunctions, INodeExecutionData, INodeProperties } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { extractBase64, buildMultipartBody } from '../utils';

export const mediaUploadOperation: INodeProperties[] = [
	{
		displayName: 'Binary Property',
		name: 'binaryProperty',
		type: 'string',
		displayOptions: {
			show: {
				resource: ['storage'],
				operation: ['mediaUpload'],
			},
		},
		default: 'data',
		description: 'Name of the binary property containing the file to upload (max 10MB)',
	},
];

export const mediaRetrieveOperation: INodeProperties[] = [
	{
		displayName: 'File Hash',
		name: 'fileHash',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['storage'],
				operation: ['mediaRetrieve'],
			},
		},
		description: 'Content hash of the file to retrieve',
	},
	{
		displayName: 'Include Metadata',
		name: 'includeMetadata',
		type: 'boolean',
		default: false,
		displayOptions: {
			show: {
				resource: ['storage'],
				operation: ['mediaRetrieve'],
			},
		},
		description: 'Whether to also fetch file metadata',
	},
];

export const mediaDeleteOperation: INodeProperties[] = [
	{
		displayName: 'File Hash',
		name: 'fileHash',
		type: 'string',
		default: '',
		required: true,
		displayOptions: {
			show: {
				resource: ['storage'],
				operation: ['mediaDelete'],
			},
		},
		description: 'Content hash of the file to delete (owner only)',
	},
];

export async function executeMediaUpload(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const binaryPropertyName = this.getNodeParameter('binaryProperty', itemIndex) as string;

	const inputData = this.getInputData();
	const binaryData = inputData[itemIndex].binary?.[binaryPropertyName];

	if (!binaryData) {
		throw new NodeOperationError(
			this.getNode(),
			`No binary data found in property '${binaryPropertyName}'`,
			{ itemIndex },
		);
	}

	const credentials = await this.getCredentials('pollinationsApi');

	const fileBase64 = extractBase64(binaryData.data);
	const fileBuffer = Buffer.from(fileBase64, 'base64');
	const mimeType = binaryData.mimeType || 'application/octet-stream';
	const fileName = binaryData.fileName || 'file';

	try {
		const { body: multipartBody, contentType } = buildMultipartBody(
			{},
			{ fieldName: 'file', buffer: fileBuffer, fileName, mimeType },
		);

		const response = await this.helpers.httpRequest({
			method: 'POST',
			url: 'https://media.pollinations.ai/upload',
			headers: {
				Authorization: `Bearer ${credentials.apiKey}`,
				'Content-Type': contentType,
			},
			body: multipartBody,
			json: false,
		});

		// Parse response (json: false returns a string)
		const parsed = typeof response === 'string' ? (() => { try { return JSON.parse(response); } catch { return { result: response }; } })() : response;

		return {
			json: {
				...parsed,
				fileName,
				mimeType,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to upload media: ${error.message}`,
			{ itemIndex },
		);
	}
}

export async function executeMediaRetrieve(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const fileHash = this.getNodeParameter('fileHash', itemIndex) as string;
	const includeMetadata = this.getNodeParameter('includeMetadata', itemIndex) as boolean;

	try {
		const response = await this.helpers.httpRequest({
			method: 'GET',
			url: `https://media.pollinations.ai/${fileHash}`,
			encoding: 'arraybuffer',
			returnFullResponse: true,
		});

		const contentType = response.headers['content-type'] as string;
		const mimeType = contentType?.split(';')[0] || 'application/octet-stream';
		const fileExtension = mimeType.split('/')[1] || 'bin';

		const binaryData = await this.helpers.prepareBinaryData(
			Buffer.from(response.body as ArrayBuffer),
			`media_${fileHash}.${fileExtension}`,
			mimeType,
		);

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const jsonData: Record<string, any> = {
			hash: fileHash,
			mimeType,
		};

		if (includeMetadata) {
			try {
				const metadata = await this.helpers.httpRequest({
					method: 'GET',
					url: `https://media.pollinations.ai/${fileHash}/metadata`,
				});
				jsonData.metadata = metadata;
			} catch {
				// Metadata fetch is optional
			}
		}

		return {
			json: jsonData,
			binary: {
				data: binaryData,
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to retrieve media: ${error.message}`,
			{ itemIndex },
		);
	}
}

export async function executeMediaDelete(
	this: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData> {
	const fileHash = this.getNodeParameter('fileHash', itemIndex) as string;

	const credentials = await this.getCredentials('pollinationsApi');

	try {
		const response = await this.helpers.httpRequest({
			method: 'DELETE',
			url: `https://media.pollinations.ai/${fileHash}`,
			headers: {
				Authorization: `Bearer ${credentials.apiKey}`,
			},
		});

		return {
			json: {
				hash: fileHash,
				deleted: true,
				...(typeof response === 'object' ? response : {}),
			},
			pairedItem: { item: itemIndex },
		};
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			`Failed to delete media: ${error.message}`,
			{ itemIndex },
		);
	}
}
