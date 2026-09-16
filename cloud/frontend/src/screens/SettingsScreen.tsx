import {useEffect,useState} from 'react'
import {useAppStore} from '../store/appStore'
import {runtime} from '../config/runtime'
import {api} from '../api/client'
import {
  APP_VERSION,
  APP_LONG_NAME,
} from '../config/app'

type ProfitConfig={
  workbook:string
  sheet:string
  symbol:string
  timeframe:string
  poll_ms:number
  timezone:string
  volume_mode:string
  cells:{
    timestamp:string
    date:string
    time:string
    price:string
    volume:string
    bid:string
    ask:string
  }
}

type FeedHealth={
  state?:string
  source?:string
  transport_state?:string
  reads_ok?:number
  read_errors?:number
  reconnects?:number
  consecutive_read_errors?:number
  connection_timeouts?:number
  watchdog_timeouts?:number
  worker_errors?:number
  source_heartbeat_age_seconds?:number|null
  market_mode?:string
  last_error?:string|null
}

const LIVE_WORKBOOK='C:\\ATLAS DADOS\\TEMPO REAL\\Roteamento.xlsm'
const REPLAY_WORKBOOK_FUTURE='C:\\ATLAS DADOS\\TEMPO REAL\\Roteamento_REPLAY.xlsm' // preservado; REPLAY inativo

const defaults:ProfitConfig={
  workbook:LIVE_WORKBOOK,
  sheet:'Roteamento',
  symbol:'WINV26',
  timeframe:'5m',
  poll_ms:250,
  timezone:'America/Sao_Paulo',
  volume_mode:'CUMULATIVE',
  cells:{
    timestamp:'',
    date:'B2',
    time:'C2',
    price:'D2',
    volume:'P2',
    bid:'Q2',
    ask:'R2',
  }
}

export function SettingsScreen(){
  const user=useAppStore(s=>s.user)
  const logout=useAppStore(s=>s.logout)

  const [profit,setProfit]=useState<ProfitConfig>(()=>{
    try{
      const raw=localStorage.getItem(
        'ort_profit_excel_config_v3'
      )
      if(!raw)return defaults
      const saved=JSON.parse(raw)
      return {...defaults,...saved,cells:{...defaults.cells,...(saved?.cells??{})}}
    }catch{
      return defaults
    }
  })

  const [status,setStatus]=useState('')
  const [busy,setBusy]=useState(false)
  const [feedHealth,setFeedHealth]=useState<FeedHealth|null>(null)

  useEffect(()=>{
    let disposed=false
    const refresh=async()=>{
      try{
        const health=await api<FeedHealth>('/api/feed/status')
        if(!disposed)setFeedHealth(health)
      }catch{}
    }
    refresh()
    const id=window.setInterval(refresh,1000)
    return()=>{disposed=true;window.clearInterval(id)}
  },[])

  useEffect(()=>{
    localStorage.setItem(
      'ort_profit_excel_config_v3',
      JSON.stringify(profit)
    )
  },[profit])



  function field(
    key:keyof ProfitConfig,
    value:any,
  ){
    setProfit(prev=>({
      ...prev,
      [key]:value,
    }))
  }

  function cell(
    key:keyof ProfitConfig['cells'],
    value:string,
  ){
    setProfit(prev=>({
      ...prev,
      cells:{
        ...prev.cells,
        [key]:value,
      },
    }))
  }

  async function autoMapProfit(){
    if(!profit.workbook||!profit.sheet){
      setStatus('INFORME A PLANILHA E A ABA ANTES DO AUTO MAPEAMENTO')
      return
    }
    setBusy(true)
    setStatus('LOCALIZANDO CAMPOS PELOS CABEÃ‡ALHOS...')
    try{
      const found=await api<{header_row:number;cells:Record<string,string>}>(
        '/api/feed/profit-excel/discover',
        {method:'POST',body:JSON.stringify({workbook:profit.workbook,sheet:profit.sheet})}
      )
      const c=found.cells??{}
      setProfit(prev=>({
        ...prev,
        cells:{
          ...prev.cells,
          // Data + Hora do RTD tÃªm prioridade sobre Timestamp fabricado.
          timestamp:c.date&&c.time?'':(c.timestamp??prev.cells.timestamp),
          date:c.date??prev.cells.date,
          time:c.time??prev.cells.time,
          price:c.price??prev.cells.price,
          volume:c.volume??prev.cells.volume,
          bid:c.bid??prev.cells.bid,
          ask:c.ask??prev.cells.ask,
        }
      }))
      setStatus(`AUTO MAPEAMENTO CONCLUÃDO Â· CABEÃ‡ALHO LINHA ${found.header_row}`)
    }catch(e){
      setStatus(e instanceof Error?e.message:String(e))
    }finally{
      setBusy(false)
    }
  }

  async function connectProfit(){
    setBusy(true)
    setStatus('CONECTANDO...')

    try{
      const started=await api<{
        status?:string
        source?:string
        symbol?:string
        timeframe?:string
        market_mode?:string
        workbook?:string
        rtd_topic?:string
      }>(
        '/api/feed/start/profit-excel',
        {
          method:'POST',
          body:JSON.stringify(profit),
        }
      )

      if(started?.workbook){
        setProfit(prev=>({
          ...prev,
          workbook:String(started.workbook),
        }))
      }else{
        const mode=String(started?.market_mode??'').toUpperCase()
        if(mode==='LIVE'){
          setProfit(prev=>({...prev,workbook:LIVE_WORKBOOK}))
        }
      }

      const mode=String(started?.market_mode??'').toUpperCase()
      const topic=String(started?.rtd_topic??'').trim()
      const modeText=mode?` · MODO ${mode}`:''
      const topicText=topic?` · RTD ${topic}`:''

      setStatus(
        `CONEXÃO INICIADA${modeText}${topicText} — O ATLAS RECONECTA AUTOMATICAMENTE SE O EXCEL OSCILAR`
      )
    }catch(e){
      setStatus(
        e instanceof Error
          ? e.message
          : String(e)
      )
    }finally{
      setBusy(false)
    }
  }

  async function stopProfit(){
    setBusy(true)
    try{
      await api(
        '/api/feed/stop',
        {method:'POST'}
      )
      setStatus('FEED PARADO')
    }finally{
      setBusy(false)
    }
  }

  return <section className="content-screen">
    <div className="screen-title">
      <span>SISTEMA / DADOS / PROFIT</span>
      <h2>CONFIGURAÃ‡Ã•ES</h2>
    </div>

    <div className="settings-grid settings-grid-v211">
      <div className="settings-card">
        <span>OPERADOR</span>
        <strong>{user?.name}</strong>
        <small>{user?.email}</small>

        <div className="language-box">
          <span>IDIOMA DA INTERFACE</span>
          <strong>PORTUGUÃŠS (BRASIL)</strong>
          <small>Motor/API permanecem em inglÃªs tÃ©cnico internamente.</small>
        </div>

        <button className="danger" onClick={logout}>SAIR DA CONTA</button>
      </div>

      <div className="settings-card system-info-card">
        <span>PRODUTO</span>
        <strong>{APP_LONG_NAME}</strong>
        <small>Console operacional de reversÃ£o e tendÃªncia.</small>

        <div className="settings-read">
          <span>VERSÃƒO DA INTERFACE</span>
          <b>V{APP_VERSION}</b>
        </div>

        <div className="settings-read">
          <span>API LOCAL</span>
          <b>{runtime.apiBase}</b>
        </div>

        <div className="settings-read">
          <span>WEBSOCKET</span>
          <b>{runtime.wsBase}</b>
        </div>

        <div className="settings-read">
          <span>PRINCÃPIO</span>
          <b>IA INTERPRETA / MOTOR CALCULA</b>
        </div>
      </div>

      <div className="settings-card profit-excel-card">
        <span>FONTE DE DADOS</span>
        <strong>
PROFIT / EXCEL AO VIVO · LIVE ONLY
        </strong>
        <small>
          A V2.12.21 usa somente o pregão LIVE atual. REPLAY e a alternância automática entre duas planilhas estão preservados, porém inativos nesta fase.
        </small>

        <label>
          CAMINHO DA PLANILHA
          <input
            value={profit.workbook}
            placeholder="C:\Trading\profit.xlsx"
            onChange={e=>field('workbook',e.target.value)}
          />
        </label>

        <div className="profit-grid">
          <label>
            ABA
            <input value={profit.sheet} onChange={e=>field('sheet',e.target.value)}/>
          </label>
          <label>
            ATIVO
            <input value={profit.symbol} onChange={e=>field('symbol',e.target.value)}/>
          </label>
          <label>
            TIMEFRAME
            <input value={profit.timeframe} onChange={e=>field('timeframe',e.target.value)}/>
          </label>
          <label>
            POLL MS
            <input type="number" value={profit.poll_ms} onChange={e=>field('poll_ms',Number(e.target.value))}/>
          </label>
          <label>
            DATA
            <input value={profit.cells.date} onChange={e=>cell('date',e.target.value)}/>
          </label>
          <label>
            HORA
            <input value={profit.cells.time} onChange={e=>cell('time',e.target.value)}/>
          </label>
          <label>
            TIMESTAMP (OPCIONAL)
            <input value={profit.cells.timestamp} placeholder="AUTO: DATA + HORA" onChange={e=>cell('timestamp',e.target.value)}/>
          </label>
          <label>
            PREÃ‡O
            <input value={profit.cells.price} onChange={e=>cell('price',e.target.value)}/>
          </label>
          <label>
            VOLUME
            <input value={profit.cells.volume} onChange={e=>cell('volume',e.target.value)}/>
          </label>
          <label>
            BID
            <input value={profit.cells.bid} onChange={e=>cell('bid',e.target.value)}/>
          </label>
          <label>
            ASK
            <input value={profit.cells.ask} onChange={e=>cell('ask',e.target.value)}/>
          </label>
          <label>
            VOLUME MODE
            <select value={profit.volume_mode} onChange={e=>field('volume_mode',e.target.value)}>
              <option value="CUMULATIVE">CUMULATIVE</option>
              <option value="DELTA">DELTA</option>
              <option value="NONE">NONE</option>
            </select>
          </label>
        </div>

        <div className="profit-actions">
          <button
            className="ort-btn"
            disabled={busy||!profit.workbook||!profit.sheet}
            onClick={autoMapProfit}
          >
            AUTO MAPEAR PLANILHA
          </button>
          <button
            className="ort-btn primary"
            disabled={busy||!profit.workbook}
            onClick={connectProfit}
          >
            CONECTAR PROFIT / EXCEL
          </button>
          <button
            className="ort-btn danger"
            disabled={busy}
            onClick={stopProfit}
          >
            PARAR FEED
          </button>
        </div>

        <div className={`profit-status transport-${(feedHealth?.transport_state??'idle').toLowerCase()}`}>
          <strong>{status||'AGUARDANDO CONFIGURAÃ‡ÃƒO'}</strong>
          {feedHealth?.source==='PROFIT_EXCEL'&&<div className="profit-health-grid">
            <span>TRANSPORTE <b>{feedHealth.transport_state??'â€”'}</b></span>
            <span>MERCADO <b>{String(feedHealth?.last_error??'').startsWith('RTD_NO_DATA:')?'SEM DADOS':(feedHealth.state??'â€”')}</b></span>
            <span>MODO <b>{feedHealth.market_mode??'â€”'}</b></span>
            <span>LEITURAS OK <b>{feedHealth.reads_ok??0}</b></span>
            <span>ERROS TRANSITÃ“RIOS <b>{feedHealth.read_errors??0}</b></span>
            <span>RECONECTOU <b>{feedHealth.reconnects??0}x</b></span>
            <span>TIMEOUT COM <b>{feedHealth.connection_timeouts??0}</b></span>
            <span>WATCHDOG <b>{feedHealth.watchdog_timeouts??0}</b></span>
          </div>}
          {feedHealth?.source==='PROFIT_EXCEL'&&String(feedHealth?.last_error??'').startsWith('RTD_NO_DATA:')&&
            <small>Excel/COM conectado, mas o RTD ainda não publicou dados. Isso pode ocorrer fora da sessão ou durante a inicialização do Profit. O ATLAS continuará aguardando sem reiniciar o Excel.</small>}
          {feedHealth?.source==='PROFIT_EXCEL'&&feedHealth?.transport_state==='RECONNECTING'&&
            <small>Excel ocupado ou referÃªncia COM perdida. O ATLAS estÃ¡ tentando recuperar sozinho sem bloquear a plataforma.</small>}
          {feedHealth?.source==='PROFIT_EXCEL'&&feedHealth?.transport_state==='ERROR'&&
            <small>O Excel/COM nÃ£o respondeu no tempo esperado. A plataforma continua ativa; vocÃª pode PARAR FEED e tentar novamente.</small>}
          {feedHealth?.last_error&&<small>{feedHealth.last_error}</small>}
        </div>
      </div>
    </div>
  </section>
}
