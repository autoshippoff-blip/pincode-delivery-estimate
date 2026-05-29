import { ApiConfig, EtaResponse } from './types';

export class ApiClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number = 5000; // 5 seconds timeout limit

  constructor(config: ApiConfig) {
    // Clean trailing slash from base url
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
  }

  async checkPincode(pincode: string): Promise<EtaResponse> {
    const controller = new AbortController();
    const timerId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const response = await fetch(`${this.baseUrl}/api/v1/check-pincode`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': this.apiKey,
        },
        body: JSON.stringify({ pincode }),
        signal: controller.signal,
      });

      clearTimeout(timerId);

      if (!response.ok) {
        throw new Error(`HTTP_${response.status}`);
      }

      return await response.json();
    } catch (error: unknown) {
      clearTimeout(timerId);
      const err = error as Error;
      if (err.name === 'AbortError') {
        throw new Error('TIMEOUT');
      }
      // Re-throw generic fetch errors
      throw error;
    }
  }
}
