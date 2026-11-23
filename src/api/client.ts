import axios from 'axios';
import {
  ClinicalPatientMetadata,
  FinalReportResponse,
  PanoramaHiTLGoldenJson,
} from '../types/finalReport';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 60000,
});

apiClient.interceptors.request.use(
  (config) => {
    const envToken = import.meta.env.VITE_API_TOKEN || localStorage.getItem('DPR_API_TOKEN');
    if (envToken && config.headers) {
      config.headers['X-API-Token'] = envToken;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Call Error:', error.response || error.message);
    return Promise.reject(error);
  }
);

export const checkHealth = async () => {
  const res = await apiClient.get('/health');
  return res.data;
};

export const inferPanorama = async (
  file: File,
  use004: boolean = false,
  clinicalMeta?: ClinicalPatientMetadata
): Promise<FinalReportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  if (clinicalMeta) {
    const cleaned: Record<string, unknown> = {};
    Object.entries(clinicalMeta).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        cleaned[k] = v;
      }
    });
    if (Object.keys(cleaned).length > 0) {
      formData.append('clinical_metadata', JSON.stringify(cleaned));
    }
  }

  const res = await apiClient.post<FinalReportResponse>(`/infer?use_004=${use004}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  return res.data;
};

export const saveHiTLGoldenToServer = async (
  goldenDoc: PanoramaHiTLGoldenJson
): Promise<{ status: string; saved_path: string; document_id: string }> => {
  const res = await apiClient.post('/hitl/save', goldenDoc);
  return res.data;
};

export default apiClient;
