import {useEffect,useMemo,useState} from 'react'
import {useVaultStore} from '../store/vaultStore'
import {useFeedStore} from '../store/feedStore'
import {api} from '../api/client'
import {useNotificationStore} from '../store/notificationStore'

function dateFromTs(ts:any){const s=String(ts??'');return /^\d{4}-\d{2}-\d{2}/.test(s)?s.slice(0,10):new Date().toISOString().slice(0,10)}
function hhmm(ts:any){const s=String(ts??'');const p=s.includes('T')?s.split('T')[1]:'';return p.slice(0,5)||'--:--'}

export function ReplayControlBar(){
  const feed=useFeedStore(s=>s.status)
  const sessions=useVaultStore(s=>s.sessions)
  const replay=useVaultStore(s=>s.replay)
  const refresh=useVaultStore(s=>s.refresh)
  const refreshReplay=useVaultStore(s=>s.refreshReplay)
  const startReplay=useVaultStore(s=>s.startReplay)
  const pause=useVaultStore(s=>s.pause)
  const resume=useVaultStore(s=>s.resume)
  const setSpeed=useVaultStore(s=>s.setSpeed)
  const push=useNotificationStore(s=>s.push)
  const [symbol,setSymbol]=useState(()=>String(feed?.symbol??'WINV26'))
  const [date,setDate]=useState(()=>dateFromTs(feed?.last_exchange_ts))
  const [speed,setLocalSpeed]=useState(1)
  const [loading,setLoading]=useState(false)

  useEffect(()=>{refreshReplay();const id=window.setInterval(refreshReplay,700);return()=>window.clearInterval(id)},[refreshReplay])
  useEffect(()=>{if(feed?.symbol)setSymbol(String(feed.symbol))},[feed?.symbol])
  useEffect(()=>{const d=dateFromTs(feed?.last_exchange_ts);if(d&&d!==new Date().toISOString().slice(0,10))setDate(d)},[feed?.last_exchange_ts])

  const daySessions=useMemo(()=>sessions.filter(s=>s.symbol===symbol&&s.market_date===date),[sessions,symbol,date])
  const selected=daySessions[0]??null
  const progress=Math.max(0,Math.min(100,Number(replay?.progress_pct??0)*100))
  const externalReplay=String(feed?.source??'')==='PROFIT_EXCEL'&&String(feed?.market_mode??'').toUpperCase()==='REPLAY'

  const loadDay=async()=>{setLoading(true);await refresh(symbol,date,date);setLoading(false)}
  const play=async()=>{
    if(replay?.active){if(replay?.paused)await resume();return}
    let session=selected
    if(!session){
      setLoading(true)
      try{
        const rows=await api<any[]>(`/api/feed/vault/sessions?symbol=${encodeURIComponent(symbol)}&start_date=${date}&end_date=${date}&limit=20`)
        session=rows[0]??null
      }catch{}
      setLoading(false)
    }
    if(!session){push({level:'ATTENTION',title:'REPLAY SEM HISTÓRICO',message:`Não há ticks reais de ${symbol} em ${date}. Importe um CSV tick a tick do Profit/Excel ou capture o Replay com a planilha conectada.`,screen:'historical',actionLabel:'ABRIR BANCO DE REPLAYS',dedupeKey:`replay-missing-${symbol}-${date}`});return}
    await startReplay([session.session_id],speed)
  }
  const finish=async()=>{
    try{await api('/api/feed/stop',{method:'POST'});await refreshReplay();push({level:'INFO',title:'REPLAY FINALIZADO',message:'A reprodução local foi encerrada pelo operador.',screen:'live',dedupeKey:'replay-finished'})}catch{}
  }
  const changeSpeed=async(v:number)=>{setLocalSpeed(v);if(replay?.active)await setSpeed(v)}

  return <div className="cockpit-replay-bar">
    <div className="replay-field symbol"><span>ATIVO</span><input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())}/></div>
    <div className="replay-field date"><span>DATA</span><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></div>
    <button className="replay-load" onClick={loadDay}>{loading?'...':'CARREGAR'}</button>
    <button className="replay-control play" onClick={play} title="Play / Retomar">▶</button>
    <button className="replay-control" onClick={pause} disabled={!replay?.active} title="Pause">Ⅱ</button>
    <div className="replay-speed"><span>VELOCIDADE</span>{[1,2,3,4,5].map(v=><button className={Number(replay?.speed??speed)===v?'active':''} onClick={()=>changeSpeed(v)} key={v}>{v}x</button>)}</div>
    <div className="replay-timeline">
      <div className="replay-time-labels"><span>{selected?hhmm(selected.first_ts):'ABERTURA'}</span><b>{replay?.active?(replay?.paused?'PAUSADO':'EXECUTANDO'):(externalReplay?'PROFIT REPLAY':'PARADO')}</b><span>{selected?hhmm(selected.last_ts):'FECHAMENTO'}</span></div>
      <div className="replay-track"><i style={{width:`${progress}%`}}/><em style={{left:`${progress}%`}}/></div>
    </div>
    <button className="replay-finish" onClick={finish}>FINALIZAR</button>
  </div>
}
