import {useEffect,useState} from 'react'
import {api} from '../api/client'
import {runtime} from '../config/runtime'
import {EmptyState} from '../components/EmptyState'
import {useAppStore} from '../store/appStore'
import {
  pt,
  STATE_LABELS,
  FEED_SOURCE_LABELS,
  SYSTEM_STATUS_LABELS,
} from '../i18n'

type Status={
  health:any
  demo:any
}

export function SystemTestScreen(){
  const setScreen=useAppStore(s=>s.setScreen)
  const [status,setStatus]=useState<Status|null>(null)
  const [busy,setBusy]=useState(false)
  const [message,setMessage]=useState('')
  const [error,setError]=useState('')
  const [diagnostics,setDiagnostics]=useState<any>(null)
  const [profitBridge,setProfitBridge]=useState<any>(null)

  async function refresh(){
    try{
      const [health,demo,diag,bridge]=await Promise.all([
        api<any>('/health'),
        api<any>('/api/demo/status'),
        api<any>('/api/diagnostics/status'),
        api<any>('/api/profit-bridge/status'),
      ])

      setStatus({health,demo})
      setDiagnostics(diag)
      setProfitBridge(bridge)
      setError('')
    }catch(e){
      setError(
        e instanceof Error
          ? e.message
          : String(e)
      )
    }
  }

  useEffect(()=>{
    refresh()
    const id=window.setInterval(refresh,1500)
    return()=>window.clearInterval(id)
  },[])

  async function start(){
    setBusy(true)
    setMessage('')
    setError('')

    try{
      await api('/api/demo/start?speed=3',{
        method:'POST',
      })

      setMessage(
        'Replay demo iniciado. O ATLAS já pode ser acompanhado no Cockpit, Contexto, Decisão, Precisão e Ciclo.'
      )

      await refresh()
    }catch(e){
      setError(
        e instanceof Error
          ? e.message
          : String(e)
      )
    }finally{
      setBusy(false)
    }
  }

  async function stop(){
    setBusy(true)

    try{
      await api('/api/demo/stop',{
        method:'POST',
      })

      setMessage('Replay parado com segurança.')
      await refresh()
    }catch(e){
      setError(
        e instanceof Error
          ? e.message
          : String(e)
      )
    }finally{
      setBusy(false)
    }
  }


  async function setDiagnosticMode(mode:'OFF'|'NORMAL'|'LAB'){
    setBusy(true);setError('');setMessage('')
    try{
      const result=await api<any>('/api/diagnostics/mode',{method:'POST',body:JSON.stringify({mode})})
      setDiagnostics(result)
      setMessage(`Learning Mode alterado para ${mode}.`)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }

  async function exportDiagnostics(){
    setBusy(true);setError('');setMessage('')
    try{
      const result=await api<any>('/api/diagnostics/export',{method:'POST'})
      setMessage(`Diagnóstico gerado: ${result.filename}`)
      window.open(`${runtime.apiBase}${result.download_url}`,'_blank','noopener,noreferrer')
      await refresh()
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }

  async function bridgeAction(action:'detect'|'arm'|'disarm'){
    setBusy(true);setError('');setMessage('')
    try{
      const result=await api<any>(`/api/profit-bridge/${action}`,{method:'POST'})
      setProfitBridge(result)
      setMessage(`Copy Trader LAB: ${action.toUpperCase()} concluído.`)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }

  async function bridgeDryRun(command:'BUY_MARKET'|'SELL_MARKET'|'CLOSE_POSITION'){
    setBusy(true);setError('');setMessage('')
    try{
      const result=await api<any>('/api/profit-bridge/command',{
        method:'POST',
        body:JSON.stringify({command,symbol:'WINV26',quantity:1}),
      })
      setProfitBridge(result)
      setMessage(`DRY-RUN registrado: ${command} · ${result.atlas_order_id}. Nenhuma ordem real foi enviada.`)
    }catch(e){setError(e instanceof Error?e.message:String(e))}
    finally{setBusy(false)}
  }

  const feed=status?.demo?.feed
  const session=status?.demo?.session
  const demoReady=Boolean(status?.demo?.exists)
  const backendReady=status?.health?.status==='ok'

  const feedLabel=pt(feed?.state,STATE_LABELS)
  const sessionLabel=pt(session?.state,STATE_LABELS)
  const sourceLabel=pt(feed?.source,FEED_SOURCE_LABELS)
  const backendLabel=pt(status?.health?.status,SYSTEM_STATUS_LABELS)

  return <section className="content-screen">
    <div className="screen-title">
      <span>TESTE DE INTEGRIDADE / NAVEGADOR / FLUXO COMPLETO</span>
      <h2>TESTE DO SISTEMA</h2>
    </div>

    <div className="ort-toolbar">
      <button
        className="ort-btn primary"
        disabled={busy||!demoReady}
        onClick={start}
      >
        INICIAR REPLAY DEMO
      </button>

      <button
        className="ort-btn danger"
        disabled={busy||feed?.state==='STOPPED'}
        onClick={stop}
      >
        PARAR REPLAY
      </button>

      <button
        className="ort-btn secondary"
        disabled={busy}
        onClick={refresh}
      >
        ATUALIZAR STATUS
      </button>

      <button
        className="ort-btn ghost"
        onClick={()=>setScreen('live')}
      >
        ABRIR COCKPIT
      </button>
    </div>

    {message&&
      <div className="status-banner success">
        <strong>TESTE ATUALIZADO</strong>
        <span>{message}</span>
      </div>
    }

    {error&&
      <div className="status-banner error">
        <strong>BACKEND INDISPONÍVEL</strong>
        <span>{error}</span>
      </div>
    }

    <div className="system-health-strip">
      <div className={backendReady?'ok':'bad'}>
        <span>BACKEND</span>
        <strong>{backendReady?'CONECTADO':'OFFLINE'}</strong>
      </div>

      <div className={demoReady?'ok':'bad'}>
        <span>REPLAY DEMO</span>
        <strong>{demoReady?'DISPONÍVEL':'ARQUIVO AUSENTE'}</strong>
      </div>

      <div className={feed?.state==='LIVE'?'ok':'neutral'}>
        <span>FEED</span>
        <strong>{feedLabel}</strong>
      </div>

      <div className={session?.state==='READY'?'ok':'neutral'}>
        <span>SESSÃO</span>
        <strong>{sessionLabel}</strong>
      </div>
    </div>

    <div className="learning-lab-grid">
      <section className="learning-lab-card">
        <h3>LEARNING MODE / DIAGNÓSTICO OPERACIONAL</h3>
        <p>Registra decisões, sinais, proteção, MFE/MAE, erros e telemetria para o diagnóstico semanal. O módulo é somente observacional: não altera estratégia sozinho.</p>
        <div className="learning-mode-buttons">
          {(['OFF','NORMAL','LAB'] as const).map(mode=><button key={mode} className={diagnostics?.mode===mode?'active':''} disabled={busy} onClick={()=>setDiagnosticMode(mode)}>{mode}</button>)}
        </div>
        <div className="learning-status-line"><span>GRAVAÇÃO</span><strong>{diagnostics?.recording?'ATIVA':'DESLIGADA'}</strong></div>
        <div className="learning-status-line"><span>EVENTOS EM MEMÓRIA</span><strong>{diagnostics?.events_in_memory??0}</strong></div>
        <div className="learning-status-line"><span>AUTOALTERAÇÃO DE ESTRATÉGIA</span><strong>NÃO</strong></div>
        <button className="learning-export-btn" disabled={busy} onClick={exportDiagnostics}>EXPORTAR DIAGNÓSTICO SEMANAL</button>
      </section>

      <section className="learning-lab-card">
        <h3>COPY TRADER — LAB</h3>
        <div className="profit-bridge-state"><span>ESTADO</span><strong>{profitBridge?.state??'DISARMED'}</strong></div>
        <div className="learning-status-line"><span>JANELA DA PLATAFORMA</span><strong>{profitBridge?.window_detected?profitBridge?.window_title??'DETECTADA':'NÃO DETECTADA'}</strong></div>
        <div className="learning-status-line"><span>ROTEAMENTO</span><strong>{profitBridge?.routing??'DRY_RUN_ONLY'}</strong></div>
        <div className="learning-status-line"><span>EXECUÇÃO REAL</span><strong>DESABILITADA</strong></div>
        <div className="profit-bridge-actions">
          <button disabled={busy} onClick={()=>bridgeAction('detect')}>DETECTAR</button>
          <button className={profitBridge?.armed?'active':''} disabled={busy} onClick={()=>bridgeAction('arm')}>ARMAR LAB</button>
          <button disabled={busy} onClick={()=>bridgeAction('disarm')}>DESARMAR</button>
        </div>
        <div className="profit-bridge-actions dry-run">
          <button disabled={busy||!profitBridge?.armed} onClick={()=>bridgeDryRun('BUY_MARKET')}>TESTAR COMPRA DRY-RUN</button>
          <button disabled={busy||!profitBridge?.armed} onClick={()=>bridgeDryRun('SELL_MARKET')}>TESTAR VENDA DRY-RUN</button>
          <button disabled={busy||!profitBridge?.armed} onClick={()=>bridgeDryRun('CLOSE_POSITION')}>TESTAR ZERAR DRY-RUN</button>
        </div>
        <p className="profit-bridge-warning">Nesta versão o Copy Trader valida processo/janela, gera ATLAS ORDER ID e registra comandos em laboratório. Não envia ordens reais à corretora.</p>
      </section>
    </div>

    {!status&&error
      ? <EmptyState
          eyebrow="DIAGNÓSTICO"
          title="O BACKEND NÃO ESTÁ RESPONDENDO"
          description={`O frontend está aberto, mas a API ${runtime.apiBase} não respondeu. Inicie o ATLAS pelo atalho ou pelo script de inicialização e tente novamente.`}
          compact
        />
      : <div className="test-grid">
          <section className="test-card">
            <h3>APLICAÇÃO</h3>
            {[
              ['VERSÃO',status?.health?.version??'—'],
              ['BACKEND',backendLabel],
              ['API',runtime.apiBase],
              ['WEBSOCKET',runtime.wsBase],
              ['DEMO CSV',demoReady?'DISPONÍVEL':'AUSENTE'],
            ].map(([a,b])=>
              <div className="context-read" key={String(a)}>
                <span>{a}</span><strong>{String(b)}</strong>
              </div>
            )}
          </section>

          <section className="test-card">
            <h3>FEED</h3>
            {[
              ['ESTADO',feedLabel],
              ['FONTE',sourceLabel],
              ['ATIVO',feed?.symbol??'—'],
              ['TIMEFRAME',feed?.timeframe??'—'],
              ['ACEITOS',feed?.quality?.accepted??0],
              ['REJEITADOS',feed?.quality?.rejected??0],
            ].map(([a,b])=>
              <div className="context-read" key={String(a)}>
                <span>{a}</span><strong>{String(b)}</strong>
              </div>
            )}
          </section>

          <section className="test-card">
            <h3>SESSÃO</h3>
            {[
              ['ESTADO',sessionLabel],
              ['DATA',session?.market_date??'—'],
              ['CONTRATO',session?.contract??'—'],
              ['CANDLES',session?.candle_count??0],
              ['VWAP',session?.session_vwap?.toFixed?.(0)??'—'],
              ['D-1',session?.d1?'PRONTO':'AGUARDANDO'],
              ['GAPS',session?.gaps_open??0],
            ].map(([a,b])=>
              <div className="context-read" key={String(a)}>
                <span>{a}</span><strong>{String(b)}</strong>
              </div>
            )}
          </section>

          <section className="test-card">
            <h3>CHECKLIST VISUAL</h3>
            {[
              'COCKPIT ATLAS',
              'CONTEXTO DE MERCADO',
              'CENTRAL DE DECISÃO',
              'PRECISÃO DO SINAL',
              'CICLO DA OPERAÇÃO',
              'RISCO E GESTÃO',
            ].map((label,index)=>
              <div className="browser-check" key={label}>
                <span>{index+1}</span>
                <strong>{label}</strong>
              </div>
            )}
          </section>
        </div>
    }
  </section>
}
