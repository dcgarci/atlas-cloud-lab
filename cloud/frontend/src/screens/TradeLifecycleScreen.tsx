import {useEffect} from 'react'
import {useTradeStore} from '../store/tradeStore'
import {
  pt,STATE_LABELS,ACTION_LABELS,DIRECTION_LABELS,
  TRADE_TYPE_LABELS,PERMISSION_LABELS,EVENT_LABELS
} from '../i18n'

const flow=[
  'SCANNING','WATCH','ARMED','CONFIRMED','ENTRY',
  'RETURN_MODE','MEAN_APPROACH','MEAN_TEST','MEAN_ACCEPTANCE',
  'TREND_CONVERSION','TREND_ACTIVE','EXIT_WATCH',
  'EXIT_CONFIRMED','CLOSED','COOLDOWN',
]

function n(v:number|null|undefined,d=0){
  if(v==null)return '—'
  return v.toLocaleString('pt-BR',{maximumFractionDigits:d})
}

export function TradeLifecycleScreen(){
  const snap=useTradeStore(s=>s.snapshot)
  const events=useTradeStore(s=>s.events)
  const connect=useTradeStore(s=>s.connect)
  const refresh=useTradeStore(s=>s.refresh)

  useEffect(()=>connect(),[connect])

  useEffect(()=>{
    refresh()
    const id=window.setInterval(refresh,1000)
    return()=>window.clearInterval(id)
  },[refresh])

  if(!snap){
    return <section className="content-screen">
      <div className="empty-state">
        AGUARDANDO MÁQUINA DE ESTADOS...
      </div>
    </section>
  }

  const currentIndex=flow.indexOf(snap.state)

  return <section className="content-screen">
    <div className="screen-title">
      <span>MÁQUINA OPERACIONAL UNIFICADA</span>
      <h2>CICLO DA OPERAÇÃO</h2>
    </div>

    <div className="lifecycle-top">
      {[
        ['ESTADO',pt(snap.state,STATE_LABELS)],
        ['TIPO DE OPERAÇÃO',pt(snap.trade_type,TRADE_TYPE_LABELS)],
        ['DIREÇÃO',pt(snap.direction,DIRECTION_LABELS)],
        ['AÇÃO',pt(snap.action,ACTION_LABELS)],
        ['PERMISSÃO',pt(snap.permission_status,PERMISSION_LABELS)],
        ['CONFIANÇA',snap.permission_confidence],
        ['SCORE SETUP',snap.setup_score],
      ].map(([a,b])=>
        <div key={String(a)}>
          <span>{a}</span>
          <strong>{String(b)}</strong>
        </div>
      )}
    </div>

    <div className="state-flow">
      {flow.map((state,index)=>
        <div
          key={state}
          className={[
            'state-node',
            state===snap.state?'current':'',
            index<currentIndex?'done':'',
          ].join(' ')}
        >
          <i/>
          <span>{pt(state,STATE_LABELS)}</span>
        </div>
      )}
    </div>

    <div className="trade-metric-grid">
      {[
        ['ENTRADA',n(snap.entry_price)],
        ['STOP',n(snap.stop_price)],
        ['PREÇO',n(snap.current_price)],
        ['VWAP',n(snap.vwap)],
        ['DISTÂNCIA DA MÉDIA',snap.distance_to_mean_atr!=null?`${snap.distance_to_mean_atr.toFixed(2)} ATR`:'—'],
        ['RESULTADO ABERTO',`${n(snap.open_pnl_points)} pts`],
        ['MFE',`${n(snap.mfe_points)} pts`],
        ['MAE',`${n(snap.mae_points)} pts`],
        ['SCORE REVERSÃO',snap.reversal_score],
        ['SCORE TENDÊNCIA',snap.trend_score],
        ['SCORE SAÍDA',snap.exit_score],
        ['CONVERTIDO EM TENDÊNCIA',snap.trend_converted?'SIM':'NÃO'],
        ['RISCO INICIAL',`${n(snap.initial_risk_points)} pts`],
        ['CONTRATOS',snap.contracts],
        ['RISCO R$',`R$ ${n(snap.risk_money,2)}`],
      ].map(([a,b])=>
        <div className="metric" key={String(a)}>
          <span>{a}</span>
          <strong>{String(b)}</strong>
        </div>
      )}
    </div>

    <div className="lifecycle-grid">
      <section className="lifecycle-card">
        <h3>CONDIÇÕES DO SETUP</h3>

        {Object.entries(snap.setup_flags).length===0
          ? <div className="empty-state">SEM SETUP ATIVO</div>
          : Object.entries(snap.setup_flags).map(([k,v])=>
              <div className={`flag-row ${v?'yes':'no'}`} key={k}>
                <span>{k.replaceAll('_',' ').toUpperCase()}</span>
                <strong>{v?'✓':'✕'}</strong>
              </div>
            )
        }
      </section>

      <section className="lifecycle-card">
        <h3>ESTADO DA OPERAÇÃO</h3>

        {[
          ['MÉDIA TOCADA',snap.mean_touched],
          ['MÉDIA ACEITA',snap.mean_accepted],
          ['RETESTE DA MÉDIA',snap.mean_retest],
          ['BOS DE CONVERSÃO',snap.conversion_bos],
          ['CONVERTIDO EM TENDÊNCIA',snap.trend_converted],
        ].map(([k,v])=>
          <div className={`flag-row ${v?'yes':'no'}`} key={String(k)}>
            <span>{k}</span>
            <strong>{v?'SIM':'NÃO'}</strong>
          </div>
        )}

        <div className="flag-row">
          <span>ID DA OPERAÇÃO</span>
          <strong className="uid">{snap.trade_uid?.slice(0,12)??'—'}</strong>
        </div>
      </section>

      <section className="lifecycle-card">
        <h3>PRECISÃO V2</h3>

        {[
          ['ESTRUTURA',snap.structure_v2?.structure?.bias??'—'],
          ['CHOCH',snap.structure_v2?.choch?.confirmed?'CONFIRMADO':'—'],
          ['BOS',snap.structure_v2?.bos?.confirmed?'CONFIRMADO':'—'],
          ['IMPULSO',snap.impulse_lock?.direction??'—'],
          ['PULLBACK',snap.pullback_v2?.zone??'—'],
          ['PB VOL RATIO',snap.pullback_v2?.volume_ratio?.toFixed?.(2)??'—'],
          ['ABSORÇÃO',snap.absorption_v2?.status??'—'],
          ['ABS SCORE',snap.absorption_v2?.score??0],
        ].map(([k,v])=>
          <div className="flag-row" key={String(k)}>
            <span>{k}</span>
            <strong>{String(v)}</strong>
          </div>
        )}
      </section>

      <section className="lifecycle-card events">
        <h3>FLUXO DE EVENTOS</h3>

        <div className="event-stream">
          {[...events].reverse().slice(0,20).map((e,index)=>
            <div className="event-row" key={`${e.ts}-${index}`}>
              <span>{e.ts.slice(11,19)}</span>
              <strong>{pt(e.event,EVENT_LABELS)}</strong>
              <small>{pt(e.state,STATE_LABELS)}</small>
            </div>
          )}

          {events.length===0&&
            <div className="empty-state">SEM EVENTOS AINDA</div>
          }
        </div>
      </section>
    </div>
  </section>
}
