import {apiUrl} from '../config/runtime'
import {create} from 'zustand'

export type SessionStatus={
  state:string
  session_id:string|null
  market_date:string|null
  symbol:string
  timeframe:string
  contract:string|null
  d1:{
    high:number
    low:number
    close:number
    source_session_id:string
  }|null
  session_vwap:number|null
  candle_count:number
  expected_candles:number
  gaps_open:number
  completeness:number
  last_candle_ts:string|null
  signals_frozen:boolean
}

type State={
  status:SessionStatus|null
  error:string|null
  refresh:()=>Promise<void>
}

export const useSessionStore=create<State>((set)=>({
  status:null,
  error:null,
  refresh:async()=>{
    try{
      const r=await fetch(apiUrl('/api/session/status'))
      if(!r.ok)throw new Error(`${r.status}`)
      set({status:await r.json(),error:null})
    }catch(e){
      set({error:String(e)})
    }
  }
}))
