import axios from 'axios';

export async function downloadPresigned(url: string): Promise<{ buffer: Buffer; contentType?: string }> {
	const res = await axios.get(url, { responseType: 'arraybuffer', validateStatus: s => s < 500 });
	if (res.status >= 400) {
		throw new Error(`Failed to download document: HTTP ${res.status}`);
	}
	const contentType = res.headers['content-type'] as string | undefined;
	return { buffer: Buffer.from(res.data), contentType };
}


