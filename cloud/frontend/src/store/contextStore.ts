import {apiUrl} from '../config/runtime'
import {create} from 'zustand'

export type MarketContext={
  market_date:string|null
  symbol:string
  session_phase:string
  day_regime:string
  volatility:string
  d1_fibonacci:Record<string,number>
  nearest_d1_fib:string|null
  nearest_d1_fib_price:number|null
  seven_day:{
    high:number|null
    low:number|null
    mid:number|null
    position_pct:number|null
    location:string
    close_direction:string
    range_regime:string
    sessions_used:number
    top_levels:{price:number;touches:number;strength:string;distance_points:number|null}[]
    bottom_levels:{price:number;touches:number;strength:string;distance_points:number|null}[]
  }
  multi_timeframe:{
    bias_5m:string
    bias_15m:string
    aligned:boolean
  }
  opening_range:{
    high:number|null
    low:number|null
    mid:number|null
    range_points:number|null
    state:string
  }
  initial_balance:{
    high:number|null
    low:number|null
    mid:number|null
    range_points:number|null
    state:string
  }
  opening_gap:{
    direction:string
    state:string
    points:number
    percent_of_d1_range:number|null
  }
  scores:{
    reversal:number
    trend:number
    no_trade_risk:number
  }
  reasons:string[]
}

type State={
  status:MarketContext|null
  error:string|null
  refresh:()=>Promise<void>
}

export const useContextStore=create<State>((set)=>({
  status:null,
  error:null,
  refresh:async()=>{
    try{
      const r=await fetch(apiUrl('/api/context/status'))
      if(!r.ok)throw new Error(`${r.status}`)
      set({status:await r.json(),error:null})
    }catch(e){
      set({error:String(e)})
    }
  }
}))
