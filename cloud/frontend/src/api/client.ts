import {apiUrl,runtime} from '../config/runtime'

export function token(){
  return localStorage.getItem('ort_token')
}

function validationMessage(detail:any):string|null{
  if(!Array.isArray(detail))return null

  const messages=detail.map((item:any)=>{
    const field=Array.isArray(item?.loc)
      ? item.loc[item.loc.length-1]
      : null

    if(field==='password'){
      if(item?.type==='string_too_short'){
        return 'A senha precisa ter no mínimo 8 caracteres.'
      }
      return 'Senha inválida.'
    }

    if(field==='email'){
      return 'Informe um e-mail válido.'
    }

    if(field==='name'){
      return 'Informe um nome com pelo menos 2 caracteres.'
    }

    return item?.msg
      ? String(item.msg)
      : null
  }).filter(Boolean)

  return messages.length
    ? messages.join(' ')
    : null
}

function apiErrorMessage(body:any,status:number,statusText:string){
  const validation=validationMessage(body?.detail)
  if(validation)return validation

  if(typeof body?.detail==='string'){
    return body.detail
  }

  return `${status} ${statusText}`
}

export async function api<T>(
  path:string,
  options:RequestInit={}
):Promise<T>{
  const headers={
    'Content-Type':'application/json',
    ...(options.headers||{}),
  } as Record<string,string>

  const t=token()
  if(t)headers.Authorization=`Bearer ${t}`

  let response:Response

  try{
    response=await fetch(apiUrl(path),{
      ...options,
      headers,
    })
  }catch(error){
    throw new Error(
      `O frontend abriu, mas não conseguiu acessar o núcleo do ATLAS em ${runtime.apiBase}. `+
      'Verifique se a processo local do ATLAS está aberta e sem erros.'
    )
  }

  if(!response.ok){
    const body=await response.json().catch(()=>({}))

    throw new Error(
      apiErrorMessage(
        body,
        response.status,
        response.statusText
      )
    )
  }

  return response.json()
}

export async function backendHealth(
  timeoutMs=2500
):Promise<boolean>{
  const controller=new AbortController()
  const timer=window.setTimeout(
    ()=>controller.abort(),
    timeoutMs
  )

  try{
    const response=await fetch(
      apiUrl('/health'),
      {
        signal:controller.signal,
        cache:'no-store',
      }
    )

    return response.ok
  }catch{
    return false
  }finally{
    window.clearTimeout(timer)
  }
}
