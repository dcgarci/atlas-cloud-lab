import {useEffect,useMemo,useState} from 'react'
import {useVaultStore} from '../store/vaultStore'
import {useAppStore} from '../store/appStore'

function fmt(v:number|null|undefined){
  return v==null?'—':Number(v).toLocaleString('pt-BR',{maximumFractionDigits:0})
}

export function HistoricalScreen(){
  const setScreen=useAppStore(s=>s.setScreen)
  const sessions=useVaultStore(s=>s.sessions)
  const summary=useVaultStore(s=>s.summary)
  const loading=useVaultStore(s=>s.loading)
  const error=useVaultStore(s=>s.error)
  const refresh=useVaultStore(s=>s.refresh)
  const importReplayFiles=useVaultStore(s=>s.importReplayFiles)

  const [symbol,setSymbol]=useState('WINV26')
  const [startDate,setStartDate]=useState('2026-08-01')
  const [endDate,setEndDate]=useState('2026-08-31')
  const [importFiles,setImportFiles]=useState<File[]>([])
  const [importStatus,setImportStatus]=useState('')

  useEffect(()=>{refresh(symbol,startDate,endDate)},[])


  const augustDays=useMemo(()=>{
    const out:{date:string,day:number,available:boolean}[]=[]
    for(let day=1;day<=31;day++){
      const date=`2026-08-${String(day).padStart(2,'0')}`
      const d=new Date(`${date}T12:00:00`)
      if(d.getDay()===0||d.getDay()===6)continue
      out.push({date,day,available:sessions.some(x=>x.market_date===date&&x.symbol===symbol)})
    }
    return out
  },[sessions,symbol])

  const importRealReplay=async()=>{
    if(!importFiles.length)return
    setImportStatus('IMPORTANDO E VALIDANDO BASE HISTÓRICA...')
    try{
      const result=await importReplayFiles(importFiles,symbol,'5m')
      const ticks=result.reduce((acc:number,x:any)=>acc+Number(x?.ticks_imported??0),0)
      const candles=result.reduce((acc:number,x:any)=>acc+Number(x?.candles_imported??x?.candles_built??0),0)
      const modes=[...new Set(result.map((x:any)=>x?.replay_mode).filter(Boolean))]
      const dates=[...new Set(result.flatMap((x:any)=>Array.isArray(x?.dates)?x.dates:[]))]
      setImportStatus(`${ticks.toLocaleString('pt-BR')} ticks · ${candles.toLocaleString('pt-BR')} candles · ${modes.join('/')} · ${dates.length} pregão(ões): ${dates.join(', ')}`)
      setImportFiles([])
      await refresh(symbol,startDate,endDate)
    }catch(err:any){
      setImportStatus(`ERRO: ${err?.message??'falha na importação'}`)
    }
  }



  return <section className="vault-screen">
    <div className="vault-hero">
      <div>
        <span>MEMÓRIA DE MERCADO ATLAS</span>
        <h2>BASE ESTRUTURAL 5 PREGÕES</h2>
        <p>Base histórica destinada ao contexto dos cinco pregões anteriores: máximas, mínimas, topos, fundos, ranges e regiões estruturais. O REPLAY está preservado, porém inativo nesta fase.</p>
      </div>
      <div className="vault-live-note"><i/>CONTEXTO 5P · REPLAY INATIVO</div>
    </div>

    <div className="vault-summary">
      <div><span>PREGÕES SALVOS</span><strong>{summary?.sessions??0}</strong></div>
      <div><span>TICKS GRAVADOS</span><strong>{Number(summary?.ticks??0).toLocaleString('pt-BR')}</strong></div>
      <div><span>CANDLES</span><strong>{Number(summary?.candles??0).toLocaleString('pt-BR')}</strong></div>
      <div><span>PERÍODO</span><strong>{summary?.first_date??'—'} → {summary?.last_date??'—'}</strong></div>
    </div>

    <div className="vault-grid">
      <div className="vault-card vault-sessions-card">
        <div className="vault-card-head">
          <div><span>BASE DE DADOS</span><strong>PREGÕES DISPONÍVEIS</strong></div>
          <button onClick={()=>refresh(symbol,startDate,endDate)}>{loading?'ATUALIZANDO...':'ATUALIZAR'}</button>
        </div>

        <div className="vault-filters">
          <label>ATIVO<input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())}/></label>
          <label>DE<input type="date" value={startDate} onChange={e=>setStartDate(e.target.value)}/></label>
          <label>ATÉ<input type="date" value={endDate} onChange={e=>setEndDate(e.target.value)}/></label>
          <button onClick={()=>refresh(symbol,startDate,endDate)}>FILTRAR</button>
        </div>

        <div className="vault-import">
          <header><div><span>BASE HISTÓRICA 5P</span><strong>IMPORTAR DADOS HISTÓRICOS · TICK OU CANDLE OHLCV</strong></div><b>AGOSTO/2026</b></header>
          <input type="file" accept=".csv,text/csv" multiple onChange={e=>{setImportFiles(Array.from(e.target.files??[]));setImportStatus('')}}/>
          <div className="vault-import-actions"><button disabled={!importFiles.length||loading} onClick={importRealReplay}>IMPORTAR {importFiles.length?`${importFiles.length} ARQUIVO(S)`:''}</button><span>Aceita Tick ou Profit OHLCV: Ativo + Data + Hora + Abertura + Máximo + Mínimo + Fechamento + Volume + Quantidade.</span></div>
          {importStatus&&<div className="vault-import-result">{importStatus}</div>}
          <div className="vault-import-note">V2.12.21 mantém a importação validada de Tick/OHLCV para formar o contexto dos 5 pregões. O motor de Replay permanece no código, mas não participa do fluxo operacional atual.</div>
          <div className="vault-august-bank"><strong>MAPA DE PREGÕES · AGOSTO/2026</strong><div className="vault-august-days">{augustDays.map(item=><button key={item.date} className={`vault-august-day ${item.available?'available':'missing'}`} onClick={()=>{setStartDate(item.date);setEndDate(item.date);refresh(symbol,item.date,item.date)}} title={item.available?'Pregão disponível na base estrutural':'Sem dados cadastrados'}>{String(item.day).padStart(2,'0')}<small>{item.available?'OK':'—'}</small></button>)}</div></div>
        </div>

                <div className="vault-session-list">
          {sessions.length===0&&<div className="vault-empty">Nenhum pregão gravado neste período. Importe um CSV Tick/OHLCV do Profit ou capture pelo Profit/Excel.</div>}
          {sessions.map(s=><div className="vault-session-row" key={s.session_id}>
            <strong>{s.market_date}</strong>
            <span>{s.symbol}</span>
            <span>{s.candle_count} candles</span>
            <span>BASE 5P · {s.timeframe??'5m'}</span>
            <span>{fmt(s.low)} ↔ {fmt(s.high)}</span>
          </div>)}
        </div>
      </div>

      <div className="vault-card vault-replay-card">
        <div className="vault-card-head"><div><span>MÓDULO PRESERVADO</span><strong>REPLAY · INATIVO</strong></div></div>
        <div className="vault-info">
          <strong>FASE FUTURA</strong>
          <p>O motor de Replay, a leitura de Roteamento_REPLAY.xlsm e a auditoria permanecem no projeto. Nesta versão não iniciam, não interferem no LIVE e não participam da decisão ORT.</p>
        </div>
        <button className="vault-open-cockpit" onClick={()=>setScreen('live')}>ABRIR COCKPIT LIVE</button>
      </div>
    </div>
  </section>
}
