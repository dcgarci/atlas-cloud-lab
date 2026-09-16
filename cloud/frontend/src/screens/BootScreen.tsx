import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {api} from '../api/client'
import {AtlasMark} from '../components/AtlasMark'

export type BootStatus='PENDENTE'|'EXECUTANDO'|'OK'|'AGUARDANDO'|'ERRO'

type BootStep={
  id:string
  label:string
  path?:string
  critical:boolean
  status:BootStatus
  detail?:string
}

type BootLog={ts:string;label:string;status:BootStatus;detail?:string}

const BASE_STEPS:BootStep[]=[
  {id:'auth',label:'Autenticando usuário',path:'/api/auth/me',critical:true,status:'PENDENTE'},
  {id:'core',label:'Carregando ORT Engine',path:'/health',critical:true,status:'PENDENTE'},
  {id:'paper',label:'Inicializando Chart Trading',path:'/api/chart-trading/status',critical:true,status:'PENDENTE'},
  {id:'vault',label:'Carregando Cofre Histórico',path:'/api/feed/vault/summary',critical:true,status:'PENDENTE'},
  {id:'session',label:'Validando sessão de mercado',path:'/api/session/status',critical:true,status:'PENDENTE'},
  {id:'feed',label:'Verificando fonte de mercado',path:'/api/feed/status',critical:false,status:'PENDENTE'},
  {id:'ui',label:'Inicializando interface',critical:true,status:'PENDENTE'},
]

function clock(){
  return new Date().toLocaleTimeString('pt-BR',{hour12:false})
}

function feedLabel(data:any):{status:BootStatus;detail:string}{
  const state=String(data?.state??'STOPPED').toUpperCase()
  if(state==='LIVE')return {status:'OK',detail:'AO VIVO'}
  if(state==='ERROR')return {status:'AGUARDANDO',detail:'CONFIGURAR FEED'}
  if(state==='DEGRADED'||state==='STALE')return {status:'AGUARDANDO',detail:state}
  return {status:'AGUARDANDO',detail:'AGUARDANDO FONTE'}
}

export function BootScreen({onComplete,onDiagnostics}:{onComplete:()=>void;onDiagnostics:()=>void}){
  const [steps,setSteps]=useState<BootStep[]>(()=>BASE_STEPS.map(x=>({...x})))
  const [logs,setLogs]=useState<BootLog[]>([])
  const [running,setRunning]=useState(false)
  const [fatal,setFatal]=useState(false)
  const runId=useRef(0)

  const update=useCallback((id:string,status:BootStatus,detail?:string,log=true)=>{
    setSteps(items=>items.map(x=>x.id===id?{...x,status,detail}:x))
    if(log&&status!=='EXECUTANDO'&&status!=='PENDENTE'){
      const item=BASE_STEPS.find(x=>x.id===id)
      if(item)setLogs(list=>[...list.slice(-8),{ts:clock(),label:item.label,status,detail}])
    }
  },[])

  const run=useCallback(async()=>{
    const id=++runId.current
    setFatal(false)
    setRunning(true)
    setLogs([])
    setSteps(BASE_STEPS.map(x=>({...x})))

    for(const step of BASE_STEPS){
      if(id!==runId.current)return
      update(step.id,'EXECUTANDO',undefined,false)
      try{
        if(step.id==='ui'){
          await new Promise(resolve=>window.requestAnimationFrame(()=>resolve(null)))
          update(step.id,'OK','INTERFACE PRONTA')
          continue
        }
        const data=await api<any>(step.path!)
        if(step.id==='feed'){
          const state=feedLabel(data)
          update(step.id,state.status,state.detail)
        }else{
          update(step.id,'OK')
        }
      }catch(error){
        const detail=error instanceof Error?error.message:String(error)
        if(step.critical){
          update(step.id,'ERRO',detail)
          setFatal(true)
          setRunning(false)
          return
        }
        update(step.id,'AGUARDANDO',detail)
      }
    }

    if(id===runId.current){
      setRunning(false)
      window.setTimeout(onComplete,420)
    }
  },[onComplete,update])

  useEffect(()=>{run();return()=>{runId.current+=1}},[run])

  const completed=steps.filter(x=>x.status==='OK'||x.status==='AGUARDANDO').length
  const progress=Math.round((completed/steps.length)*100)
  const visibleLogs=useMemo(()=>logs.slice(-6),[logs])

  return <main className="atlas-auth-screen atlas-boot-layout">
    <div className="atlas-auth-shell">
      <section className="atlas-auth-brand-panel atlas-boot-brand-panel">
        <div className="atlas-market-candles atlas-market-candles-left" aria-hidden="true">
          {[74,116,88,164,122,192,148,208].map((h,i)=><i key={i} className={i===1||i===5?'red':'green'} style={{height:h}}/>) }
        </div>
        <div className="atlas-brand-center">
          <AtlasMark/>
          <h1>ATLAS</h1>
          <span>TRADING INTELLIGENCE</span>
          <p>MAIS DADOS.<br/>MELHORES DECISÕES.</p>
        </div>
        <div className="atlas-auth-version">ATLAS v2.12.21</div>
      </section>

      <section className="atlas-auth-form-panel atlas-boot-panel">
        <div className="atlas-boot-content">
          <header>
            <h2>{fatal?'FALHA NA INICIALIZAÇÃO':'Inicializando sua plataforma...'}</h2>
            <p>{fatal?'Um módulo essencial não respondeu.':'Preparando os módulos essenciais do ATLAS.'}</p>
          </header>

          <div className="atlas-boot-steps">
            {steps.map(step=><div key={step.id} className={`atlas-boot-step ${step.status.toLowerCase()}`}>
              <i>{step.status==='OK'?'✓':step.status==='ERRO'?'!':step.status==='AGUARDANDO'?'•':step.status==='EXECUTANDO'?'◌':'·'}</i>
              <span>{step.label}</span>
              <b>{step.status==='EXECUTANDO'?'...':step.status==='AGUARDANDO'?(step.detail??'AGUARDANDO'):step.status}</b>
            </div>)}
          </div>

          <div className="atlas-boot-progress-row">
            <div className="atlas-progress"><i style={{width:`${progress}%`}}/></div>
            <strong>{progress}%</strong>
          </div>

          <div className="atlas-boot-lower">
            <aside className="atlas-boot-console" aria-live="polite">
              {visibleLogs.map((x,index)=><div key={`${x.ts}-${x.label}-${index}`} className={x.status.toLowerCase()}>
                <span>[{x.ts}]</span>
                <b>{x.label}</b>
                <em>{x.status==='AGUARDANDO'?(x.detail??'AGUARDANDO'):x.status}</em>
              </div>)}
              {running&&<div className="running"><span>[{clock()}]</span><b>Processando módulos...</b><em>...</em></div>}
            </aside>

            <blockquote className="atlas-boot-quote">
              <p>Desejo boas operações.</p>
              <p>Cuide do emocional, não seja ganancioso<br/>e siga o plano fielmente.</p>
              <p>Bons estudos.</p>
              <cite>— Diego Garcia</cite>
            </blockquote>
          </div>

          {fatal&&<div className="atlas-boot-actions">
            <button onClick={run}>TENTAR NOVAMENTE</button>
            <button className="secondary" onClick={onDiagnostics}>ABRIR DIAGNÓSTICO</button>
          </div>}
        </div>
        <div className="atlas-auth-engine">ORT Engine</div>
      </section>
    </div>
  </main>
}
