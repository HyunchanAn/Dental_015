import axios from 'axios';

// Base API Client configured for Dental MSA Microservice / Gateway communication
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

apiClient.interceptors.request.use(
  (config) => {
    // Add auth token or headers if needed in the future
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

export default apiClient;
