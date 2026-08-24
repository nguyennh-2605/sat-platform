import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
  type InternalAxiosRequestConfig,
} from 'axios';
import queryString from 'query-string';
import { trackRequestEnd, trackRequestStart } from './requestActivity';
import { endAuthSession, getValidAccessToken, refreshAccessToken } from './authSession';

type AuthRequestConfig = InternalAxiosRequestConfig & { _authRetry?: boolean };

/* The wrapper intentionally mirrors Axios' permissive generic defaults for existing callers. */
/* eslint-disable @typescript-eslint/no-explicit-any */
interface DataAxiosInstance extends Omit<AxiosInstance, 'get' | 'post' | 'put' | 'patch' | 'delete'> {
  get<T = any, R = T, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
  post<T = any, R = T, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
  put<T = any, R = T, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
  patch<T = any, R = T, D = any>(url: string, data?: D, config?: AxiosRequestConfig<D>): Promise<R>;
  delete<T = any, R = T, D = any>(url: string, config?: AxiosRequestConfig<D>): Promise<R>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  paramsSerializer: {
    serialize: (params) => queryString.stringify(params),
  },
  timeout: 60000,
  withCredentials: true,
}) as DataAxiosInstance;

// Interceptor Request
axiosClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const token = await getValidAccessToken();
    if (!token) return Promise.reject(new axios.CanceledError('Session expired'));
    config.headers.set('Authorization', `Bearer ${token}`);
    return trackRequestStart(config);
  },
  (error) => Promise.reject(error)
);

// Interceptor Response
axiosClient.interceptors.response.use(
  (response: AxiosResponse) => {
    trackRequestEnd(response.config);
    if (response && response.data) {
      return response.data;
    }
    return response;
  },
  async (error) => {
    trackRequestEnd(error.config);
    if (error.code === "ERR_CANCELED") {
      return Promise.reject(error);
    }

    const requestConfig = error.config as AuthRequestConfig | undefined;
    if (error.response?.status === 401 && requestConfig && !requestConfig._authRetry) {
      requestConfig._authRetry = true;
      const token = await refreshAccessToken();
      if (token) {
        requestConfig.headers.set('Authorization', `Bearer ${token}`);
        return axiosClient.request(requestConfig);
      }
      endAuthSession('session-expired');
    }
    return Promise.reject(error);
  }
);

export default axiosClient;
