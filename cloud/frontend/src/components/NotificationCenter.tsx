import {useEffect,useMemo,useRef,useState} from 'react'
import {useNotificationStore} from '../store/notificationStore'
import {useAppStore} from '../store/appStore'
import {useFeedStore} from '../store/feedStore'
import {useChartTradingStore} from '../store/chartTradingStore'
import {useSessionStore} from '../store/sessionStore'
import {AtlasIcon} from './AtlasIcon'

export function AtlasSystemWatchdog(){
  const push=useNotificationStore(s=>s.push)
  const feed=useFeedStore(s=>s.status)
  const chart=useChartTradingStore(s=>s.status)
  const chartError=useChartTradingStore(s=>s.lastError)
  const session=useSessionStore(s=>s.status)
  const previous=useRef<Record<string,string>>({})

  useEffect(()=>{
    const state=String(feed?.state??'')
    const last=previous.current.feed
    if(state&&last&&state!==last){
      if(state==='LIVE')push({level:'SUCCESS',title:'FONTE DE DADOS',message:'Feed de mercado conectado e recebendo atualizações.',screen:'settings',actionLabel:'VER FONTE',dedupeKey:'feed-live'})
      if(['DEGRADED','STALE'].includes(state))push({level:'ATTENTION',title:'FEED COM ATENÇÃO',message:`A fonte está em estado ${state}. Verifique atraso, timestamp e Excel/RTD.`,screen:'settings',actionLabel:'IR PARA FONTE',dedupeKey:'feed-degraded'})
      if(state==='ERROR')push({level:'CRITICAL',title:'FALHA NO FEED',message:String(feed?.last_error??'A fonte de mercado entrou em estado de erro.'),screen:'settings',actionLabel:'ABRIR DIAGNÓSTICO',dedupeKey:'feed-error'})
    }
    if(state)previous.current.feed=state
  },[feed?.state,feed?.last_error,push])

  useEffect(()=>{
    if(!chartError)return
    if(previous.current.chartError===chartError)return
    previous.current.chartError=chartError
    push({level:'CRITICAL',title:'CHART TRADING',message:chartError,screen:'live',actionLabel:'VER POSIÇÃO',dedupeKey:'chart-error'})
  },[chartError,push])

  useEffect(()=>{
    if(!chart||chart.side==='FLAT')return
    if(chart.protection_mode==='AUTO_FIXED'&&!chart.protection_armed){
      push({level:'CRITICAL',title:'PROTEÇÃO NÃO ARMADA',message:'Existe posição aberta sem STOP/ALVO armados no motor.',screen:'live',actionLabel:'IR PARA CHART TRADING',dedupeKey:'protection-unarmed'})
    }
  },[chart?.side,chart?.protection_armed,chart?.protection_mode,push])

  useEffect(()=>{
    const gaps=Number(session?.gaps_open??0)
    if(gaps>0)push({level:'ATTENTION',title:'INTEGRIDADE DA SESSÃO',message:`Foram detectados ${gaps} gap(s) na sessão atual.`,screen:'audit',actionLabel:'ABRIR AUDITORIA',dedupeKey:'session-gaps'})
  },[session?.gaps_open,push])

  return null
}

export function NotificationCenter(){
  const items=useNotificationStore(s=>s.items)
  const markAllRead=useNotificationStore(s=>s.markAllRead)
  const dismiss=useNotificationStore(s=>s.dismiss)
  const clear=useNotificationStore(s=>s.clear)
  const setScreen=useAppStore(s=>s.setScreen)
  const [open,setOpen]=useState(false)
  const [toastId,setToastId]=useState<string|null>(null)
  const lastSeenRef=useRef<string|null>(null)

  const unread=items.filter(x=>!x.read).length
  const toast=useMemo(()=>items.find(x=>x.id===toastId)??null,[items,toastId])

  useEffect(()=>{
    const latest=items[0]
    if(!latest||latest.id===lastSeenRef.current)return
    lastSeenRef.current=latest.id
    setToastId(latest.id)
    const id=window.setTimeout(()=>setToastId(current=>current===latest.id?null:current),5200)
    return()=>window.clearTimeout(id)
  },[items])

  const go=(screen:any,id?:string)=>{
    if(screen)setScreen(screen)
    if(id)dismiss(id)
    setOpen(false)
  }

  return <div className="atlas-notification-wrap">
    <button className={`atlas-notification-button ${unread?'has-unread':''}`} onClick={()=>{setOpen(v=>!v);if(!open)markAllRead()}} title="Central de Notificações">
      <AtlasIcon name="bell" size={18}/>{unread>0&&<b>{Math.min(unread,99)}</b>}
    </button>

    {open&&<div className="atlas-notification-panel">
      <header><div><span>CENTRAL ATLAS</span><strong>NOTIFICAÇÕES</strong></div><button onClick={clear}>LIMPAR</button></header>
      <div className="atlas-notification-list">
        {items.length===0&&<div className="atlas-notification-empty">NENHUMA NOTIFICAÇÃO</div>}
        {items.map(item=><article key={item.id} className={`notice-${item.level.toLowerCase()}`} onClick={()=>item.screen&&go(item.screen,item.id)} title={item.screen?'Clique para abrir a aba relacionada':undefined}>
          <div><i/><span>{item.level}{(item.count??1)>1?` · ${item.count}x`:''}</span><time>{new Date(item.ts).toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}</time></div>
          <strong>{item.title}</strong>
          <p>{item.message}</p>
          <footer>
            {item.screen&&<button onClick={()=>go(item.screen,item.id)}>{item.actionLabel??'IR PARA ABA'}</button>}
            <button className="ghost" onClick={()=>dismiss(item.id)}>FECHAR</button>
          </footer>
        </article>)}
      </div>
    </div>}

    {toast&&!open&&<div className={`atlas-notification-toast notice-${toast.level.toLowerCase()}`} onClick={()=>toast.screen&&go(toast.screen,toast.id)}>
      <i/><div><span>{toast.level}</span><strong>{toast.title}</strong><p>{toast.message}</p></div>
    </div>}
  </div>
}
