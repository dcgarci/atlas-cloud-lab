import {useEffect,useState} from 'react'
import {api,backendHealth} from '../api/client'
import {runtime} from '../config/runtime'
import {useAppStore} from '../store/appStore'
import {AtlasMark} from '../components/AtlasMark'

export function LoginScreen(){
  const setUser=useAppStore(s=>s.setUser)

  const [mode,setMode]=useState<'login'|'register'|'recover'>('login')
  const [name,setName]=useState('')
  const [email,setEmail]=useState('')
  const [password,setPassword]=useState('')
  const [remember,setRemember]=useState(localStorage.getItem('atlas_remember_me')==='1')
  const [error,setError]=useState('')
  const [notice,setNotice]=useState('')
  const [submitting,setSubmitting]=useState(false)
  const [backend,setBackend]=useState<'checking'|'online'|'offline'>('checking')

  async function checkBackend(){
    setBackend('checking')
    const ok=await backendHealth()
    setBackend(ok?'online':'offline')
    return ok
  }

  useEffect(()=>{
    checkBackend()
    const id=window.setInterval(checkBackend,5000)
    return()=>window.clearInterval(id)
  },[])

  function changeMode(next:'login'|'register'|'recover'){
    setMode(next)
    setError('')
    setNotice('')
  }

  async function submit(e:React.FormEvent){
    e.preventDefault()
    setError('')
    setNotice('')

    if(mode==='recover'){
      if(!email.trim()){
        setError('Informe o e-mail cadastrado.')
        return
      }
      setNotice('Recuperação automática por e-mail será habilitada no módulo comercial. Nesta versão, utilize o acesso já cadastrado ou contate o administrador do ATLAS.')
      return
    }

    if(mode==='register'&&password.length<8){
      setError('A senha precisa ter no mínimo 8 caracteres.')
      return
    }

    const online=await checkBackend()
    if(!online){
      setError(`Núcleo local do ATLAS indisponível em ${runtime.apiBase}. Reinicie o ATLAS e tente novamente.`)
      return
    }

    setSubmitting(true)
    try{
      const body:any={email,password}
      if(mode==='register')body.name=name
      const result=await api<any>(`/api/auth/${mode==='login'?'login':'register'}`,{
        method:'POST',body:JSON.stringify(body),
      })
      localStorage.setItem('ort_token',result.token)
      localStorage.setItem('atlas_remember_me',remember?'1':'0')
      sessionStorage.setItem('atlas_authenticated_this_session','1')
      setUser(result.user)
    }catch(e){
      setError(e instanceof Error?e.message:String(e))
    }finally{
      setSubmitting(false)
    }
  }

  const isRecover=mode==='recover'
  const title=isRecover?'RECUPERAR SENHA':mode==='login'?'BEM-VINDO AO ATLAS':'CRIAR OPERADOR'
  const subtitle=isRecover
    ?'Informe o e-mail cadastrado para iniciar a recuperação.'
    :mode==='login'
      ?'Sua jornada no mercado começa aqui.'
      :'Crie seu acesso local ao ATLAS.'

  return <main className="atlas-auth-screen">
    <div className="atlas-auth-shell">
      <section className="atlas-auth-brand-panel" aria-label="Identidade ATLAS">
        <div className="atlas-market-candles atlas-market-candles-left" aria-hidden="true">
          {[78,128,94,168,126,196,152,214].map((h,i)=><i key={i} className={i===1||i===4?'red':'green'} style={{height:h}}/>) }
        </div>
        <div className="atlas-brand-center">
          <AtlasMark/>
          <h1>ATLAS</h1>
          <span>TRADING INTELLIGENCE</span>
          <p>MAIS DADOS.<br/>MELHORES DECISÕES.</p>
        </div>
        <div className="atlas-auth-version">ATLAS v2.12.21</div>
      </section>

      <section className="atlas-auth-form-panel">
        <div className="atlas-auth-form-wrap">
          <header>
            <h2>{title}</h2>
            <p>{subtitle}</p>
          </header>

          <div className={`backend-pill atlas-auth-backend ${backend}`}>
            <i/>{backend==='checking'?'VALIDANDO NÚCLEO':backend==='online'?'SISTEMA DISPONÍVEL':'NÚCLEO OFFLINE'}
          </div>

          <form onSubmit={submit}>
            {mode==='register'&&<label>
              <span>Nome</span>
              <input
                placeholder="Nome do operador"
                minLength={2}
                maxLength={120}
                required
                value={name}
                onChange={e=>setName(e.target.value)}
              />
            </label>}

            <label>
              <span>E-mail</span>
              <input
                placeholder="seu@email.com"
                type="email"
                required
                value={email}
                onChange={e=>setEmail(e.target.value)}
              />
            </label>

            {!isRecover&&<label>
              <span>Senha</span>
              <input
                placeholder="••••••••"
                type="password"
                minLength={mode==='register'?8:1}
                required
                value={password}
                onChange={e=>setPassword(e.target.value)}
              />
            </label>}

            {mode==='login'&&<div className="atlas-auth-options">
              <label className="atlas-checkbox">
                <input type="checkbox" checked={remember} onChange={e=>setRemember(e.target.checked)}/>
                <i/>
                <span>Manter-me conectado</span>
              </label>
              <button type="button" className="atlas-auth-link" onClick={()=>changeMode('recover')}>Esqueci minha senha</button>
            </div>}

            {mode==='register'&&<small className="login-help">A senha precisa ter no mínimo 8 caracteres.</small>}
            {error&&<div className="form-error">{error}</div>}
            {notice&&<div className="form-notice">{notice}</div>}

            <div className="atlas-auth-actions">
              <button className="atlas-auth-primary" type="submit" disabled={submitting||backend==='checking'}>
                {submitting?'PROCESSANDO...':isRecover?'ENVIAR':mode==='login'?'ENTRAR':'CRIAR CONTA'}
              </button>
              <button type="button" className="atlas-auth-secondary" onClick={()=>isRecover?changeMode('login'):setEmail('')}>
                {isRecover?'VOLTAR':'CANCELAR'}
              </button>
            </div>
          </form>

          {!isRecover&&<button type="button" className="atlas-auth-register" onClick={()=>changeMode(mode==='login'?'register':'login')}>
            {mode==='login'?'NÃO POSSUI CONTA? CADASTRE-SE':'JÁ POSSUI CONTA? VOLTAR AO LOGIN'}
          </button>}

          <div className="atlas-auth-motto">Disciplina hoje. Resultados sempre.</div>
        </div>
        <div className="atlas-auth-engine">ORT Engine</div>
      </section>
    </div>
  </main>
}
