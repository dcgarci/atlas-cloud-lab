import {apiUrl} from '../config/runtime'
import {create} from 'zustand'

type State={
  data:any|null
  error:string|null
  refresh:()=>Promise<void>
}

export const useSignalStore=create<State>((set)=>({
  data:null,
  error:null,

  refresh:async()=>{
    try{
      const r=await fetch(apiUrl('/api/signal/status'))
      if(!r.ok)throw new Error(`HTTP ${r.status}`)
      set({data:await r.json(),error:null})
    }catch(e){
      set({error:String(e)})
    }
  }
}))
