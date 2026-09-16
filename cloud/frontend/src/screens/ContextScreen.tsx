import {useEffect} from 'react'
import {useContextStore} from '../store/contextStore'
import {
  pt,REGIME_LABELS,SESSION_PHASE_LABELS,VOLATILITY_LABELS,
  RANGE_STATE_LABELS,GAP_LABELS,REASON_LABELS,SEVEN_DAY_LABELS
} from '../i18n'

function value(v:any){
  if(v==null)return '—'
  if(typeof v==='number')return v.toLocaleString('pt-BR',{maximumFractionDigits:2})
  return String(v)
}

export function ContextScreen(){
  const context=useContextStore(s=>s.status)
  const refresh=useContextStore(s=>s.refresh)

  useEffect(()=>{
    refresh()
    const id=window.setInterval(refresh,1000)
    return()=>window.clearInterval(id)
  },[refresh])

  if(!context){
    return <section className="content-screen">
      <div className="empty-state">AGUARDANDO CONTEXTO DE MERCADO...</div>
    </section>
  }

  return <section className="content-screen">
    <div className="screen-title">
      <span>REGIME PRIMEIRO / SINAL DEPOIS</span>
      <h2>CONTEXTO DE MERCADO</h2>
    </div>

    <div className="metric-grid context-metrics">
      {[
        ['REGIME DO DIA',pt(context.day_regime,REGIME_LABELS)],
        ['FASE DA SESSÃO',pt(context.session_phase,SESSION_PHASE_LABELS)],
        ['VOLATILIDADE',pt(context.volatility,VOLATILITY_LABELS)],
        ['VIÉS 5M',pt(context.multi_timeframe.bias_5m,REGIME_LABELS)],
        ['VIÉS 15M',pt(context.multi_timeframe.bias_15m,REGIME_LABELS)],
        ['MTF ALINHADO',context.multi_timeframe.aligned?'SIM':'NÃO'],
        ['CTX REVERSÃO',context.scores.reversal],
        ['CTX TENDÊNCIA',context.scores.trend],
        ['RISCO NÃO OPERAR',context.scores.no_trade_risk],
      ].map(([a,b])=><div className="metric" key={String(a)}>
        <span>{a}</span><strong>{value(b)}</strong>
      </div>)}
    </div>

    <div className="context-grid">
      <section className="context-card">
        <h3>D-1 / FIBONACCI</h3>
        <div className="context-read">
          <span>NÍVEL MAIS PRÓXIMO</span><strong>{context.nearest_d1_fib??'—'}</strong>
        </div>
        <div className="context-read">
          <span>PREÇO</span><strong>{value(context.nearest_d1_fib_price)}</strong>
        </div>
        {Object.entries(context.d1_fibonacci).slice(0,8).map(([k,v])=>
          <div className="context-read" key={k}>
            <span>{k}</span><strong>{value(v)}</strong>
          </div>
        )}
      </section>

      <section className="context-card">
        <h3>ABERTURA / BALANÇO INICIAL</h3>
        {[
          ['OR HIGH',context.opening_range.high],
          ['OR LOW',context.opening_range.low],
          ['ESTADO OR',pt(context.opening_range.state,RANGE_STATE_LABELS)],
          ['IB HIGH',context.initial_balance.high],
          ['IB LOW',context.initial_balance.low],
          ['ESTADO IB',pt(context.initial_balance.state,RANGE_STATE_LABELS)],
          ['DIREÇÃO GAP',pt(context.opening_gap.direction,GAP_LABELS)],
          ['ESTADO GAP',pt(context.opening_gap.state,GAP_LABELS)],
          ['GAP PTS',context.opening_gap.points],
        ].map(([a,b])=><div className="context-read" key={String(a)}>
          <span>{a}</span><strong>{value(b)}</strong>
        </div>)}
      </section>

      <section className="context-card">
        <h3>CONTEXTO DOS 5 PREGÕES</h3>
        {[
          ['MÁXIMA 5P',context.seven_day.high],
          ['MÍNIMA 5P',context.seven_day.low],
          ['MEIO 5P',context.seven_day.mid],
          ['POSIÇÃO',context.seven_day.position_pct!=null?`${context.seven_day.position_pct.toFixed(1)}%`:'—'],
          ['LOCALIZAÇÃO',pt(context.seven_day.location,SEVEN_DAY_LABELS)],
          ['DIREÇÃO FECHAMENTOS',pt(context.seven_day.close_direction,SEVEN_DAY_LABELS)],
          ['REGIME DE RANGE',pt(context.seven_day.range_regime,SEVEN_DAY_LABELS)],
          ['SESSÕES',context.seven_day.sessions_used],
        ].map(([a,b])=><div className="context-read" key={String(a)}>
          <span>{a}</span><strong>{value(b)}</strong>
        </div>)}
        <div className="context-read"><span>TOPOS 5P</span><strong>{context.seven_day.top_levels?.length?context.seven_day.top_levels.map(x=>`${value(x.price)} (${x.touches}x)`).join(' · '):'—'}</strong></div>
        <div className="context-read"><span>FUNDOS 5P</span><strong>{context.seven_day.bottom_levels?.length?context.seven_day.bottom_levels.map(x=>`${value(x.price)} (${x.touches}x)`).join(' · '):'—'}</strong></div>
      </section>

      <section className="context-card reasons">
        <h3>MOTIVOS DO CONTEXTO</h3>
        {context.reasons.length===0
          ? <div className="empty-state">SEM SINALIZAÇÕES DE CONTEXTO</div>
          : context.reasons.map(r=><div className="reason-tag" key={r}>
              {pt(r,REASON_LABELS)}
            </div>)
        }
      </section>
    </div>
  </section>
}
