import {useEffect} from 'react'
import {useSignalStore} from '../store/signalStore'
import {EmptyState} from '../components/EmptyState'
import {
  pt,
  PERMISSION_LABELS,
  TRADE_TYPE_LABELS,
  RISK_LABELS,
} from '../i18n'

const order=[
  'REVERSAL_LONG',
  'REVERSAL_SHORT',
  'TREND_LONG',
  'TREND_SHORT',
]

function stageLabel(value:string){
  const map:Record<string,string>={
    SCANNING:'ESCANEANDO',
    WATCH:'EM OBSERVAÇÃO',
    ARMED:'ARMADO',
    CONFIRMED:'CONFIRMADO',
  }
  return map[value]??value
}

function b(v:any){
  return v?'✓':'✕'
}

export function SignalPrecisionScreen(){
  const data=useSignalStore(s=>s.data)
  const refresh=useSignalStore(s=>s.refresh)

  useEffect(()=>{
    refresh()
    const id=window.setInterval(
      refresh,
      1000
    )

    return()=>window.clearInterval(id)
  },[refresh])

  const candidates=data?.candidates??{}

  return <section className="content-screen">
    <div className="screen-title">
      <span>ESTRUTURA V2 / IMPULSO / PULLBACK / CONFIRMAÇÃO</span>
      <h2>PRECISÃO DO SINAL</h2>
    </div>

    <div className="precision-summary">
      <div>
        <span>ATR</span>
        <strong>
          {data?.atr?.toFixed?.(1)??'—'}
        </strong>
      </div>

      <div>
        <span>RVOL</span>
        <strong>
          {data?.rvol?.toFixed?.(2)??'—'}
        </strong>
      </div>

      <div>
        <span>DIST. VWAP</span>
        <strong>
          {data?.distance_to_mean_atr!=null
            ? `${data.distance_to_mean_atr.toFixed(2)} ATR`
            : '—'}
        </strong>
      </div>

      <div>
        <span>ESTRUTURA</span>
        <strong>
          {data?.structure_v2?.structure?.bias??'—'}
        </strong>
      </div>

      <div>
        <span>ABSORÇÃO</span>
        <strong>
          {pt(
            data?.absorption_v2?.status,
            RISK_LABELS
          )}
        </strong>
      </div>
    </div>

    <div className="signal-precision-grid">
      {order.map(key=>{
        const c=candidates[key]

        if(!c){
          return <article
            className="signal-card"
            key={key}
          >
            <h3>
              {pt(key,TRADE_TYPE_LABELS)}
            </h3>
            <EmptyState
              eyebrow="SEM EVIDÊNCIA"
              title="AGUARDANDO DADOS"
              description="O candidato será detalhado quando houver candles suficientes para estrutura, impulso, pullback e confirmação."
              compact
            />
          </article>
        }

        const pb=c.pullback_v2??{}
        const life=c.lifecycle??{}
        const structure=c.structure_v2??{}

        return <article
          className={`signal-card ${String(c.stage).toLowerCase()}`}
          key={key}
        >
          <header>
            <div>
              <span>
                {pt(key,TRADE_TYPE_LABELS)}
              </span>
              <strong>
                {stageLabel(c.stage)}
              </strong>
            </div>

            <b>
              {c.setup_score}
              <small>/100</small>
            </b>
          </header>

          <div className="signal-permission">
            <span>PERMISSÃO</span>
            <strong>
              {pt(
                c.permission,
                PERMISSION_LABELS
              )}
            </strong>
            <small>
              confiança {c.permission_confidence}
            </small>
          </div>

          <section>
            <h4>CONDIÇÕES</h4>

            {Object.entries(c.flags??{}).map(
              ([name,value])=>
                <div
                  className={`precision-flag ${value?'yes':'no'}`}
                  key={name}
                >
                  <span>
                    {name
                      .replaceAll('_',' ')
                      .toUpperCase()}
                  </span>
                  <strong>
                    {b(value)}
                  </strong>
                </div>
            )}
          </section>

          <section>
            <h4>ESTRUTURA</h4>

            <div className="precision-read">
              <span>CHOCH</span>
              <strong>
                {life.choch
                  ? `${life.choch.score} / ${life.choch.side}`
                  : '—'}
              </strong>
            </div>

            <div className="precision-read">
              <span>BOS</span>
              <strong>
                {life.bos
                  ? `${life.bos.score} / ${life.bos.side}`
                  : '—'}
              </strong>
            </div>

            <div className="precision-read">
              <span>IMPULSO</span>
              <strong>
                {c.impulse_lock
                  ? `${c.impulse_lock.range_points.toFixed(0)} pts`
                  : '—'}
              </strong>
            </div>

            <div className="precision-read">
              <span>INVALIDAÇÃO</span>
              <strong>
                {c.invalidation_price?.toFixed?.(0)??'—'}
              </strong>
            </div>
          </section>

          <section>
            <h4>PULLBACK</h4>

            <div className="precision-read">
              <span>ZONA</span>
              <strong>
                {pt(pb.zone,RISK_LABELS)}
              </strong>
            </div>

            <div className="precision-read">
              <span>PROFUNDIDADE</span>
              <strong>
                {pb.depth_pct!=null
                  ? `${(pb.depth_pct*100).toFixed(1)}%`
                  : '—'}
              </strong>
            </div>

            <div className="precision-read">
              <span>PB VOL RATIO</span>
              <strong>
                {pb.volume_ratio?.toFixed?.(2)??'—'}
              </strong>
            </div>

            <div className="precision-read">
              <span>NÍVEL CONFIRMAÇÃO</span>
              <strong>
                {c.confirmation_level?.toFixed?.(0)??'—'}
              </strong>
            </div>
          </section>
        </article>
      })}
    </div>
  </section>
}
