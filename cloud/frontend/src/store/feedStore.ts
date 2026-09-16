import {wsUrl} from '../config/runtime'
import {create} from 'zustand'

export type FeedQuality={
  accepted:number
  rejected:number
  duplicates:number
  out_of_order:number
  invalid_ohlc:number
  invalid_timestamp:number
  future_timestamp:number
}

export type FeedStatus={
  state:string
  source:string
  symbol:string
  timeframe:string
  last_exchange_ts:string|null
  last_receive_ts:string|null
  feed_lag_seconds:number|null
  heartbeat_age_seconds:number|null
  source_heartbeat_age_seconds:number|null
  quality:FeedQuality
  last_error:string|null
  signals_frozen:boolean
  ticks_received:number
  partial_updates:number
  last_price:number|null
  bid:number|null
  ask:number|null
  transport_state:string
  reads_ok:number
  read_errors:number
  reconnects:number
  consecutive_read_errors:number
  last_reconnect_at:string|null
  market_mode:string
}

type State={
  connected:boolean
  status:FeedStatus|null
  lastTick:any|null
  partialCandle:any|null
  connect:()=>()=>void
}

export const useFeedStore=create<State>((set)=>({
  connected:false,
  status:null,
  lastTick:null,
  partialCandle:null,

  connect:()=>{
    let disposed=false
    let ws:WebSocket|null=null
    let timer:number|undefined

    const start=()=>{
      if(disposed)return

      ws=new WebSocket(wsUrl('/ws/feed'))

      ws.onopen=()=>set({connected:true})

      ws.onclose=()=>{
        set({connected:false})
        if(!disposed)timer=window.setTimeout(start,2000)
      }

      ws.onerror=()=>set({connected:false})

      ws.onmessage=(event)=>{
        try{
          const msg=JSON.parse(event.data)
          if(msg.type==='feed_status'){
            set({status:msg.data})
          }
          if(msg.type==='market_tick'){
            set({lastTick:msg.data})
          }
          if(msg.type==='partial_candle'){
            set({partialCandle:msg.data})
          }
        }catch{}
      }
    }

    start()

    return()=>{
      disposed=true
      if(timer)window.clearTimeout(timer)
      ws?.close()
    }
  }
}))
