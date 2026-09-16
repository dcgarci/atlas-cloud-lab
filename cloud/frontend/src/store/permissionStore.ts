import {apiUrl} from '../config/runtime'
import {create} from 'zustand'

export type PermissionDecision={
  key:string
  status:string
  confidence:number
  reasons:string[]
  blockers:string[]
}

export type PermissionMatrix={
  global_locked:boolean
  global_blockers:string[]
  decisions:Record<string,PermissionDecision>
  cooldowns:{
    stop_until:string|null
    recovery_bars_remaining:number
    manual_frozen:boolean
  }
  updated_at:string|null
  ort_summary:{
    directional_bias:number
    directional_side:string
    market_score:number
    operation_score:number
    ort_permission:string
    macro_micro_state:string
    evidence_families:Record<string,number>
    unavailable_families:string[]
    notes:string[]
  }
}

type State={
  matrix:PermissionMatrix|null
  error:string|null
  refresh:()=>Promise<void>
}

export const usePermissionStore=create<State>((set)=>({
  matrix:null,
  error:null,

  refresh:async()=>{
    try{
      const r=await fetch(
        apiUrl('/api/permission/status')
      )

      if(!r.ok)throw new Error(`${r.status}`)

      set({
        matrix:await r.json(),
        error:null,
      })
    }catch(e){
      set({error:String(e)})
    }
  }
}))
