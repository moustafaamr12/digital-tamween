import axios from 'axios'

const tamween = axios.create({ baseURL: 'http://localhost:3000' })

tamween.interceptors.request.use((config) => {
  const token = sessionStorage.getItem('gov_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export default tamween
