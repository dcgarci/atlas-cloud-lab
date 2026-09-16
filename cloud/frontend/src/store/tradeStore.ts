import {wsUrl} from '../config/runtime'
import {apiUrl} from '../config/runtime'
import {create} from 'zustand'

export type TradeSnapshot={
  trade_uid:string|null
  state:string
  trade_type:string|null
  direction:string
  action:string
  symbol:string
  timeframe:string
  entry_ts:string|null
  entry_price:number|null
  initial_stop_price:number|null
  initial_risk_points:number
  stop_price:number|null
  contracts:number
  point_value:number
  risk_money:number
  current_price:number|null
  vwap:number|null
  distance_to_mean_atr:number|null
  open_pnl_points:number
  mfe_points:number
  mae_points:number
  reversal_score:number
  trend_score:number
  exit_score:number
  permission_key:string|null
  permission_status:string|null
  permission_confidence:number
  setup_score:number
  mean_touched:boolean
  mean_accepted:boolean
  mean_retest:boolean
  conversion_bos:boolean
  trend_converted:boolean
  break_even_applied:boolean
  protected_stop_applied:boolean
  partial_recommended:boolean
  setup_flags:Record<string,boolean>
  structure_v2:any
  impulse_lock:any|null
  pullback_v2:any
  absorption_v2:any
  risk_preview:any
  management:any
  reasons:string[]
}

export type TradeEvent={
  ts:string
  event:string
  state:string
  trade_uid:string|null
  price:number|null
  details:Record<string,any>
}

type State={
  connected:boolean
  snapshot:TradeSnapshot|null
  events:TradeEvent[]
  connect:()=>()=>void
  refresh:()=>Promise<void>
}

export const useTradeStore=create<State>((set,get)=>({
  connected:false,
  snapshot:null,
  events:[],

  refresh:async()=>{
    try{
      const r=await fetch(
        apiUrl('/api/trade/status')
      )

      if(r.ok){
        set({snapshot:await r.json()})
      }
    }catch{}
  },

  connect:()=>{
    let disposed=false
    let ws:WebSocket|null=null
    let timer:number|undefined

    const start=()=>{
      if(disposed)return

      ws=new WebSocket(
        wsUrl('/ws/trade')
      )

      ws.onopen=()=>set({connected:true})

      ws.onclose=()=>{
        set({connected:false})

        if(!disposed){
          timer=window.setTimeout(
            start,
            2000
          )
        }
      }

      ws.onerror=()=>set({connected:false})

      ws.onmessage=(event)=>{
        try{
          const msg=JSON.parse(event.data)

          if(msg.type==='trade_snapshot'){
            set({snapshot:msg.data})
          }

          if(msg.type==='trade_event'){
            const current=get().events

            set({
              events:[
                ...current,
                msg.data,
              ].slice(-200)
            })
          }
        }catch{}
      }
    }

    start()

    return()=>{
      disposed=true

      if(timer){
        window.clearTimeout(timer)
      }

      ws?.close()
    }
  }
}))
