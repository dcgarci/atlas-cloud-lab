import {useEffect,useMemo,useState} from 'react'
import {api} from '../api/client'

const COMMANDS=[
  ['BUY_MARKET','COMPRAR'],['SELL_MARKET','VENDER'],['CLOSE_POSITION','ZERAR'],
  ['CANCEL_ORDERS','CANCELAR ORDENS'],['CANCEL_STOP_TARGET','CANCELAR STOP / ALVO'],['REVERSE_POSITION','INVERTER'],
] as const

function modeLabel(mode?:string){
  if(mode==='SUPERVISED_SIM') return 'SIMULAÇÃO SUPERVISIONADA'
  return 'SIMULAÇÃO SEGURA'
}

function bridgeStateLabel(state?:string){
  if(state==='ARMED') return 'ARMADO'
  if(state==='FAULT') return 'FALHA'
  return 'DESARMADO'
}

function positionLabel(position?:string){
  if(position==='LONG') return 'COMPRADO'
  if(position==='SHORT') return 'VENDIDO'
  if(position==='FLAT') return 'ZERADO'
  if(position==='UNKNOWN') return 'DESCONHECIDO'
  return String(position??'—')
}

function confirmationLabel(status?:string){
  if(status==='READY') return 'CONFIRMADA'
  if(status==='MISMATCH' || status==='DIVERGENT' || status==='BLOCKED') return 'DIVERGENTE'
  return 'AGUARDANDO'
}

function dataStatusClass(value?:string){
  if(value==='ATIVO') return 'ok'
  if(value==='ATRASADO') return 'warn'
  if(value==='SEM_RESPOSTA') return 'bad'
  return ''
}

export function ProfitBridgeScreen(){
  const [status,setStatus]=useState<any>(null)
  const [busy,setBusy]=useState(false)
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [symbol,setSymbol]=useState('WINV26')
  const [quantity,setQuantity]=useState(1)

  async function refresh(detect=false){
    try{
      const data=await api<any>(detect?'/api/profit-bridge/detect':'/api/profit-bridge/status',{method:detect?'POST':'GET'})
      setStatus(data);setError('')
    }catch(e:any){setError(e?.message??String(e))}
  }
  useEffect(()=>{refresh(true);const id=window.setInterval(()=>refresh(true),2500);return()=>window.clearInterval(id)},[])

  async function action(path:string,body?:any,successMessage='Comando concluído no laboratório do Copy Trader.'){
    setBusy(true);setError('');setMessage('')
    try{
      const data=await api<any>(path,{method:'POST',body:body?JSON.stringify(body):undefined})
      setStatus(data);setMessage(successMessage)
    }catch(e:any){setError(e?.message??String(e))}
    finally{setBusy(false)}
  }

  const state=String(status?.state??'DISARMED')
  const recon=status?.reconciliation??{}
  const risk=status?.risk??{}
  const dataHealth=status?.data_health??{}
  const history=useMemo(()=>[...(status?.command_history??[])].reverse(),[status])
  const confirmation=confirmationLabel(recon?.status)
  const dataAge=dataHealth?.age_seconds==null?'—':`${Number(dataHealth.age_seconds).toFixed(1)} s`

  return <section className="content-screen profit-bridge-cockpit">
    <div className="bridge-hero">
      <div><span>GATEWAY DE EXECUÇÃO / COPY TRADER</span><h2>COCKPIT COPY TRADER</h2><p>Workspace dedicado à conexão, segurança, confirmação e auditoria ATLAS ↔ Plataforma.</p></div>
      <div className={`bridge-state state-${state.toLowerCase()}`}><span>COPY TRADER</span><strong>{bridgeStateLabel(state)}</strong><small>{modeLabel(status?.mode)}</small></div>
    </div>

    <div className="bridge-status-strip">
      <div><span>SOFTWARE DA CORRETORA</span><strong className={status?.process_detected?'ok':'bad'}>{status?.process_detected?'DETECTADO':'NÃO DETECTADO'}</strong></div>
      <div><span>STATUS DO SOFTWARE</span><strong className={status?.software_online?'ok':'bad'}>{status?.software_online?'ONLINE':'OFFLINE'}</strong></div>
      <div><span>HEARTBEAT DO BRIDGE</span><strong className={status?.bridge_health==='CRITICO'?'bad':status?.bridge_health==='DEGRADADO'?'warn':''}>{status?.heartbeat_ms==null?'—':`${status.heartbeat_ms} ms · ${status?.bridge_health??'NORMAL'}`}</strong></div>
      <div><span>COMUNICAÇÃO</span><strong>{modeLabel(status?.mode)}</strong></div>
      <div><span>ENVIO DE ORDENS</span><strong className={status?.real_execution_enabled?'ok':'bad'}>{status?.real_execution_enabled?'HABILITADO':'DESABILITADO'}</strong></div>
      <div><span>CONFIRMAÇÃO DE ORDEM</span><strong className={confirmation==='CONFIRMADA'?'ok':confirmation==='DIVERGENTE'?'bad':''}>{confirmation}</strong></div>
    </div>

    {(error||message)&&<div className={`bridge-banner ${error?'error':'success'}`} role="status">{error||message}</div>}

    <div className="bridge-grid">
      <section className="bridge-card">
        <header><span>CONEXÃO</span><strong>PLATAFORMA</strong></header>
        {[
          ['PROCESSO',status?.process_detected?`PID ${status?.process_pid??'—'}`:'—'],
          ['JANELA',status?.window_detected?'VALIDADA':'—'],
          ['HANDLE',status?.window_handle??'—'],
          ['STATUS DOS DADOS',dataHealth?.status??'INATIVO'],
          ['IDADE DOS DADOS',dataAge],
          ['ÚLTIMO SCAN',status?.last_scan_at?String(status.last_scan_at).slice(11,19):'—'],
        ].map(([a,b])=><div className="bridge-row" key={a}><span>{a}</span><strong className={a==='STATUS DOS DADOS'?dataStatusClass(String(b)):''}>{String(b)}</strong></div>)}
        <div className="bridge-actions"><button onClick={()=>refresh(true)} disabled={busy}>DETECTAR SOFTWARE</button><button onClick={()=>action('/api/profit-bridge/disarm',undefined,'Copy Trader desarmado.')} disabled={busy}>DESARMAR</button></div>
      </section>

      <section className="bridge-card bridge-execution-card">
        <header><span>EXECUÇÃO</span><strong>ORDEM LAB</strong></header>
        <div className="bridge-order-inputs"><label>ATIVO<input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())}/></label><label>QTD<input type="number" min={1} max={risk?.max_contracts??1} value={quantity} onChange={e=>setQuantity(Math.max(1,Number(e.target.value)||1))}/></label></div>
        <div className="bridge-mode-toggle">
          {['DRY_RUN','SUPERVISED_SIM'].map(mode=><button key={mode} className={status?.mode===mode?'active':''} disabled={busy||status?.armed} onClick={()=>action('/api/profit-bridge/mode',{mode},`Modo alterado para ${modeLabel(mode)}.`)}>{modeLabel(mode)}</button>)}
        </div>
        <div className="bridge-command-grid">
          {COMMANDS.map(([command,label])=><button key={command} disabled={busy||!status?.armed} className={command==='BUY_MARKET'?'buy':command==='SELL_MARKET'?'sell':''} onClick={()=>action('/api/profit-bridge/command',{command,symbol,quantity})}>{label}</button>)}
        </div>
        <button className={`bridge-arm ${status?.armed?'armed':''}`} disabled={busy} onClick={()=>action(status?.armed?'/api/profit-bridge/disarm':'/api/profit-bridge/arm',undefined,status?.armed?'Copy Trader desarmado.':`Copy Trader armado em ${modeLabel(status?.mode)}.`)}>{status?.armed?'DESARMAR COPY TRADER':'ARMAR LAB'}</button>
      </section>

      <section className="bridge-card">
        <header><span>SEGURANÇA</span><strong>RISK GATE</strong></header>
        {[
          ['MÁX. CONTRATOS',risk?.max_contracts??1],['LOSS DIÁRIO',`R$ ${Number(risk?.daily_loss_money??0).toFixed(2)}`],['MÁX. TRADES',risk?.max_trades_day??5],['MÁX. SLIPPAGE',`${risk?.max_slippage_points??50} pts`],['ORDENS / SEG',risk?.routing_rate_per_second??1],
        ].map(([a,b])=><div className="bridge-row" key={a}><span>{a}</span><strong>{String(b)}</strong></div>)}
        <div className="bridge-kill">DESARMAR COPY TRADER BLOQUEIA NOVAS ORDENS</div>
      </section>

      <section className="bridge-card bridge-reconcile">
        <header><span>PARIDADE OPERACIONAL</span><strong>ATLAS × PLATAFORMA</strong></header>
        <div className="bridge-reconcile-grid"><div><span>ATLAS</span><strong>{positionLabel(recon?.atlas_position)}</strong></div><div><span>PLATAFORMA</span><strong>{positionLabel(recon?.profit_position)}</strong></div><div><span>ATIVO</span><strong>{recon?.symbol??symbol}</strong></div><div><span>QTD</span><strong>{recon?.quantity??0}</strong></div></div>
        <div className={`bridge-sync sync-${String(recon?.status??'NOT_READY').toLowerCase()}`}>{confirmation} · EXECUÇÃO REAL CONTINUA BLOQUEADA</div>
      </section>

      <section className="bridge-card bridge-protection">
        <header><span>PROTEÇÃO</span><strong>SMART PROTECTION</strong></header>
        <div className="bridge-protection-flow"><b>STOP INICIAL</b><i>→</i><b>BREAK-EVEN</b><i>→</i><b>PROFIT LOCK</b><i>→</i><b>SMART TRAILING</b></div>
        <p>Nesta fase o cockpit audita a arquitetura de proteção. O Copy Trader não modifica ordens reais.</p>
      </section>

      <section className="bridge-card bridge-log">
        <header className="bridge-log-header"><div><span>TELEMETRIA</span><strong>LOG DE EXECUÇÃO</strong></div><button disabled={busy||history.length===0} onClick={()=>action('/api/profit-bridge/clear-log',undefined,'Log visual limpo. O histórico técnico de auditoria foi preservado.')}>LIMPAR LOG</button></header>
        <div className="bridge-log-list">{history.length?history.map((row:any)=><div key={row.atlas_order_id}><time>{String(row.ts).slice(11,19)}</time><strong>{row.command}</strong><span>{row.symbol} × {row.quantity}</span><b>{row.atlas_order_id}</b></div>):<p>Nenhum comando registrado nesta sessão.</p>}</div>
      </section>
    </div>
  </section>
}
