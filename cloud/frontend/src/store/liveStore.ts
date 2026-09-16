import {wsUrl} from '../config/runtime'
import {create} from 'zustand'

export type LiveSnapshot={
  state:string
  direction:string
  action:string
  price:number|null
  vwap:number|null
  atr:number|null
  rvol:number|null
  trend_score:number
  reversal_score:number
  exit_score:number
  candles:any[]
  markers:any[]
}

type State={
  connected:boolean
  snapshot:LiveSnapshot|null
  connect:()=>()=>void
}

export const useLiveStore=create<State>((set)=>({
  connected:false,
  snapshot:null,
  connect:()=>{
    let disposed=false
    let timer:number|undefined
    let ws:WebSocket|null=null

    const start=()=>{
      if(disposed)return
      ws=new WebSocket(wsUrl('/ws/live'))

      ws.onopen=()=>set({connected:true})
      ws.onclose=()=>{
        set({connected:false})
        if(!disposed)timer=window.setTimeout(start,2000)
      }
      ws.onerror=()=>set({connected:false})
      ws.onmessage=(event)=>{
        try{
          const msg=JSON.parse(event.data)
          if(msg.type==='live_snapshot'){
            set({snapshot:msg.data})
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
