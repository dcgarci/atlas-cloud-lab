import {useEffect,useState} from 'react'
import {api} from '../api/client'
import {EmptyState} from '../components/EmptyState'
import {
  pt,
  REGIME_LABELS,
  STATE_LABELS,
  TRADE_TYPE_LABELS,
} from '../i18n'

export function ReplayAuditScreen(){
  const [status,setStatus]=useState<any>(null)
  const [summary,setSummary]=useState<any>(null)
  const [decisions,setDecisions]=useState<any[]>([])
  const [validation,setValidation]=useState<any>(null)
  const [parityDetail,setParityDetail]=useState<any>(null)
  const [message,setMessage]=useState('')
  const [busy,setBusy]=useState(false)
  const [vaultSessions,setVaultSessions]=useState<any[]>([])
  const [vaultSessionId,setVaultSessionId]=useState('')

  async function refresh(){
    try{
      const [s,a,d,v,p,vs]=await Promise.allSettled([
        api<any>('/api/feed/replay/status'),
        api<any>('/api/audit/summary'),
        api<any[]>('/api/audit/decisions?limit=80'),
        api<any>('/api/validation/latest'),
        api<any>('/api/feed/replay/parity/detail'),
        api<any[]>('/api/feed/vault/sessions?limit=200'),
      ])

      if(s.status==='fulfilled') setStatus(s.value)
      if(a.status==='fulfilled') setSummary(a.value)
      if(d.status==='fulfilled') setDecisions(d.value)
      if(v.status==='fulfilled') setValidation(v.value)
      if(p.status==='fulfilled') setParityDetail(p.value)
      if(vs.status==='fulfilled'){setVaultSessions(vs.value);if(!vaultSessionId&&vs.value.length)setVaultSessionId(vs.value[0].session_id)}

      const critical=[s,a,d].find(x=>x.status==='rejected')
      if(critical&&critical.status==='rejected'){
        throw critical.reason
      }

      setMessage('')
    }catch(e){
      setMessage(
        e instanceof Error
          ? e.message
          : String(e)
      )
    }
  }

  useEffect(()=>{
    refresh()
    const id=window.setInterval(refresh,800)
    return()=>window.clearInterval(id)
  },[])

  async function action(path:string){
    setBusy(true)
    try{
      await api(path,{method:'POST'})
      await refresh()
    }catch(e){
      setMessage(
        e instanceof Error
          ? e.message
          : String(e)
      )
    }finally{
      setBusy(false)
    }
  }


  async function startVaultReplay(){
    if(!vaultSessionId)return
    setBusy(true);setMessage('')
    try{
      const chosen=vaultSessions.find(x=>x.session_id===vaultSessionId)
      await api('/api/feed/vault/replay/start',{method:'POST',body:JSON.stringify({session_ids:[vaultSessionId],timeframe:chosen?.timeframe??'5m',speed:1,start_paused:true,reset_paper:true})})
      setMessage(`Banco ATLAS carregado: ${chosen?.market_date??vaultSessionId} · ${chosen?.replay_mode??'REPLAY'}.`)
      await refresh()
    }catch(e){setMessage(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }

  async function validateSignals(){
    setBusy(true)
    setMessage('')

    try{
      const result=await api<any>(
        '/api/validation/run',
        {
          method:'POST',
          body:JSON.stringify({
            entry_mode:'NEXT_OPEN',
            ambiguity_policy:'STOP_FIRST',
            horizon_bars:24,
            trend_target_r:2.0,
            stop_atr_fallback:1.0,
            entry_slippage_points:0,
            exit_slippage_points:0,
            contracts:1,
            point_value:0.20,
            fees_per_contract_per_side:0,
            train_pct:0.60,
            validation_pct:0.20,
            include_watch:false,
            min_setup_score:0,
          }),
        }
      )

      setValidation({
        id:result.run_id,
        status:'COMPLETED',
        metrics:result.report,
      })

      setMessage(
        `Validação forward concluída: ${result.report.signal_count} sinal(is). `+
        'Execução NEXT OPEN e política conservadora STOP FIRST. '+
        'Zero sinais no replay demo não é erro: o arquivo também serve para validar integridade e determinismo do pipeline.'
      )
    }catch(e){
      setMessage(
        e instanceof Error
          ? e.message
          : String(e)
      )
    }finally{
      setBusy(false)
    }
  }

  const parity=status?.parity??{}
  const overall=validation?.metrics?.overall??{}

  return <section className="content-screen">
    <div className="screen-title">
      <span>CANDLE A CANDLE / AUDITORIA / PARIDADE</span>
      <h2>AUDITORIA DE REPLAY</h2>
    </div>

    <div className="audit-vault-picker">
      <label>BANCO ATLAS
        <select value={vaultSessionId} onChange={e=>setVaultSessionId(e.target.value)}>
          <option value="">SELECIONE UM PREGÃO</option>
          {vaultSessions.map((x:any)=><option key={x.session_id} value={x.session_id}>{x.market_date} · {x.symbol} · {x.timeframe??'5m'} · {x.replay_mode??'TICK'} · {x.candle_count} candles</option>)}
        </select>
      </label>
      <button className="ort-btn primary" disabled={busy||!vaultSessionId} onClick={startVaultReplay}>CARREGAR REPLAY DO BANCO ATLAS</button>
      <span>Replay interno roda sem Profit/Excel. CANDLE = intrabar estimado/STOP FIRST; TICK = caminho exato.</span>
    </div>

    <div className="ort-toolbar">
      <button
        className="ort-btn primary"
        disabled={busy}
        onClick={()=>action('/api/demo/start?speed=20&start_paused=true')}
      >
        INICIAR PAUSADO
      </button>

      <button
        className="ort-btn secondary"
        disabled={busy||!status?.active}
        onClick={()=>action('/api/feed/replay/step?count=1')}
      >
        STEP +1
      </button>

      <button
        className="ort-btn secondary"
        disabled={busy||!status?.active}
        onClick={()=>action('/api/feed/replay/step?count=5')}
      >
        STEP +5
      </button>

      <button
        className="ort-btn secondary"
        disabled={busy||!status?.active}
        onClick={()=>action('/api/feed/replay/resume')}
      >
        CONTINUAR
      </button>

      <button
        className="ort-btn secondary"
        disabled={busy||!status?.active}
        onClick={()=>action('/api/feed/replay/pause')}
      >
        PAUSAR
      </button>

      <button
        className="ort-btn danger"
        disabled={busy||!status?.active}
        onClick={()=>action('/api/feed/stop')}
      >
        PARAR
      </button>

      <button
        className="ort-btn ghost"
        disabled={busy}
        onClick={()=>action('/api/audit/clear')}
      >
        LIMPAR AUDITORIA
      </button>

      <button
        className="ort-btn primary"
        disabled={busy||(summary?.candles??0)===0}
        onClick={validateSignals}
      >
        VALIDAR SINAIS
      </button>
    </div>

    {message&&
      <div className="status-banner">
        <strong>STATUS</strong>
        <span>{message}</span>
      </div>
    }

    <div className="metric-grid audit-metrics">
      {[
        ['REPLAY',status?.active?'ATIVO':'PARADO'],
        ['PAUSADO',status?.paused?'SIM':'NÃO'],
        ['CANDLE',`${Math.max(0,(status?.current_index??-1)+1)}/${status?.total??0}`],
        ['PROGRESSO',`${((status?.progress_pct??0)*100).toFixed(1)}%`],
        ['AUDITADOS',summary?.candles??0],
        ['ARMADOS',summary?.armed??0],
        ['CONFIRMADOS',summary?.setup_confirmed??0],
        ['ENTRADAS',summary?.entries??0],
        ['SAÍDAS',summary?.exits??0],
      ].map(([a,b])=>
        <div className="metric" key={String(a)}>
          <span>{a}</span>
          <strong>{String(b)}</strong>
        </div>
      )}
    </div>

    <div className="replay-integrity-grid">
      <section className="test-card">
        <h3>PARIDADE DO PIPELINE</h3>
        <div className="context-read">
          <span>STATUS</span>
          <strong>{parity.status??'SEM EXECUÇÃO'}</strong>
        </div>
        <div className="context-read">
          <span>CANDLES</span>
          <strong>{parity.candles??0}</strong>
        </div>
        <div className="context-read">
          <span>DETERMINÍSTICO</span>
          <strong>
            {parity.deterministic===true
              ? 'SIM'
              : parity.deterministic===false
              ? 'NÃO'
              : 'AGUARDANDO 2ª EXECUÇÃO'}
          </strong>
        </div>
        <div className="context-read">
          <span>DIVERGÊNCIA</span>
          <strong>{parity.mismatch_index??'—'}</strong>
        </div>
      </section>

      <section className="test-card">
        <h3>DIAGNÓSTICO DE PARIDADE</h3>
        <div className="context-read">
          <span>PRIMEIRA DIVERGÊNCIA</span>
          <strong>{parityDetail?.mismatch_index??'—'}</strong>
        </div>
        <div className="context-read">
          <span>CAMPO</span>
          <strong>{parityDetail?.differences?.[0]?.path??'—'}</strong>
        </div>
        <div className="context-read">
          <span>BASELINE</span>
          <strong>{parityDetail?.differences?.[0]?.baseline==null?'—':String(parityDetail.differences[0].baseline)}</strong>
        </div>
        <div className="context-read">
          <span>EXECUÇÃO ATUAL</span>
          <strong>{parityDetail?.differences?.[0]?.current==null?'—':String(parityDetail.differences[0].current)}</strong>
        </div>
      </section>

      <section className="test-card">
        <h3>VALIDAÇÃO FORWARD</h3>
        <div className="context-read">
          <span>SINAIS</span>
          <strong>{overall.signals??0}</strong>
        </div>
        <div className="context-read">
          <span>TAXA DE ACERTO</span>
          <strong>{Number(overall.win_rate??0).toFixed(1)}%</strong>
        </div>
        <div className="context-read">
          <span>EXPECTATIVA</span>
          <strong>{Number(overall.expectancy_points??0).toFixed(2)} pts</strong>
        </div>
        <div className="context-read">
          <span>FATOR DE LUCRO</span>
          <strong>{overall.profit_factor==null?'—':Number(overall.profit_factor).toFixed(2)}</strong>
        </div>
        <div className="context-read">
          <span>ALCANCE DA MÉDIA</span>
          <strong>{Number(overall.mean_reach_rate??0).toFixed(1)}%</strong>
        </div>
      </section>
    </div>

    <div className="audit-table">
      <div className="audit-head audit-head-v210">
        <span>HORA</span>
        <span>PREÇO</span>
        <span>REGIME</span>
        <span>MELHOR SETUP</span>
        <span>SCORE</span>
        <span>ESTADO</span>
        <span>V1.3 SHADOW</span>
        <span>GATE</span>
      </div>

      {decisions.map((row:any)=>{
        const payload=row.payload??{}
        const candidates=payload.signal?.candidates??{}
        const ranked=Object.entries(candidates)
          .sort((a:any,b:any)=>(b[1]?.setup_score??0)-(a[1]?.setup_score??0))
        const best:any=ranked[0]
        const ref=payload.reference_v13
        const gate=payload.signal_gate

        return <div className="audit-row audit-row-v210" key={row.id}>
          <span>{String(row.ts).slice(11,19)}</span>
          <span>{Number(row.price).toFixed(0)}</span>
          <span>{pt(payload.context?.day_regime,REGIME_LABELS)}</span>
          <span>{best?.[0]?pt(best[0],TRADE_TYPE_LABELS):'—'}</span>
          <span>{best?.[1]?.setup_score??0}</span>
          <span>{pt(payload.trade?.state,STATE_LABELS)}</span>
          <span>{ref?.state?pt(ref.state,STATE_LABELS):'—'}</span>
          <span>{gate?.allow_new_signals?'ABERTO':'BLOQUEADO'}</span>
        </div>
      })}

      {decisions.length===0&&
        <EmptyState
          eyebrow="REPLAY PRONTO"
          title="NENHUM CANDLE AUDITADO"
          description="Inicie pausado e use STEP +1. A V2.10 registra motor unificado, hard gate, referência V1.3 e fingerprint de paridade no mesmo candle."
          compact
        />
      }
    </div>
  </section>
}
