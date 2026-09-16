import {create} from 'zustand'
import {api} from '../api/client'

type Screen='live'|'context'|'decision'|'signal'|'trade'|'risk'|'lab'|'journal'|'strategy'|'audit'|'historical'|'test'|'bridge'|'settings'

type User={
  id:number
  name:string
  email:string
}

type State={
  screen:Screen
  user:User|null
  ready:boolean
  experienceReady:boolean
  setScreen:(s:Screen)=>void
  setUser:(u:User|null)=>void
  completeExperienceBoot:()=>void
  boot:()=>Promise<void>
  logout:()=>Promise<void>
}

export const useAppStore=create<State>((set)=>({
  screen:'live',
  user:null,
  ready:false,
  experienceReady:false,
  setScreen:(screen)=>set({screen}),
  setUser:(user)=>set({user,experienceReady:false}),
  completeExperienceBoot:()=>set({experienceReady:true}),
  boot:async()=>{
    const authenticatedThisSession=sessionStorage.getItem('atlas_authenticated_this_session')==='1'
    const rememberMe=localStorage.getItem('atlas_remember_me')==='1'
    const hasToken=Boolean(localStorage.getItem('ort_token'))

    // Fresh sessions show Login unless the operator explicitly enabled
    // "Manter-me conectado". A page refresh in the same session may reuse
    // the authenticated token without bypassing the Login rule.
    if((!authenticatedThisSession&&!rememberMe)||!hasToken){
      if(!authenticatedThisSession&&!rememberMe)localStorage.removeItem('ort_token')
      set({ready:true,user:null,experienceReady:false})
      return
    }

    try{
      const user=await api<User>('/api/auth/me')
      set({ready:true,user,experienceReady:false})
    }catch{
      localStorage.removeItem('ort_token')
      localStorage.removeItem('atlas_remember_me')
      sessionStorage.removeItem('atlas_authenticated_this_session')
      set({ready:true,user:null,experienceReady:false})
    }
  },
  logout:async()=>{
    try{await api('/api/auth/logout',{method:'POST'})}catch{}
    localStorage.removeItem('ort_token')
    localStorage.removeItem('atlas_remember_me')
    sessionStorage.removeItem('atlas_authenticated_this_session')
    set({user:null,screen:'live',experienceReady:false})
  }
}))
