import {useEffect,useState} from 'react'
import {api} from '../api/client'
import {EmptyState} from '../components/EmptyState'

const defaults={
  extension_atr:.9,
  rvol_min:1.3,
  reversal_score_min:75,
  trend_score_min:75,
  trend_conversion_min:75,
  pullback_min:.236,
  pullback_max:.786,
  stop_atr_buffer:.1,
  exit_score_min:80,
}

export function StrategyScreen(){
  const [profiles,setProfiles]=useState<any[]>([])
  const [name,setName]=useState('WIN 5M REVERSAL')
  const [params,setParams]=useState(JSON.stringify(defaults,null,2))
  const [error,setError]=useState('')

  const load=()=>api<any[]>('/api/strategy/profiles').then(setProfiles)
  useEffect(()=>{load()},[])

  async function create(){
    setError('')
    try{
      const parsed=JSON.parse(params)
      await api('/api/strategy/profiles',{
        method:'POST',
        body:JSON.stringify({
          name,
          symbol:'WIN',
          timeframe:'5m',
          params:parsed,
          active:profiles.length===0,
        })
      })
      await load()
    }catch(e){
      setError(e instanceof Error?e.message:String(e))
    }
  }

  return <section className="content-screen strategy-screen">
    <div className="screen-title">
      <span>CONFIGURAÇÃO DE REGRAS</span>
      <h2>PERFIS DE ESTRATÉGIA</h2>
    </div>

    <div className="strategy-grid">
      <div className="profile-list">
        {profiles.map(p=><div className={`profile-card ${p.active?'active':''}`} key={p.id}>
          <span>V{p.version} / {p.symbol} / {p.timeframe}</span>
          <strong>{p.name}</strong>
          <small>{p.active?'PERFIL ATIVO':'EM ESPERA'}</small>
        </div>)}

        {profiles.length===0&&
          <EmptyState
            eyebrow="CONFIGURAÇÃO INICIAL"
            title="CRIE O PRIMEIRO PERFIL"
            description="O perfil guarda os limiares versionados usados pelo motor. O JSON ao lado já contém uma base inicial para WIN 5M."
            compact
          />
        }
      </div>

      <div className="profile-editor">
        <label>NOME DO PERFIL</label>
        <input value={name} onChange={e=>setName(e.target.value)}/>

        <label>PARÂMETROS JSON</label>
        <textarea value={params} onChange={e=>setParams(e.target.value)}/>

        {error&&<div className="form-error">{error}</div>}
        <button className="primary" onClick={create}>SALVAR PERFIL</button>
      </div>
    </div>
  </section>
}
