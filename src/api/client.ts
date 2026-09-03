import axios from 'axios';
import { FinalReportResponse } from '../types/finalReport';

// Base API Client configured for Dental MSA Microservice / Gateway communication
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  timeout: 60000, // 60 seconds timeout for AI inference
});

apiClient.interceptors.request.use(
  (config) => {
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

// Health check call
export const checkHealth = async () => {
  const res = await apiClient.get('/health');
  return res.data;
};

// Panoramic inference call
export const inferPanorama = async (file: File, use004: boolean = false): Promise<FinalReportResponse> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const res = await apiClient.post<FinalReportResponse>(`/infer?use_004=${use004}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  
  return res.data;
};

export default apiClient;
