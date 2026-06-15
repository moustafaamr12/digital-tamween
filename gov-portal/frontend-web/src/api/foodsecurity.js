import axios from 'axios'

const foodsecurity = axios.create({ baseURL: 'http://localhost:3001' })

export default foodsecurity
