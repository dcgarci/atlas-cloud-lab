const apiBase = (
  import.meta.env.VITE_API_BASE_URL
  ?? 'http://127.0.0.1:8000'
).replace(/\/$/,'')

const wsBase = (
  import.meta.env.VITE_WS_BASE_URL
  ?? 'ws://127.0.0.1:8000'
).replace(/\/$/,'')

export const runtime = {
  apiBase,
  wsBase,
}

export function apiUrl(path:string){
  return `${runtime.apiBase}${path}`
}

export function wsUrl(path:string){
  return `${runtime.wsBase}${path}`
}
