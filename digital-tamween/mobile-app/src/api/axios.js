import axios from 'axios'
import { API_URL } from '../config'

let _token = null

export function setAuthToken(t) { _token = t }

const api = axios.create({ baseURL: API_URL, timeout: 10000 })

api.interceptors.request.use((config) => {
  if (_token) config.headers.Authorization = `Bearer ${_token}`
  return config
})

export default api
