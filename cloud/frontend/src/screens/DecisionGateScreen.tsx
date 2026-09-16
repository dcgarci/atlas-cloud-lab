import {useEffect} from 'react'
import {usePermissionStore} from '../store/permissionStore'
import {useContextStore} from '../store/contextStore'
import {useFeedStore} from '../store/feedStore'
import {useSessionStore} from '../store/sessionStore'
import {
  pt,PERMISSION_LABELS,REASON_LABELS,REGIME_LABELS,STATE_LABELS,
  TRADE_TYPE_LABELS
} from '../i18n'

function tone(status:string){
  if(status==='ALLOWED')return 'allowed'
  if(status==='WATCH')return 'watch'
  return 'blocked'
}

export function DecisionGateScreen(){
  const matrix=usePermissionStore(s=>s.matrix)
  const refresh=usePermissionStore(s=>s.refresh)

  const context=useContextStore(s=>s.status)
  const feed=useFeedStore(s=>s.status)
  const session=useSessionStore(s=>s.status)

  useEffect(()=>{
    refresh()
    const id=window.setInterval(refresh,1000)
    return()=>window.clearInterval(id)
  },[refresh])

  if(!matrix){
    return <section className="content-screen">
      <div className="empty-state">
        AGUARDANDO CENTRAL DE DECISÃO...
      </div>
    </section>
  }

  const order=[
    'REVERSAL_LONG',
    'REVERSAL_SHORT',
    'TREND_LONG',
    'TREND_SHORT',
  ]

  return <section className="content-screen">
    <div className="screen-title">
      <span>REGIME PRIMEIRO / PERMISSÃO DEPOIS / SINAL POR ÚLTIMO</span>
      <h2>CENTRAL DE DECISÃO</h2>
    </div>

    <div className={`global-gate ${matrix.global_locked?'locked':'open'}`}>
      <div>
        <span>GATE GLOBAL</span>
        <strong>{matrix.global_locked?'BLOQUEADO':'PRONTO'}</strong>
      </div>

      <div>
        <span>FEED</span>
        <strong>{pt(feed?.state,STATE_LABELS)}</strong>
      </div>

      <div>
        <span>SESSÃO</span>
        <strong>{pt(session?.state,STATE_LABELS)}</strong>
      </div>

      <div>
        <span>REGIME DO DIA</span>
        <strong>{pt(context?.day_regime,REGIME_LABELS)}</strong>
      </div>

      <div>
        <span>5M / 15M</span>
        <strong>
          {pt(context?.multi_timeframe?.bias_5m,REGIME_LABELS)} /
          {' '}
          {pt(context?.multi_timeframe?.bias_15m,REGIME_LABELS)}
        </strong>
      </div>
    </div>

    <div className="global-gate open">
      <div><span>VIÉS DIRECIONAL</span><strong>{matrix.ort_summary?.directional_side??'NEUTRAL'} · {matrix.ort_summary?.directional_bias??0}</strong></div>
      <div><span>PONTUAÇÃO DE MERCADO</span><strong>{matrix.ort_summary?.market_score??0}/100</strong></div>
      <div><span>PONTUAÇÃO DA OPERAÇÃO</span><strong>{matrix.ort_summary?.operation_score??0}/100</strong></div>
      <div><span>PERMISSÃO ORT</span><strong>{matrix.ort_summary?.ort_permission??'BLOCKED'}</strong></div>
      <div><span>MACRO × MICRO</span><strong>{matrix.ort_summary?.macro_micro_state??'UNKNOWN'}</strong></div>
    </div>

    {matrix.global_blockers.length>0&&
      <div className="global-blockers">
        {matrix.global_blockers.map(x=>
          <span key={x}>{pt(x,REASON_LABELS)}</span>
        )}
      </div>
    }

    <div className="permission-grid">
      {order.map(key=>{
        const d=matrix.decisions[key]
        if(!d)return null

        return <article
          className={`permission-card ${tone(d.status)}`}
          key={key}
        >
          <header>
            <div>
              <span>{key.includes('REVERSAL')?'REVERSÃO':'TENDÊNCIA'}</span>
              <strong>{pt(key,TRADE_TYPE_LABELS)}</strong>
            </div>

            <b>{pt(d.status,PERMISSION_LABELS)}</b>
          </header>

          <div className="confidence-ring">
            <span>CONFIANÇA</span>
            <strong>{d.confidence}</strong>
            <small>/100</small>
          </div>

          <section>
            <h4>MOTIVOS</h4>
            {d.reasons.length===0
              ? <em>NENHUM</em>
              : d.reasons.map(x=>
                  <div className="decision-reason" key={x}>
                    ✓ {pt(x,REASON_LABELS)}
                  </div>
                )
            }
          </section>

          <section>
            <h4>BLOQUEIOS</h4>
            {d.blockers.length===0
              ? <div className="decision-clear">SEM BLOQUEIOS</div>
              : d.blockers.map(x=>
                  <div className="decision-blocker" key={x}>
                    ✕ {pt(x,REASON_LABELS)}
                  </div>
                )
            }
          </section>
        </article>
      })}
    </div>

    <div className="cooldown-strip">
      <div>
        <span>COOLDOWN APÓS STOP</span>
        <strong>
          {matrix.cooldowns.stop_until
            ? matrix.cooldowns.stop_until.slice(11,19)
            : 'DESLIGADO'
          }
        </strong>
      </div>

      <div>
        <span>CANDLES DE RECUPERAÇÃO</span>
        <strong>{matrix.cooldowns.recovery_bars_remaining}</strong>
      </div>

      <div>
        <span>BLOQUEIO MANUAL</span>
        <strong>{matrix.cooldowns.manual_frozen?'ATIVO':'DESLIGADO'}</strong>
      </div>
    </div>
  </section>
}
