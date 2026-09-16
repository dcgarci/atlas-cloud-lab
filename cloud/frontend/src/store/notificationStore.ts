import {create} from 'zustand'

type NoticeLevel='INFO'|'SUCCESS'|'ATTENTION'|'CRITICAL'
export type AtlasNotice={
  id:string
  ts:number
  level:NoticeLevel
  title:string
  message:string
  screen?:'live'|'context'|'decision'|'signal'|'trade'|'risk'|'lab'|'journal'|'strategy'|'audit'|'historical'|'test'|'settings'
  actionLabel?:string
  dedupeKey?:string
  count?:number
  read?:boolean
}

type State={
  items:AtlasNotice[]
  push:(notice:Omit<AtlasNotice,'id'|'ts'|'count'|'read'>)=>void
  markAllRead:()=>void
  dismiss:(id:string)=>void
  clear:()=>void
}

export const useNotificationStore=create<State>((set)=>({
  items:[],
  push:(notice)=>set(state=>{
    const now=Date.now()
    const key=notice.dedupeKey
    if(key){
      const idx=state.items.findIndex(x=>x.dedupeKey===key&&now-x.ts<30000)
      if(idx>=0){
        const next=[...state.items]
        next[idx]={...next[idx],...notice,ts:now,count:(next[idx].count??1)+1,read:false}
        return {items:next}
      }
    }
    const item:AtlasNotice={...notice,id:`n-${now}-${Math.random().toString(36).slice(2,7)}`,ts:now,count:1,read:false}
    return {items:[item,...state.items].slice(0,80)}
  }),
  markAllRead:()=>set(state=>({items:state.items.map(x=>({...x,read:true}))})),
  dismiss:(id)=>set(state=>({items:state.items.filter(x=>x.id!==id)})),
  clear:()=>set({items:[]}),
}))
