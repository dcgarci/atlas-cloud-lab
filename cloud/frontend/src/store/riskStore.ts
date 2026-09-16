import {apiUrl} from '../config/runtime'
import {create} from 'zustand'

type State={
  data:any|null
  profiles:any[]
  active:any|null
  error:string|null
  refresh:()=>Promise<void>
  setActive:(id:number)=>Promise<void>
}

export const useRiskStore=create<State>((set,get)=>({
  data:null,
  profiles:[],
  active:null,
  error:null,

  refresh:async()=>{
    try{
      const [status,profiles,active]=await Promise.all([
        fetch(apiUrl('/api/risk/status')),
        fetch(apiUrl('/api/risk/profiles')),
        fetch(apiUrl('/api/risk/active')),
      ])

      if(!status.ok||!profiles.ok||!active.ok){
        throw new Error('Falha ao carregar risco')
      }

      set({
        data:await status.json(),
        profiles:await profiles.json(),
        active:await active.json(),
        error:null,
      })
    }catch(e){
      set({error:String(e)})
    }
  },

  setActive:async(id:number)=>{
    const r=await fetch(
      apiUrl(`/api/risk/active/${id}`),
      {method:'POST'}
    )

    if(!r.ok){
      throw new Error('Falha ao ativar perfil')
    }

    await get().refresh()
  }
}))
