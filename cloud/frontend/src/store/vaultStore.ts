import {create} from 'zustand'
import {api,token} from '../api/client'
import {apiUrl} from '../config/runtime'

export type VaultSession={
  session_id:string
  market_date:string
  symbol:string
  tick_count:number
  candle_count:number
  first_ts:string|null
  last_ts:string|null
  low:number|null
  high:number|null
  recorded:boolean
  source?:string
  fidelity?:string
  replay_mode?:'TICK'|'CANDLE'|string
  intrabar_execution?:string
  timeframe?:string
}

type State={
  sessions:VaultSession[]
  summary:any|null
  replay:any|null
  loading:boolean
  error:string|null
  refresh:(symbol:string,startDate:string,endDate:string)=>Promise<void>
  refreshReplay:()=>Promise<void>
  startReplay:(sessionIds:string[],speed:number)=>Promise<boolean>
  pause:()=>Promise<void>
  resume:()=>Promise<void>
  stepTick:()=>Promise<void>
  stepCandle:()=>Promise<void>
  setSpeed:(speed:number)=>Promise<void>
  importReplayFiles:(files:File[],symbol:string,timeframe:string)=>Promise<any[]>
}

async function post(path:string,body?:any){
  return api<any>(path,{method:'POST',body:body?JSON.stringify(body):undefined})
}

export const useVaultStore=create<State>((set,get)=>({
  sessions:[],
  summary:null,
  replay:null,
  loading:false,
  error:null,

  refresh:async(symbol,startDate,endDate)=>{
    set({loading:true,error:null})
    try{
      const q=new URLSearchParams()
      if(symbol)q.set('symbol',symbol)
      if(startDate)q.set('start_date',startDate)
      if(endDate)q.set('end_date',endDate)
      q.set('limit','500')
      const [sessions,summary]=await Promise.all([
        api<VaultSession[]>(`/api/feed/vault/sessions?${q.toString()}`),
        api<any>(`/api/feed/vault/summary${symbol?`?symbol=${encodeURIComponent(symbol)}`:''}`),
      ])
      set({sessions,summary,loading:false})
    }catch(err:any){
      set({loading:false,error:err?.message??'Falha ao consultar cofre histórico'})
    }
  },

  refreshReplay:async()=>{
    try{set({replay:await api<any>('/api/feed/vault/replay/status')})}catch{}
  },

  startReplay:async(sessionIds,speed)=>{
    try{
      set({error:null})
      const replay=await post('/api/feed/vault/replay/start',{
        session_ids:sessionIds,
        timeframe:'5m',
        speed,
        start_paused:false,
        reset_paper:true,
      })
      set({replay})
      return true
    }catch(err:any){
      set({error:err?.message??'Falha ao iniciar replay interno'})
      return false
    }
  },

  pause:async()=>{try{set({replay:await post('/api/feed/vault/replay/pause')})}catch{}},
  resume:async()=>{try{set({replay:await post('/api/feed/vault/replay/resume')})}catch{}},
  stepTick:async()=>{try{set({replay:await post('/api/feed/vault/replay/step?count=1')})}catch{}},
  stepCandle:async()=>{try{set({replay:await post('/api/feed/vault/replay/step-candle')})}catch{}},
  setSpeed:async(speed)=>{try{set({replay:await post('/api/feed/vault/replay/speed',{speed})})}catch{}},

  importReplayFiles:async(files,symbol,timeframe)=>{
    set({loading:true,error:null})
    const results:any[]=[]
    try{
      for(const file of files){
        const body=new FormData()
        body.append('file',file)
        body.append('symbol',symbol)
        body.append('timeframe',timeframe)
        const headers:Record<string,string>={}
        const t=token();if(t)headers.Authorization=`Bearer ${t}`
        const response=await fetch(apiUrl('/api/feed/vault/import-csv'),{method:'POST',headers,body})
        const payload=await response.json().catch(()=>({}))
        if(!response.ok)throw new Error(typeof payload?.detail==='string'?payload.detail:`Falha ao importar ${file.name}`)
        results.push(payload)
      }
      set({loading:false})
      return results
    }catch(err:any){
      set({loading:false,error:err?.message??'Falha ao importar Replay real'})
      throw err
    }
  },
}))
