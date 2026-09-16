import {create} from 'zustand'
import {api} from '../api/client'

type AutoMode='CONFIRMED'|'RESPONSIVE'
type ProtectionMode='AUTO_FIXED'|'FREE'
type TrailingMode='AUTOMATIC'|'FREE'
type TrailingUnit='POINTS'|'MONEY'

type TrailingConfig={
  mode:TrailingMode
  enabled:boolean
  unit:TrailingUnit
  start:number
  distance:number
  step:number
  breakEvenEnabled:boolean
  breakEvenBuffer:number
  mfeLockPct:number
}

type State={
  status:any|null
  report:any|null
  history:any[]
  automation:any|null
  protectionEvents:any[]
  quantity:number
  lastError:string|null
  setQuantity:(v:number)=>void
  refresh:()=>Promise<void>
  buy:(setup?:string|null)=>Promise<void>
  sell:(setup?:string|null)=>Promise<void>
  close:()=>Promise<void>
  partial:(quantity?:number)=>Promise<void>
  reverse:()=>Promise<void>
  breakEven:()=>Promise<void>
  setProtection:(stopPrice:number|null,targetPrice:number|null)=>Promise<void>
  configure:(slippagePoints:number,pointValue:number)=>Promise<void>
  configureProtection:(mode:ProtectionMode,stopPoints:number,targetPoints:number)=>Promise<void>
  configureTrailing:(config:TrailingConfig)=>Promise<void>
  configureAutomation:(enabled:boolean,mode:AutoMode,quantity?:number)=>Promise<void>
  cancelAll:()=>Promise<void>
}

async function post(path:string,body?:any){
  return api<any>(path,{
    method:'POST',
    body:body?JSON.stringify(body):undefined,
  })
}

async function action(set:any,get:any,fn:()=>Promise<any>){
  try{
    set({lastError:null})
    await fn()
    await get().refresh()
  }catch(err:any){
    set({lastError:err?.message??'Falha no Chart Trading'})
  }
}

export const useChartTradingStore=create<State>((set,get)=>({
  status:null,
  report:null,
  history:[],
  automation:null,
  protectionEvents:[],
  quantity:1,
  lastError:null,

  setQuantity:(v)=>set({quantity:Math.max(1,Math.min(100,v))}),

  refresh:async()=>{
    try{
      const [status,report,history,automation,protectionEvents]=await Promise.all([
        api<any>('/api/chart-trading/status'),
        api<any>('/api/chart-trading/report'),
        api<any[]>('/api/chart-trading/history?limit=100'),
        api<any>('/api/chart-trading/automation/status'),
        api<any[]>('/api/chart-trading/protection-events?limit=80'),
      ])
      set({status,report,history,automation,protectionEvents,lastError:null})
    }catch(err:any){
      set({lastError:err?.message??'Falha ao atualizar Chart Trading'})
    }
  },

  buy:(setup)=>action(set,get,()=>post('/api/chart-trading/buy',{quantity:get().quantity,setup:setup??null})),
  sell:(setup)=>action(set,get,()=>post('/api/chart-trading/sell',{quantity:get().quantity,setup:setup??null})),
  close:()=>action(set,get,()=>post('/api/chart-trading/close')),
  partial:(quantity)=>action(set,get,()=>post('/api/chart-trading/partial',{quantity:quantity??null})),
  reverse:()=>action(set,get,()=>post('/api/chart-trading/reverse')),
  breakEven:()=>action(set,get,()=>post('/api/chart-trading/break-even')),
  setProtection:(stopPrice,targetPrice)=>action(set,get,()=>post('/api/chart-trading/protection',{stop_price:stopPrice,target_price:targetPrice})),
  configure:(slippagePoints,pointValue)=>action(set,get,()=>post('/api/chart-trading/config',{slippage_points:slippagePoints,point_value:pointValue})),
  configureProtection:(mode,stopPoints,targetPoints)=>action(set,get,()=>post('/api/chart-trading/protection-config',{
    mode,
    stop_points:stopPoints,
    target_points:targetPoints,
  })),
  configureTrailing:(config)=>action(set,get,()=>post('/api/chart-trading/trailing-config',{
    mode:config.mode,
    enabled:config.enabled,
    unit:config.unit,
    start:config.start,
    distance:config.distance,
    step:config.step,
    break_even_enabled:config.breakEvenEnabled,
    break_even_buffer:config.breakEvenBuffer,
    mfe_lock_pct:config.mfeLockPct,
  })),
  configureAutomation:(enabled,mode,quantity)=>action(set,get,()=>post('/api/chart-trading/automation/config',{
    enabled,
    mode,
    quantity:quantity??get().quantity,
  })),
  cancelAll:()=>action(set,get,()=>post('/api/chart-trading/cancel-all')),
}))
