export interface WidgetConfig {
  apiKey: string;
  baseUrl: string;
  mountId: string;
  theme: 'light' | 'dark';
}

export type WidgetStatus = 'idle' | 'loading' | 'success' | 'error' | 'validation';

export interface WidgetState {
  status: WidgetStatus;
  pincode: string;
  deliveryDays?: string;
  codAvailable?: boolean;
  validationMessage?: string;
  errorMessage?: string;
}

export interface EtaResponse {
  success: boolean;
  pincode: string;
  district: string;
  state: string;
  region: string;
  estimated_delivery: string;
  serviceable: boolean;
  cod_available?: boolean;
}

export interface ApiConfig {
  apiKey: string;
  baseUrl: string;
}
