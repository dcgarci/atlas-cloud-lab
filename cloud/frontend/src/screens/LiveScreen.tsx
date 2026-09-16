import {useEffect,useMemo,useRef,useState,type CSSProperties} from 'react'
import {useLiveStore} from '../store/liveStore'
import {useFeedStore} from '../store/feedStore'
import {useSessionStore} from '../store/sessionStore'
import {useContextStore} from '../store/contextStore'
import {usePermissionStore} from '../store/permissionStore'
import {useTradeStore} from '../store/tradeStore'
import {useChartTradingStore} from '../store/chartTradingStore'
import {useSignalStore} from '../store/signalStore'
import {ProfessionalMarketChart,type SignalMarker} from '../components/ProfessionalMarketChart'
import {EmptyState} from '../components/EmptyState'
import {api} from '../api/client'
import {useAppStore} from '../store/appStore'
import {operationalSoundEnabled,playOperationalSound,setOperationalSoundEnabled} from '../utils/operationalAudio'
import {requestAtlasSpeech} from '../utils/assistantSpeech'
import {
  pt,STATE_LABELS,ACTION_LABELS,DIRECTION_LABELS,
  REGIME_LABELS,SESSION_PHASE_LABELS,VOLATILITY_LABELS,
  PERMISSION_LABELS,RANGE_STATE_LABELS,SEVEN_DAY_LABELS
} from '../i18n'

function secs(v:number|null|undefined){
  if(v==null)return '—'
  return `${v.toFixed(1)}s`
}

function candleBucketTs(ts:string,timeframe:string){
  const tf=String(timeframe||'5m').toLowerCase().trim()
  const match=tf.match(/^(\d+)m$/)
  if(!match)return ts
  const minutes=Math.max(1,Number(match[1]))
  const iso=String(ts||'')
  // Aceita ISO com `T` e também timestamps com espaço. Fontes de Replay,
  // Excel/RTD e CSV podem serializar o mesmo instante de formas diferentes;
  // nunca usamos o texto bruto do timestamp para decidir se nasce uma vela.
  const m=iso.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?(.*)$/)
  if(!m){
    const parsed=Date.parse(iso)
    if(!Number.isFinite(parsed))return iso
    const d=new Date(parsed)
    const date=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    const total=d.getHours()*60+d.getMinutes()
    const bucket=Math.floor(total/minutes)*minutes
    return `${date}T${String(Math.floor(bucket/60)%24).padStart(2,'0')}:${String(bucket%60).padStart(2,'0')}:00`
  }
  const total=Number(m[2])*60+Number(m[3])
  const bucket=Math.floor(total/minutes)*minutes
  const hh=String(Math.floor(bucket/60)%24).padStart(2,'0')
  const mm=String(bucket%60).padStart(2,'0')
  return `${m[1]}T${hh}:${mm}:00${m[4]||''}`
}

function aggregateCandlesForChart(rows:any[],timeframe:string){
  const exact=new Map<string,any>()
  for(const item of rows){
    const ts=String(item?.ts??'')
    if(ts)exact.set(ts,item)
  }
  const ordered=[...exact.values()].sort((a:any,b:any)=>Date.parse(String(a.ts))-Date.parse(String(b.ts)))
  const buckets=new Map<string,any>()
  for(const item of ordered){
    const key=candleBucketTs(String(item.ts),timeframe)
    const open=Number(item.open),high=Number(item.high),low=Number(item.low),close=Number(item.close)
    const volume=Number(item.volume??0)
    if(![open,high,low,close].every(Number.isFinite))continue
    const current=buckets.get(key)
    if(!current){
      buckets.set(key,{...item,ts:key,open,high,low,close,volume})
      continue
    }
    current.high=Math.max(Number(current.high),high)
    current.low=Math.min(Number(current.low),low)
    current.close=close
    current.volume=Number(current.volume??0)+Math.max(0,volume)
    current.complete=Boolean(current.complete&&item.complete)
    current.source=item.source??current.source
  }
  return [...buckets.values()].sort((a:any,b:any)=>Date.parse(String(a.ts))-Date.parse(String(b.ts)))
}

// Contratos legados mantidos como documentação de compatibilidade dos testes históricos.
// onClick={()=>buyChart()} onClick={()=>sellChart()} onClick={()=>closeChart()}
// onClick={()=>partialChart()} onClick={()=>breakEvenChart()} onClick={()=>reverseChart()} onClick={()=>cancelChart()}
// STOP (PTS) / ALVO (PTS) / MODO LIVRE
// configureProtection('FREE', 300, 500)
// signal-direction:${direction}

export function LiveScreen(){
  const setScreen=useAppStore(s=>s.setScreen)
  const connectLive=useLiveStore(s=>s.connect)
  const liveConnected=useLiveStore(s=>s.connected)
  const snap=useLiveStore(s=>s.snapshot)

  const connectFeed=useFeedStore(s=>s.connect)
  const feedConnected=useFeedStore(s=>s.connected)
  const feed=useFeedStore(s=>s.status)
  const partial=useFeedStore(s=>s.partialCandle)
  const lastTick=useFeedStore(s=>s.lastTick)

  const session=useSessionStore(s=>s.status)
  const refreshSession=useSessionStore(s=>s.refresh)

  const context=useContextStore(s=>s.status)
  const refreshContext=useContextStore(s=>s.refresh)

  const permission=usePermissionStore(s=>s.matrix)
  const refreshPermission=usePermissionStore(s=>s.refresh)

  const trade=useTradeStore(s=>s.snapshot)
  const tradeEvents=useTradeStore(s=>s.events)
  const connectTrade=useTradeStore(s=>s.connect)

  const chartTrade=useChartTradingStore(s=>s.status)
  const chartReport=useChartTradingStore(s=>s.report)
  const chartHistory=useChartTradingStore(s=>s.history)
  const chartQty=useChartTradingStore(s=>s.quantity)
  const setChartQty=useChartTradingStore(s=>s.setQuantity)
  const refreshChartTrade=useChartTradingStore(s=>s.refresh)
  const buyChart=useChartTradingStore(s=>s.buy)
  const sellChart=useChartTradingStore(s=>s.sell)
  const closeChart=useChartTradingStore(s=>s.close)
  const reverseChart=useChartTradingStore(s=>s.reverse)
  const cancelChart=useChartTradingStore(s=>s.cancelAll)
  const partialChart=useChartTradingStore(s=>s.partial)
  const breakEvenChart=useChartTradingStore(s=>s.breakEven)
  const setProtection=useChartTradingStore(s=>s.setProtection)
  const chartError=useChartTradingStore(s=>s.lastError)
  const chartAutomation=useChartTradingStore(s=>s.automation)
  const configureAutomation=useChartTradingStore(s=>s.configureAutomation)
  const configureProtection=useChartTradingStore(s=>s.configureProtection)
  const configureTrailing=useChartTradingStore(s=>s.configureTrailing)

  const signalData=useSignalStore(s=>s.data)
  const refreshSignal=useSignalStore(s=>s.refresh)

  const [fixedStopPts,setFixedStopPts]=useState(300)
  const [fixedTargetPts,setFixedTargetPts]=useState(500)
  const [trailingStart,setTrailingStart]=useState(300)
  const [trailingDistance,setTrailingDistance]=useState(150)
  const [trailingStep,setTrailingStep]=useState(25)
  const [trailingBuffer,setTrailingBuffer]=useState(20)
  const [trailingUnit,setTrailingUnit]=useState<'POINTS'|'MONEY'>('POINTS')
  const [trailingMode,setTrailingMode]=useState<'AUTOMATIC'|'FREE'>('AUTOMATIC')
  const [trailingEnabled,setTrailingEnabled]=useState(true)
  const [soundEnabled,setSoundEnabled]=useState(operationalSoundEnabled)
  const [chartPanelWidth,setChartPanelWidth]=useState(()=>Math.max(260,Math.min(520,Number(localStorage.getItem('atlas_chart_trading_width')??305))))
  const [chartPanelCollapsed,setChartPanelCollapsed]=useState(()=>localStorage.getItem('atlas_chart_trading_collapsed')==='1')
  const [contextPanelCollapsed,setContextPanelCollapsed]=useState(()=>localStorage.getItem('atlas_context_panel_collapsed')==='1')
  const splitterDragRef=useRef<{startX:number,startWidth:number}|null>(null)
  const lastActionRef=useRef<string>('')
  const lastSignalKeyRef=useRef<string>('')
  const lastSignalDirectionRef=useRef<string>('') // compatibilidade + dedupe sem repetir a cada candle
  const lastProtectionSpeechRef=useRef<string>('')

  useEffect(()=>connectLive(),[connectLive])
  useEffect(()=>connectFeed(),[connectFeed])
  useEffect(()=>connectTrade(),[connectTrade])

  useEffect(()=>{
    localStorage.setItem('atlas_chart_trading_width',String(chartPanelWidth))
  },[chartPanelWidth])
  useEffect(()=>{
    localStorage.setItem('atlas_chart_trading_collapsed',chartPanelCollapsed?'1':'0')
  },[chartPanelCollapsed])
  useEffect(()=>{
    localStorage.setItem('atlas_context_panel_collapsed',contextPanelCollapsed?'1':'0')
  },[contextPanelCollapsed])
  useEffect(()=>{
    const move=(event:MouseEvent)=>{
      const drag=splitterDragRef.current
      if(!drag)return
      const next=Math.max(260,Math.min(520,drag.startWidth-(event.clientX-drag.startX)))
      setChartPanelWidth(next)
    }
    const up=()=>{splitterDragRef.current=null;document.body.classList.remove('atlas-resizing-panel')}
    window.addEventListener('mousemove',move)
    window.addEventListener('mouseup',up)
    return()=>{window.removeEventListener('mousemove',move);window.removeEventListener('mouseup',up)}
  },[])

  useEffect(()=>{
    refreshChartTrade()
    const id=window.setInterval(
      refreshChartTrade,
      500
    )
    return()=>window.clearInterval(id)
  },[refreshChartTrade])

  useEffect(()=>{
    const action=String(chartTrade?.last_action??'').trim()
    if(!action||action===lastActionRef.current)return
    lastActionRef.current=action
    if(action==='ALVO'){
      playOperationalSound('target')
      requestAtlasSpeech(`Alvo atingido. Resultado do trade: ${Number(chartTrade?.realized_pnl_money??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.`,'important',{dedupeKey:`trade:${action}:${chartTrade?.last_action}`,cooldownMs:6000})
      return
    }
    if(action==='STOP'){
      playOperationalSound('stop')
      requestAtlasSpeech(`Stop atingido. Resultado do trade: ${Number(chartTrade?.realized_pnl_money??0).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}.`,'important',{dedupeKey:`trade:${action}:${chartTrade?.last_action}`,cooldownMs:6000})
      return
    }
    if(/^(COMPRA|VENDA)\s+\d+\s+@/.test(action)||action.startsWith('INVERTIDO PARA')){
      playOperationalSound('entry')
      requestAtlasSpeech(`Ordem simulada executada. ${action.replace('@','no preço')}.`,'normal',{dedupeKey:`entry:${action}`,cooldownMs:12000})
    }
  },[chartTrade?.last_action,chartTrade?.realized_pnl_money])

  useEffect(()=>{
    refreshSignal()
    const id=window.setInterval(refreshSignal,650)
    return()=>window.clearInterval(id)
  },[refreshSignal])

  useEffect(()=>{
    const signal=signalData?.current_signal
    const stage=String(signal?.stage??'')
    const kind=String(signal?.kind??signal?.type??'').toUpperCase()
    if(!signal||!['RESPONSIVE','CONFIRMED'].includes(stage)){
      lastSignalKeyRef.current=''
      lastSignalDirectionRef.current=''
      return
    }
    const direction:('BUY'|'SELL'|'')=kind.includes('COMPRA')||kind.includes('LONG')?'BUY':kind.includes('VENDA')||kind.includes('SHORT')?'SELL':''
    const signalKey=`${kind}:${stage}`
    if(!direction||signalKey===lastSignalKeyRef.current)return
    lastSignalKeyRef.current=signalKey
    lastSignalDirectionRef.current=direction
    const score=Math.round(Number(signal.score??0))
    const label=String(signal.label??'').toUpperCase()
    const adjustment=kind.includes('AJUSTE')||label.includes('AJUSTE')
    const resumption=kind.includes('RETOMADA')||label.includes('RETOMADA')
    const phrase=resumption
      ? direction==='BUY'
        ? `O ajuste vendedor perdeu força. A tendência principal continua compradora e surgiu uma retomada de compra. Score ${score}.`
        : `O ajuste comprador perdeu força. A tendência principal continua vendedora e surgiu uma retomada de venda. Score ${score}.`
      : adjustment
        ? direction==='BUY'
          ? `Atenção. Surgiu uma compra de ajuste. A tendência principal continua vendedora. Score ${score}.`
          : `Atenção. Surgiu uma venda de ajuste. A tendência principal continua compradora. Score ${score}.`
        : direction==='BUY'
          ? `Atenção. Surgiu o primeiro sinal de compra. Score ${score}. Vou acompanhar a evolução.`
          : `Atenção. Surgiu o primeiro sinal de venda. Score ${score}. Vou acompanhar a evolução.`
    requestAtlasSpeech(phrase,'normal',{dedupeKey:`signal:${kind}:${direction}`,cooldownMs:60_000})
  },[signalData?.current_signal])

  useEffect(()=>{
    if(chartTrade?.fixed_stop_points!=null)setFixedStopPts(Number(chartTrade.fixed_stop_points))
    if(chartTrade?.fixed_target_points!=null)setFixedTargetPts(Number(chartTrade.fixed_target_points))
  },[chartTrade?.fixed_stop_points,chartTrade?.fixed_target_points])

  useEffect(()=>{
    if(chartTrade?.trailing_start!=null)setTrailingStart(Number(chartTrade.trailing_start))
    if(chartTrade?.trailing_distance!=null)setTrailingDistance(Number(chartTrade.trailing_distance))
    if(chartTrade?.trailing_step!=null)setTrailingStep(Number(chartTrade.trailing_step))
    if(chartTrade?.break_even_buffer!=null)setTrailingBuffer(Number(chartTrade.break_even_buffer))
    if(chartTrade?.trailing_unit)setTrailingUnit(chartTrade.trailing_unit==='MONEY'?'MONEY':'POINTS')
    if(chartTrade?.trailing_mode)setTrailingMode(chartTrade.trailing_mode==='FREE'?'FREE':'AUTOMATIC')
    if(chartTrade?.trailing_enabled!=null)setTrailingEnabled(Boolean(chartTrade.trailing_enabled))
  },[chartTrade?.trailing_start,chartTrade?.trailing_distance,chartTrade?.trailing_step,chartTrade?.break_even_buffer,chartTrade?.trailing_unit,chartTrade?.trailing_mode,chartTrade?.trailing_enabled])

  useEffect(()=>{
    const stamp=String(chartTrade?.last_protection_update_ts??'')
    if(!stamp||stamp===lastProtectionSpeechRef.current)return
    lastProtectionSpeechRef.current=stamp
    const reason=String(chartTrade?.last_protection_reason??'')
    const protectedPts=Math.round(Number(chartTrade?.protected_points??0))
    if(reason.includes('BREAK_EVEN')){
      requestAtlasSpeech('Risco reduzido. Stop movido para a região de break-even.','normal',{dedupeKey:`protection:${stamp}`,cooldownMs:5000})
    }else if(reason.includes('MFE')||reason.includes('TRAILING')){
      requestAtlasSpeech(`Proteção atualizada. ${protectedPts} pontos estão protegidos pela gestão da posição.`,'normal',{dedupeKey:`protection:${stamp}`,cooldownMs:5000})
    }
  },[chartTrade?.last_protection_update_ts,chartTrade?.last_protection_reason,chartTrade?.protected_points])

  useEffect(()=>{
    refreshSession()
    const id=window.setInterval(refreshSession,1000)
    return()=>window.clearInterval(id)
  },[refreshSession])

  useEffect(()=>{
    refreshContext()
    const id=window.setInterval(refreshContext,1000)
    return()=>window.clearInterval(id)
  },[refreshContext])

  useEffect(()=>{
    refreshPermission()
    const id=window.setInterval(refreshPermission,1000)
    return()=>window.clearInterval(id)
  },[refreshPermission])

  const closedCandles=snap?.candles??[]
  const [historicalSeed,setHistoricalSeed]=useState<any[]>([])
  const seedCutoff=String(lastTick?.ts??feed?.last_exchange_ts??'')
  const marketDate=seedCutoff.slice(0,10)

  // V2.12.5 — buffer visual seguro. O Cofre pode já possuir candles da
  // sessão (inclusive de uma captura anterior). Carregamos somente candles
  // <= timestamp atual do mercado, portanto sem look-ahead, e nunca os
  // devolvemos ao ORT Engine: servem exclusivamente para preencher o gráfico.
  useEffect(()=>{
    const symbol=String(feed?.symbol??partial?.symbol??'').trim()
    const timeframe=String(feed?.timeframe??partial?.timeframe??'').trim()
    if(!seedCutoff||!marketDate||!symbol||!timeframe){
      setHistoricalSeed([])
      return
    }

    let cancelled=false
    const path=
      `/api/feed/vault/candles/context?symbol=${encodeURIComponent(symbol)}`+
      `&timeframe=${encodeURIComponent(timeframe)}`+
      `&before_ts=${encodeURIComponent(seedCutoff)}&sessions=5&limit_per_session=180`

    api<any[]>(path)
      .then(rows=>{
        if(!cancelled)setHistoricalSeed(Array.isArray(rows)?rows:[])
      })
      .catch(()=>{
        // Histórico é uma conveniência visual. Falha aqui não pode derrubar
        // o cockpit nem congelar o feed ao vivo.
        if(!cancelled)setHistoricalSeed([])
      })

    return()=>{cancelled=true}
  },[feed?.reconnects,feed?.source,feed?.symbol,feed?.timeframe,marketDate])

  const candles=useMemo(()=>{
    const cutoffMs=Date.parse(seedCutoff)
    const eligible=(item:any)=>{
      const ts=String(item?.ts??'')
      if(!ts)return false
      const ms=Date.parse(ts)
      return !Number.isFinite(cutoffMs)||!Number.isFinite(ms)||ms<=cutoffMs
    }

    // Candlestick oficial do ATLAS: todos os updates pertencentes ao mesmo
    // bucket do timeframe atualizam UM único candle — mesmo quando a origem envia um registro por tick. O candle seguinte só nasce
    // quando o relógio cruza a fronteira do timeframe (ex.: 09:05 no 5m).
    const rows:any[]=[]
    for(const item of historicalSeed)if(eligible(item))rows.push(item)
    for(const item of closedCandles)if(eligible(item))rows.push(item)
    if(partial&&eligible(partial))rows.push({...partial,complete:false})

    return aggregateCandlesForChart(rows,String(feed?.timeframe??partial?.timeframe??'5m')).slice(-900)
  },[closedCandles,historicalSeed,partial,seedCutoff,feed?.timeframe])

  const activeSignal=signalData?.current_signal??null

  const protectionOutcome=(price:number|null|undefined)=>{
    if(price==null||chartTrade?.average_price==null||chartTrade?.side==='FLAT')return '—'
    const qty=Math.max(1,Number(chartTrade?.quantity??1))
    const direction=chartTrade?.side==='LONG'?1:-1
    const points=(Number(price)-Number(chartTrade.average_price))*direction*qty
    const money=points*Number(chartTrade?.point_value??.20)
    const moneyLabel=`${money>=0?'+':'−'}R$ ${Math.abs(money).toFixed(2)}`
    const pointsLabel=`${points>=0?'+':'−'}${Math.abs(points).toFixed(0)} pts`
    return `${moneyLabel} / ${pointsLabel}`
  }

  const signalMarkers=useMemo<SignalMarker[]>(()=>{
    const mapped:SignalMarker[]=[]
    const seen=new Set<string>()
    const history=Array.isArray(signalData?.signal_history)?signalData.signal_history:[]

    for(const signal of history){
      const stage=String(signal?.stage??'')
      if(stage!=='CONFIRMED'&&stage!=='RESPONSIVE')continue
      const kind=String(signal?.kind??'') as SignalMarker['kind']
      if(!['TENDENCIA_COMPRA','TENDENCIA_VENDA','REVERSAO_COMPRA','REVERSAO_VENDA','AJUSTE_COMPRA','AJUSTE_VENDA','RETOMADA_COMPRA','RETOMADA_VENDA'].includes(kind))continue
      const ts=String(signal?.ts??'')
      if(!ts)continue
      const id=String(signal?.id??`${ts}|${kind}`)
      if(seen.has(id))continue
      seen.add(id)
      mapped.push({
        ts,
        price:signal?.price==null?null:Number(signal.price),
        kind,
        label:String(signal?.label??kind),
        stage:stage as SignalMarker['stage'],
        score:Number(signal?.score??0),
      })
    }

    // Compatibilidade com eventos legados já persistidos no trade engine.
    if(mapped.length===0){
      for(const event of tradeEvents){
        let kind:SignalMarker['kind']|null=null
        let label=''
        if(event.event==='SETUP_CONFIRMED'){
          const key=String(event.details?.key??'')
          if(key==='TREND_LONG'){kind='TENDENCIA_COMPRA';label='TENDÊNCIA DE COMPRA'}
          if(key==='TREND_SHORT'){kind='TENDENCIA_VENDA';label='TENDÊNCIA DE VENDA'}
          if(key==='REVERSAL_LONG'){kind='REVERSAO_COMPRA';label='REVERSÃO PARA COMPRA'}
          if(key==='REVERSAL_SHORT'){kind='REVERSAO_VENDA';label='REVERSÃO PARA VENDA'}
        }
        if(event.event==='TREND_CONVERSION'){
          const direction=String(event.details?.direction??'')
          if(direction==='LONG'){kind='TENDENCIA_COMPRA';label='TENDÊNCIA DE COMPRA'}
          if(direction==='SHORT'){kind='TENDENCIA_VENDA';label='TENDÊNCIA DE VENDA'}
        }
        if(!kind||event.price==null)continue
        const id=`${event.ts}|${kind}`
        if(seen.has(id))continue
        seen.add(id)
        mapped.push({ts:event.ts,price:Number(event.price),kind,label})
      }
    }
    return mapped.slice(-120)
  },[signalData?.signal_history,tradeEvents])

  const updateProtectionFromChart=(stop:number|null,target:number|null)=>
    setProtection(stop,target)

  const frozen=(feed?.signals_frozen??true)||(session?.signals_frozen??true)

  const stateTone=
    feed?.state==='LIVE'?'ok':
    feed?.state==='DEGRADED'?'warn':
    'danger'

  const marketReadouts=[
    ['ESTADO',pt(snap?.state,STATE_LABELS)],
    ['DIREÇÃO',pt(snap?.direction,DIRECTION_LABELS)],
    ['AÇÃO',frozen?'SINAIS CONGELADOS':pt(snap?.action,ACTION_LABELS)],
    ['PREÇO',snap?.price?.toFixed(0)??'—'],
    ['VWAP',snap?.vwap?.toFixed(0)??'—'],
    ['ATR',snap?.atr?.toFixed(0)??'—'],
    ['RVOL',snap?.rvol?.toFixed(2)??'—'],
  ]

  const contextReadouts=[
    ['REGIME DO DIA',pt(context?.day_regime,REGIME_LABELS)],
    ['FASE DA SESSÃO',pt(context?.session_phase,SESSION_PHASE_LABELS)],
    ['VIÉS 5M',pt(context?.multi_timeframe?.bias_5m,REGIME_LABELS)],
    ['VIÉS 15M',pt(context?.multi_timeframe?.bias_15m,REGIME_LABELS)],
    ['VOLATILIDADE',pt(context?.volatility,VOLATILITY_LABELS)],
    ['FIB D-1',context?.nearest_d1_fib??'—'],
    ['FAIXA ABERTURA',pt(context?.opening_range?.state,RANGE_STATE_LABELS)],
    ['BALANÇO INICIAL',pt(context?.initial_balance?.state,RANGE_STATE_LABELS)],
    ['LOCALIZAÇÃO 7D',pt(context?.seven_day?.location,SEVEN_DAY_LABELS)],
    ['CTX REVERSÃO',context?.scores?.reversal??0],
    ['CTX TENDÊNCIA',context?.scores?.trend??0],
    ['RISCO NÃO OPERAR',context?.scores?.no_trade_risk??0],
    ['REV COMPRA',pt(permission?.decisions?.REVERSAL_LONG?.status,PERMISSION_LABELS)],
    ['REV VENDA',pt(permission?.decisions?.REVERSAL_SHORT?.status,PERMISSION_LABELS)],
    ['TREND COMPRA',pt(permission?.decisions?.TREND_LONG?.status,PERMISSION_LABELS)],
    ['TREND VENDA',pt(permission?.decisions?.TREND_SHORT?.status,PERMISSION_LABELS)],
  ]

  const feedReadouts=[
    ['FEED',pt(feed?.state,STATE_LABELS)],
    ['TRANSPORTE',feed?.transport_state??'—'],
    ['MODO',feed?.market_mode??'—'],
    ['SESSÃO',pt(session?.state,STATE_LABELS)],
    ['GAPS',session?.gaps_open??0],
  ]

  const sideLabel=chartTrade?.side==='LONG'?'COMPRADO':chartTrade?.side==='SHORT'?'VENDIDO':'SEM POSIÇÃO'
  const stagePt=activeSignal?.stage==='CONFIRMED'?'CONFIRMADO':activeSignal?.stage==='RESPONSIVE'?'RESPONSIVO':activeSignal?.stage==='WATCH'?'OBSERVAÇÃO':''
  const operationStatus=chartTrade?.side&&chartTrade.side!=='FLAT'
    ? `${sideLabel} · ${chartTrade.quantity??0}`
    : activeSignal?.label??'ANALISANDO MERCADO'
  const decisionCards=[
    ['REV COMPRA','REVERSAL_LONG'],['REV VENDA','REVERSAL_SHORT'],
    ['TREND COMPRA','TREND_LONG'],['TREND VENDA','TREND_SHORT'],
  ] as const

  const performanceDay=useMemo(()=>{
    const preferredDate=String(feed?.last_exchange_ts??'').slice(0,10)
    const dates=chartHistory
      .map((x:any)=>String(x.exit_ts??'').slice(0,10))
      .filter(Boolean)
      .sort()
    const fallbackDate=dates.length?dates[dates.length-1]:''
    const day=preferredDate||fallbackDate
    const rows=chartHistory.filter((x:any)=>!day||String(x.exit_ts??'').slice(0,10)===day).slice().reverse()
    let running=0
    const curve=rows.map((x:any)=>{running+=Number(x.pnl_money??0);return running})
    const automated=rows.filter((x:any)=>String(x.origin??'MANUAL').toUpperCase()==='AUTO')
    const automatedWins=automated.filter((x:any)=>Number(x.pnl_points??0)>0).length
    return {
      day,
      rows:rows.slice(-8),
      totalMoney:rows.reduce((acc:number,x:any)=>acc+Number(x.pnl_money??0),0),
      totalPoints:rows.reduce((acc:number,x:any)=>acc+Number(x.pnl_points??0),0),
      automatedTrades:automated.length,
      automatedWins,
      automationAccuracy:automated.length?(automatedWins/automated.length)*100:0,
      curve,
    }
  },[chartHistory,feed?.last_exchange_ts])

  const capitalPath=useMemo(()=>{
    const values=performanceDay.curve
    if(values.length===0)return ''
    const min=Math.min(0,...values),max=Math.max(0,...values)
    const span=Math.max(1,max-min)
    return values.map((v:number,i:number)=>{
      const x=values.length===1?50:(i/(values.length-1))*100
      const y=44-((v-min)/span)*40
      return `${i===0?'M':'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    }).join(' ')
  },[performanceDay.curve])

  return <section className={`live-screen live-screen-v2125 live-screen-v2126 live-screen-v2127 live-screen-v2128 live-screen-v2129 live-screen-v21210 live-screen-v21211 live-screen-v21212 live-screen-v21213 live-screen-v21214 live-screen-v21216-lab ${chartPanelCollapsed?'chart-panel-collapsed':''} ${contextPanelCollapsed?'context-panel-collapsed':''}`} style={{'--ct-panel-width':`${chartPanelCollapsed?0:chartPanelWidth}px`,'--ctx-panel-width':`${contextPanelCollapsed?0:245}px`} as CSSProperties}>
    <aside className="side-panel market-context-panel">
      <h3>REGIME / CONTEXTO</h3>

      <div className="panel-section-title">ESTADO DO MERCADO</div>
      {marketReadouts.map(([a,b])=><div className="readout" key={String(a)}>
        <span>{a}</span><strong>{b}</strong>
      </div>)}


      <div className="panel-section-title">CONTEXTO E PERMISSÕES</div>
      {contextReadouts.map(([a,b])=><div className="readout compact" key={String(a)}>
        <span>{a}</span><strong>{b}</strong>
      </div>)}

      <div className="panel-section-title">QUALIDADE DO FEED</div>
      {feedReadouts.map(([a,b])=><div className="readout compact" key={String(a)}>
        <span>{a}</span><strong>{b}</strong>
      </div>)}

      <div className={`feed-status ${stateTone}`}>
        <i/>{pt(feed?.state,STATE_LABELS)}
      </div>

      {!feedConnected&&<div className="feed-status warn">
        <i/>SOCKET DO FEED OFFLINE
      </div>}

      {!liveConnected&&<div className="feed-status warn">
        <i/>SOCKET AO VIVO OFFLINE
      </div>}

      {feed?.last_error&&<div className="feed-error">
        {feed.last_error}
      </div>}
    </aside>

    <div className="context-panel-splitter" title={contextPanelCollapsed?'Mostrar Regime / Contexto':'Ocultar Regime / Contexto'}>
      <button onClick={()=>setContextPanelCollapsed(v=>!v)}>{contextPanelCollapsed?'›':'‹'}</button>
    </div>

    <div className="live-center has-replay-control">
      <div className="chart-wrap">
        <ProfessionalMarketChart
          candles={candles}
          symbol={feed?.symbol??partial?.symbol??'WINV26'}
          timeframe={feed?.timeframe??partial?.timeframe??'5m'}
          lastPrice={lastTick?.price!=null?Number(lastTick.price):(snap?.price??null)}
          bid={lastTick?.bid!=null?Number(lastTick.bid):(feed?.bid??null)}
          ask={lastTick?.ask!=null?Number(lastTick.ask):(feed?.ask??null)}
          feedSource={feed?.source??'NONE'}
          paperPosition={chartTrade}
          signalMarkers={signalMarkers}
          activeSignal={activeSignal}
          marketAtr={snap?.atr??null}
          onProtectionChange={updateProtectionFromChart}
        />
      </div>

      {candles.length===0&&
        <div className="live-empty-overlay">
          <EmptyState
            eyebrow={feed?.state==='LIVE'?'FEED CONECTADO':'FEED PARADO'}
            title="AGUARDANDO CANDLES"
            description="O gráfico, a VWAP e a leitura estrutural surgem aqui assim que o ATLAS receber dados."
            actionLabel="ABRIR TESTE DO SISTEMA"
            onAction={()=>setScreen('test')}
            compact
          />
        </div>
      }

      <div className="core-label core-label-compact">
        <span>NÚCLEO ORT</span>
        <strong>{frozen?'MODO SEGURO DE FEED':pt(snap?.action,ACTION_LABELS)}</strong>
      </div>

      <div className="decision-center-compact">
        <div className="decision-center-compact-title">CENTRAL DE DECISÃO</div>
        {decisionCards.map(([label,key])=>{
          const d=permission?.decisions?.[key]
          const allowed=String(d?.status??'')==='ALLOWED'
          const pulse=allowed?(key.endsWith('LONG')?'pulse-buy':'pulse-sell'):''
          return <div className={`decision-mini ${String(d?.status??'').toLowerCase()} ${pulse}`} key={key}>
            <span>{label}</span>
            <b>{Number(d?.confidence??0)}</b>
            <small>{pt(d?.status,PERMISSION_LABELS)}</small>
          </div>
        })}
      </div>
    </div>

    <div className="chart-panel-splitter" onMouseDown={event=>{if(chartPanelCollapsed)return;splitterDragRef.current={startX:event.clientX,startWidth:chartPanelWidth};document.body.classList.add('atlas-resizing-panel')}} title="Arraste para redimensionar o Chart Trading">
      <button onMouseDown={e=>e.stopPropagation()} onClick={()=>setChartPanelCollapsed(v=>!v)} title={chartPanelCollapsed?'Mostrar Chart Trading':'Ocultar Chart Trading'}>{chartPanelCollapsed?'‹':'›'}</button>
    </div>

    <aside className="charttrading-side-panel">
      <div className="charttrading-side-head">
        <div className="ct-title-centered">
          <span>CHART TRADING</span>
          <strong>SIMULAÇÃO OPERACIONAL</strong>
        </div>
        <b>SEM ENVIO À CORRETORA</b>
      </div>

      <div className="ct-sound-row">
        <span>SOM OPERACIONAL</span>
        <button className={soundEnabled?'on':'off'} onClick={()=>{const next=!soundEnabled;setSoundEnabled(next);setOperationalSoundEnabled(next)}} title="Ativar/desativar sons de ordem, alvo e stop"><i/><b>{soundEnabled?'ON':'OFF'}</b></button>
      </div>

      <div className={`ct-market-status ${String(activeSignal?.kind??'').includes('VENDA')?'sell':String(activeSignal?.kind??'').includes('COMPRA')?'buy':'neutral'}`}>
        <span>STATUS</span>
        <strong>{operationStatus}</strong>
        <small>{stagePt?`${stagePt} · SCORE ${Number(activeSignal?.score??0)}`:'AGUARDANDO SINAL DE ENTRADA'}</small>
      </div>

      <div className="ct-side-section">
        <div className="ct-qty">
          <button onClick={()=>setChartQty(chartQty-1)}>-</button>
          <strong>{chartQty}</strong>
          <button onClick={()=>setChartQty(chartQty+1)}>+</button>
          <span>CONTRATOS</span>
        </div>

        <div className="ct-primary vertical">
          <button className="ct-buy" onClick={()=>buyChart(activeSignal?.type??null)}>COMPRAR</button>
          <button className="ct-sell" onClick={()=>sellChart(activeSignal?.type??null)}>VENDER</button>
        </div>

        <div className="ct-secondary side-grid">
          <button onClick={()=>closeChart()}>ZERAR</button>
          <button onClick={()=>partialChart()}>PARCIAL</button>
          <button onClick={()=>breakEvenChart()}>BREAK-EVEN</button>
          <button onClick={()=>reverseChart()}>INVERTER</button>
          <button className="wide" onClick={()=>cancelChart()}>CANCELAR STOP / ALVO</button>
        </div>
      </div>

      {chartError&&<div className="ct-error">{chartError}</div>}

      <div className="ct-side-section position-summary">
        <div className="ct-side-section-title">POSIÇÃO ATUAL</div>
        <div className="ct-position side">
          <span>POSIÇÃO <b className={chartTrade?.side==='SHORT'?'sell-text':chartTrade?.side==='LONG'?'buy-text':''}>{sideLabel} {chartTrade?.quantity??0}</b></span>
          <span>PREÇO MÉDIO <b>{chartTrade?.average_price?.toFixed?.(0)??'—'}</b></span>
          <span>ABERTO <b>{Number(chartTrade?.open_pnl_points??0).toFixed(0)} pts / R$ {Number(chartTrade?.open_pnl_money??0).toFixed(2)}</b></span>
          <span>STOP <b>{protectionOutcome(chartTrade?.stop_price)}</b></span>
          <span>ALVO <b>{protectionOutcome(chartTrade?.target_price)}</b></span>
          <span>REALIZADO <b>R$ {Number(chartTrade?.realized_pnl_money??0).toFixed(2)}</b></span>
        </div>
        <div className="ct-performance side">
          <span>TRADES <b>{chartReport?.trades??0}</b></span>
          <span>ACERTO <b>{Number(chartReport?.win_rate??0).toFixed(1)}%</b></span>
          <span>PF <b>{chartReport?.profit_factor==null?'—':Number(chartReport.profit_factor).toFixed(2)}</b></span>
        </div>
      </div>

      <div className="ct-side-section">
        <div className="ct-side-section-title">CHART TRADING AUTOMÁTICO</div>
        <div className="ct-auto-paper">
          <div className="ct-auto-state">
            <span>AUTOMAÇÃO</span>
            <strong className={chartAutomation?.enabled?'on':'off'}>{chartAutomation?.enabled?'ATIVA':'DESLIGADA'}</strong>
          </div>
          <div className="ct-auto-actions">
            <button className={!chartAutomation?.enabled?'active':''} onClick={()=>configureAutomation(false,'CONFIRMED',chartQty)}>OFF</button>
            <button className={chartAutomation?.enabled&&chartAutomation?.mode==='CONFIRMED'?'active':''} onClick={()=>configureAutomation(true,'CONFIRMED',chartQty)}>CONFIRMADO</button>
            <button className={chartAutomation?.enabled&&chartAutomation?.mode==='RESPONSIVE'?'active':''} onClick={()=>configureAutomation(true,'RESPONSIVE',chartQty)}>RESPONSIVO</button>
          </div>
          <div className="ct-auto-signal">
            <span>SINAL ATUAL</span>
            <b>{activeSignal?.label??'ANALISANDO MERCADO'}</b>
            <small>{stagePt?`${stagePt} · SCORE ${Number(activeSignal?.score??0)}`:'AGUARDANDO CONFIRMAÇÃO'}</small>
          </div>
          <div className="ct-auto-last">{chartAutomation?.last_action??'SEM AÇÃO AUTOMÁTICA'}</div>
          <em>SIMULAÇÃO LOCAL · SEM ENVIO À CORRETORA</em>
        </div>
      </div>

      <div className="ct-side-section ct-protection-last smart-protection-panel">
        <div className="ct-side-section-title">PROTEÇÃO DA POSIÇÃO</div>
        <div className="ct-management-mode">
          <button className={trailingMode==='AUTOMATIC'?'active':''} onClick={()=>{setTrailingMode('AUTOMATIC');configureTrailing({mode:'AUTOMATIC',enabled:trailingEnabled,unit:trailingUnit,start:trailingStart,distance:trailingDistance,step:trailingStep,breakEvenEnabled:true,breakEvenBuffer:trailingBuffer,mfeLockPct:.40})}}>AUTOMÁTICO</button>
          <button className={trailingMode==='FREE'?'active':''} onClick={()=>{setTrailingMode('FREE');configureTrailing({mode:'FREE',enabled:trailingEnabled,unit:trailingUnit,start:trailingStart,distance:trailingDistance,step:trailingStep,breakEvenEnabled:true,breakEvenBuffer:trailingBuffer,mfeLockPct:.40})}}>LIVRE</button>
        </div>

        <div className="smart-protection-status">
          <div><span>ESTÁGIO</span><strong>{String(chartTrade?.protection_stage??'FLAT').replaceAll('_',' ')}</strong></div>
          <div><span>MFE</span><strong>{Number(chartTrade?.mfe_points??0).toFixed(0)} pts</strong></div>
          <div><span>PROTEGIDO</span><strong>{Number(chartTrade?.protected_points??0).toFixed(0)} pts</strong></div>
          <div><span>STOP ATUAL</span><strong>{chartTrade?.stop_price?.toFixed?.(0)??'—'}</strong></div>
        </div>

        {trailingMode==='AUTOMATIC'?
          <div className="ct-smart-auto">
            <div className="ct-auto-state"><span>SMART TRAILING</span><strong className={chartTrade?.trailing_enabled?'on':'off'}>{chartTrade?.trailing_enabled?'ATIVO':'DESLIGADO'}</strong></div>
            <p>ATLAS gerencia break-even, proteção de MFE e trailing por estrutura/ATR conforme o setup da operação.</p>
            <div className="ct-protection-reason"><span>ÚLTIMA DECISÃO</span><b>{chartTrade?.last_protection_reason??'AGUARDANDO POSIÇÃO'}</b></div>
            <div className="ct-smart-actions">
              <button className={trailingEnabled?'active':''} onClick={()=>{const enabled=!trailingEnabled;setTrailingEnabled(enabled);configureTrailing({mode:'AUTOMATIC',enabled,unit:trailingUnit,start:trailingStart,distance:trailingDistance,step:trailingStep,breakEvenEnabled:true,breakEvenBuffer:trailingBuffer,mfeLockPct:.40})}}>{trailingEnabled?'SMART ON':'SMART OFF'}</button>
            </div>
          </div>
          :<div className="ct-free-trailing">
            <div className="ct-unit-toggle"><button className={trailingUnit==='POINTS'?'active':''} onClick={()=>setTrailingUnit('POINTS')}>PTS</button><button className={trailingUnit==='MONEY'?'active':''} onClick={()=>setTrailingUnit('MONEY')}>R$</button></div>
            <div className="ct-trailing-inputs">
              <label>START<input type="number" min="0" step="5" value={trailingStart} onChange={e=>setTrailingStart(Math.max(0,Number(e.target.value)||0))}/></label>
              <label>DISTÂNCIA<input type="number" min="1" step="5" value={trailingDistance} onChange={e=>setTrailingDistance(Math.max(1,Number(e.target.value)||1))}/></label>
              <label>PASSO<input type="number" min="1" step="5" value={trailingStep} onChange={e=>setTrailingStep(Math.max(1,Number(e.target.value)||1))}/></label>
              <label>BUFFER BE<input type="number" min="0" step="5" value={trailingBuffer} onChange={e=>setTrailingBuffer(Math.max(0,Number(e.target.value)||0))}/></label>
            </div>
            <button className="ct-apply-trailing" onClick={()=>configureTrailing({mode:'FREE',enabled:true,unit:trailingUnit,start:trailingStart,distance:trailingDistance,step:trailingStep,breakEvenEnabled:true,breakEvenBuffer:trailingBuffer,mfeLockPct:.40})}>APLICAR TRAILING LIVRE</button>
            <small>START = avanço mínimo desde a entrada. DISTÂNCIA = espaço do stop para o preço atual. PASSO = movimento mínimo antes de reposicionar o stop.</small>
          </div>
        }

        <div className="ct-oco-config">
          <span>STOP / ALVO BASE</span>
          <div>
            <label>STOP<input type="number" min="5" step="5" value={fixedStopPts} onChange={e=>setFixedStopPts(Math.max(5,Number(e.target.value)||5))}/></label>
            <label>ALVO<input type="number" min="5" step="5" value={fixedTargetPts} onChange={e=>setFixedTargetPts(Math.max(5,Number(e.target.value)||5))}/></label>
          </div>
          <button onClick={()=>configureProtection('AUTO_FIXED',fixedStopPts,fixedTargetPts)}>ARMAR OCO BASE</button>
        </div>
      </div>

      <div className="ct-side-section ct-performance-report">
        <div className="ct-side-section-title">DIÁRIO DE OPERAÇÕES</div>
        <div className="ct-performance-symbol"><span>ATIVO</span><strong>{feed?.symbol??'—'}</strong><em>{performanceDay.day||'—'}</em></div>
        <div className="ct-performance-rows">
          <div className="head"><span>LADO</span><span>QTD</span><span>RESULTADO PTS</span><span>RESULTADO R$</span></div>
          {performanceDay.rows.length===0&&<div className="empty">SEM OPERAÇÕES ENCERRADAS NO DIA</div>}
          {performanceDay.rows.map((x:any)=><div className="row" key={x.trade_uid??x.id}>
            <span className={x.side==='LONG'?'buy-text':'sell-text'}>{x.side==='LONG'?'COMPRA':'VENDA'}</span>
            <span>{x.quantity??1}</span>
            <span className={Number(x.pnl_points??0)>=0?'positive':'negative'}>{Number(x.pnl_points??0).toFixed(0)}</span>
            <span className={Number(x.pnl_money??0)>=0?'positive':'negative'}>R$ {Number(x.pnl_money??0).toFixed(2)}</span>
          </div>)}
        </div>
        <div className="ct-performance-totals">
          <div><span>TOTAL DO DIA</span><strong className={performanceDay.totalMoney>=0?'positive':'negative'}>{performanceDay.totalPoints>=0?'+':''}{performanceDay.totalPoints.toFixed(0)} pts · {performanceDay.totalMoney>=0?'+':''}R$ {performanceDay.totalMoney.toFixed(2)}</strong></div>
          <div><span>ASSERTIVIDADE AUTO</span><strong>{Math.max(0,Math.min(100,Number(performanceDay.automationAccuracy??0))).toFixed(1)}%</strong><small>{performanceDay.automatedWins} acertos / {performanceDay.automatedTrades} automáticas</small></div>
        </div>
        <div className="ct-capital-chart">
          <div><span>CURVA DE CAPITAL</span><strong>{performanceDay.totalMoney>=0?'+':''}R$ {performanceDay.totalMoney.toFixed(2)}</strong></div>
          <svg viewBox="0 0 100 46" preserveAspectRatio="none" aria-label="Curva de capital"><line x1="0" y1="44" x2="100" y2="44"/><path d={capitalPath||'M 0 44 L 100 44'}/></svg>
        </div>
      </div>
    </aside>
  </section>
}
