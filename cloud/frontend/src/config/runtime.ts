const apiBase = (
  import.meta.env.VITE_API_BASE_URL
  ?? 'https://atlas-cloud-lab-gateway.onrender.com'
).replace(/\/$/,'')

const wsBase = (
  import.meta.env.VITE_WS_BASE_URL
  ?? 'wss://atlas-cloud-lab-gateway.onrender.com'
).replace(/\/$/, '')s

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
