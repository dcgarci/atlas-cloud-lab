import {useEffect} from 'react'
import {useRiskStore} from '../store/riskStore'
import {useTradeStore} from '../store/tradeStore'
import {pt,RISK_LABELS} from '../i18n'

function money(v:number|null|undefined){
  if(v==null)return '—'
  return `R$ ${v.toLocaleString('pt-BR',{maximumFractionDigits:2})}`
}

function num(v:number|null|undefined,d=2){
  if(v==null)return '—'
  return v.toLocaleString('pt-BR',{maximumFractionDigits:d})
}

export function RiskScreen(){
  const data=useRiskStore(s=>s.data)
  const profiles=useRiskStore(s=>s.profiles)
  const active=useRiskStore(s=>s.active)
  const refresh=useRiskStore(s=>s.refresh)
  const setActive=useRiskStore(s=>s.setActive)

  const trade=useTradeStore(s=>s.snapshot)

  useEffect(()=>{
    refresh()
    const id=window.setInterval(refresh,1000)
    return()=>window.clearInterval(id)
  },[refresh])

  const p=data?.preview
  const m=data?.management

  return <section className="content-screen">
    <div className="screen-title">
      <span>CONTROLE DE RISCO / GESTÃO ESTRUTURAL</span>
      <h2>RISCO E GESTÃO</h2>
    </div>

    <div className="risk-profile-strip">
      {profiles.map((profile:any)=>
        <button
          key={profile.id}
          className={profile.active?'active':''}
          onClick={()=>setActive(profile.id)}
        >
          <span>{profile.name}</span>
          <strong>{(profile.risk_pct*100).toFixed(2)}%</strong>
          <small>máx. {profile.max_contracts} contratos</small>
        </button>
      )}
    </div>

    <div className="risk-grid">
      <section className="risk-card">
        <h3>PERFIL ATIVO</h3>
        {[
          ['PERFIL',active?.name],
          ['CAPITAL',money(active?.capital)],
          ['RISCO %',active?`${(active.risk_pct*100).toFixed(2)}%`:'—'],
          ['RISCO ALVO',money(p?.risk_money_target)],
          ['VALOR DO PONTO',money(active?.point_value)],
          ['MÁX. CONTRATOS',active?.max_contracts],
          ['STOP MÍN.',`${num(active?.min_stop_points,0)} pts`],
          ['STOP MÁX.',`${num(active?.max_stop_points,0)} pts`],
        ].map(([a,b])=>
          <div className="context-read" key={String(a)}>
            <span>{a}</span><strong>{String(b??'—')}</strong>
          </div>
        )}
      </section>

      <section className="risk-card">
        <h3>DIMENSIONAMENTO</h3>
        {[
          ['ENTRADA',num(p?.entry_price,0)],
          ['STOP',num(p?.stop_price,0)],
          ['DISTÂNCIA STOP',`${num(p?.stop_points,0)} pts`],
          ['RISCO/CONTRATO',money(p?.risk_per_contract)],
          ['CONTRATOS',p?.contracts??0],
          ['RISCO REAL',money(p?.actual_risk_money)],
          ['STOP VÁLIDO',p?.valid_stop?'SIM':'NÃO'],
          ['BLOQUEIO',pt(p?.blocked_reason,RISK_LABELS)],
        ].map(([a,b])=>
          <div className="context-read" key={String(a)}>
            <span>{a}</span><strong>{String(b??'—')}</strong>
          </div>
        )}
      </section>

      <section className="risk-card">
        <h3>R-MULTIPLE</h3>
        {[
          ['RISCO INICIAL',`${num(m?.initial_risk_points,0)} pts`],
          ['R ATUAL',`${num(m?.current_r,2)}R`],
          ['MFE',`${num(m?.mfe_r,2)}R`],
          ['MAE',`${num(m?.mae_r,2)}R`],
          ['AÇÃO',pt(m?.management_action,RISK_LABELS)],
          ['STOP RECOMENDADO',num(m?.recommended_stop,0)],
        ].map(([a,b])=>
          <div className="context-read" key={String(a)}>
            <span>{a}</span><strong>{String(b??'—')}</strong>
          </div>
        )}
      </section>

      <section className="risk-card">
        <h3>GESTÃO</h3>

        <div className={`management-flag ${m?.be_armed?'on':''}`}>
          <span>BREAK-EVEN</span>
          <strong>{m?.be_armed?'ARMADO':'AGUARDANDO'}</strong>
        </div>

        <div className={`management-flag ${m?.protected_stop_armed?'on':''}`}>
          <span>STOP PROTEGIDO</span>
          <strong>{m?.protected_stop_armed?'ARMADO':'AGUARDANDO'}</strong>
        </div>

        <div className={`management-flag ${m?.partial_armed?'on':''}`}>
          <span>PARCIAL</span>
          <strong>{m?.partial_armed?'RECOMENDADA':'AGUARDANDO'}</strong>
        </div>

        <div className="management-flag">
          <span>FRAÇÃO PARCIAL</span>
          <strong>
            {m?.partial_fraction
              ? `${(m.partial_fraction*100).toFixed(0)}%`
              : '—'}
          </strong>
        </div>

        <div className="management-flag">
          <span>OPERAÇÃO</span>
          <strong>{trade?.trade_type??'SEM OPERAÇÃO'}</strong>
        </div>
      </section>
    </div>
  </section>
}
