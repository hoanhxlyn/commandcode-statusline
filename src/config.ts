import axios from 'axios'
import { FETCH_TIMEOUT_MS } from './constants'

export function createApiClient(apiKey: string) {
  return axios.create({
    baseURL: 'https://api.commandcode.ai',
    headers: { Authorization: `Bearer ${apiKey}` },
    timeout: FETCH_TIMEOUT_MS,
  })
}
