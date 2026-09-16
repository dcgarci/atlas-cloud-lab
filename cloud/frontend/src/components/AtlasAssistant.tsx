import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import {createPortal} from 'react-dom'
import {useAppStore} from '../store/appStore'
import {useNotificationStore} from '../store/notificationStore'
import {apiUrl} from '../config/runtime'

type AssistantProfile='female'|'male'
type VoiceEngine='neural'|'browser'
type NeuralVoice={id:string;label:string;gender:string;locale:string}
type SpeechJob={text:string;priority:'normal'|'important';key:string;cooldownMs:number;force?:boolean}

const VOICE_KEY='atlas_ai_voice_uri'
const PROFILE_KEY='atlas_ai_profile'
const ENABLED_KEY='atlas_ai_voice_enabled'
const ENGINE_KEY='atlas_ai_voice_engine'
const PROFILE_MIGRATION_KEY='atlas_ai_profile_default_21210'
const DEFAULT_RATE=.93
const DEFAULT_VOLUME=.88
const FALLBACK_FEMALE='pt-BR-FranciscaNeural'
const FALLBACK_MALE='pt-BR-AntonioNeural'

function periodGreeting(){const h=new Date().getHours();if(h<12)return'Bom dia';if(h<18)return'Boa tarde';return'Boa noite'}
function normalized(value:string){return value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()}

function voiceScore(voice:SpeechSynthesisVoice,profile:AssistantProfile){
  const name=normalized(voice.name),lang=String(voice.lang||'').toLowerCase();let score=0
  if(lang==='pt-br')score+=60;else if(lang.startsWith('pt'))score+=35
  if(/natural|neural|online/.test(name))score+=40
  if(/microsoft|google/.test(name))score+=10
  const female=['francisca','thalita','fernanda','maria','heloisa','helena','luciana','leticia','female','feminina']
  const male=['antonio','daniel','ricardo','fabio','paulo','male','masculino']
  const wanted=profile==='female'?female:male,unwanted=profile==='female'?male:female
  if(wanted.some(h=>name.includes(h)))score+=120
  if(unwanted.some(h=>name.includes(h)))score-=160
  return score
}

function initialProfile():AssistantProfile{
  if(localStorage.getItem(PROFILE_MIGRATION_KEY)!=='1'){
    localStorage.setItem(PROFILE_MIGRATION_KEY,'1');localStorage.setItem(PROFILE_KEY,'female');localStorage.removeItem(VOICE_KEY);return'female'
  }
  return localStorage.getItem(PROFILE_KEY)==='male'?'male':'female'
}

export function AtlasAssistant(){
  const user=useAppStore(s=>s.user)
  const notices=useNotificationStore(s=>s.items)
  const [open,setOpen]=useState(false)
  const [profile,setProfile]=useState<AssistantProfile>(initialProfile)
  const [enabled,setEnabled]=useState(()=>localStorage.getItem(ENABLED_KEY)!=='0')
  const [engine,setEngine]=useState<VoiceEngine>(()=>localStorage.getItem(ENGINE_KEY)==='browser'?'browser':'neural')
  const [voices,setVoices]=useState<SpeechSynthesisVoice[]>([])
  const [neuralVoices,setNeuralVoices]=useState<NeuralVoice[]>([])
  const [neuralAvailable,setNeuralAvailable]=useState<boolean|null>(null)
  const [voiceURI,setVoiceURI]=useState(()=>localStorage.getItem(VOICE_KEY)??'')
  const [speaking,setSpeaking]=useState(false)
  const [volume,setVolume]=useState(()=>Number(localStorage.getItem('atlas_ai_volume')??String(DEFAULT_VOLUME)))
  const [rate,setRate]=useState(()=>Number(localStorage.getItem('atlas_ai_rate')??String(DEFAULT_RATE)))

  const queueRef=useRef<SpeechJob[]>([])
  const busyRef=useRef(false)
  const timerRef=useRef<number|null>(null)
  const lastSpokenRef=useRef<Map<string,number>>(new Map())
  const settingsRef=useRef<any>(null)
  const audioRef=useRef<HTMLAudioElement|null>(null)

  useEffect(()=>{
    const load=()=>setVoices(window.speechSynthesis?.getVoices?.()??[])
    load();window.speechSynthesis?.addEventListener?.('voiceschanged',load)
    return()=>window.speechSynthesis?.removeEventListener?.('voiceschanged',load)
  },[])

  useEffect(()=>{
    let cancelled=false
    fetch(apiUrl('/api/assistant/voices'),{cache:'no-store'})
      .then(r=>r.ok?r.json():Promise.reject(new Error(String(r.status))))
      .then(body=>{if(cancelled)return;setNeuralAvailable(Boolean(body?.available));setNeuralVoices(Array.isArray(body?.voices)?body.voices:[])})
      .catch(()=>{if(!cancelled)setNeuralAvailable(false)})
    return()=>{cancelled=true}
  },[])

  const rankedVoices=useMemo(()=>{
    const pt=voices.filter(v=>String(v.lang).toLowerCase().startsWith('pt'));const source=pt.length?pt:voices
    return [...source].sort((a,b)=>voiceScore(b,profile)-voiceScore(a,profile))
  },[profile,voices])

  const preferredVoice=useMemo(()=>{
    if(voiceURI){const chosen=voices.find(v=>v.voiceURI===voiceURI);if(chosen)return chosen}
    return rankedVoices[0]??null
  },[rankedVoices,voiceURI,voices])

  const neuralCandidates=useMemo(()=>{
    const gender=profile==='female'?'female':'male'
    const filtered=neuralVoices.filter(v=>String(v.gender).toLowerCase()===gender)
    return filtered.length?filtered:neuralVoices
  },[neuralVoices,profile])

  const selectedNeuralVoice=useMemo(()=>{
    if(voiceURI&&neuralVoices.some(v=>v.id===voiceURI))return voiceURI
    const names=neuralCandidates.map(v=>v.id)
    const preferred=profile==='female'
      ? names.find(x=>/Francisca|Thalita/i.test(x))
      : names.find(x=>/Antonio/i.test(x))
    return preferred??names[0]??(profile==='female'?FALLBACK_FEMALE:FALLBACK_MALE)
  },[neuralCandidates,neuralVoices,profile,voiceURI])

  useEffect(()=>{settingsRef.current={enabled,engine,preferredVoice,selectedNeuralVoice,profile,rate,volume}},[enabled,engine,preferredVoice,selectedNeuralVoice,profile,rate,volume])

  const finishJob=useCallback((job:SpeechJob)=>{
    setSpeaking(false);busyRef.current=false;lastSpokenRef.current.set(job.key,Date.now())
    const pause=job.priority==='important'?900:1450
    timerRef.current=window.setTimeout(()=>drainQueueRef.current(),pause)
  },[])

  const drainQueueRef=useRef<()=>void>(()=>{})
  const drainQueue=useCallback(()=>{
    if(busyRef.current)return
    const settings=settingsRef.current,job=queueRef.current.shift()
    if(!settings||!job)return
    if(!settings.enabled&&!job.force){timerRef.current=window.setTimeout(()=>drainQueueRef.current(),100);return}
    busyRef.current=true;setSpeaking(true)

    const fallbackBrowser=()=>{
      try{
        if(!window.speechSynthesis)throw new Error('SpeechSynthesis indisponível')
        if(!settings.preferredVoice){
          busyRef.current=false;setSpeaking(false);queueRef.current.unshift(job);timerRef.current=window.setTimeout(()=>drainQueueRef.current(),300);return
        }
        const utter=new SpeechSynthesisUtterance(job.text)
        if(settings.preferredVoice)utter.voice=settings.preferredVoice
        utter.lang=settings.preferredVoice?.lang??'pt-BR'
        utter.rate=Math.max(.80,Math.min(1.08,Number(settings.rate)||DEFAULT_RATE))
        utter.pitch=settings.profile==='male'?.96:1.03
        utter.volume=Math.max(0,Math.min(1,Number(settings.volume)||DEFAULT_VOLUME))
        utter.onend=()=>finishJob(job);utter.onerror=()=>finishJob(job)
        window.speechSynthesis.speak(utter)
      }catch{finishJob(job)}
    }

    if(settings.engine!=='neural'){fallbackBrowser();return}

    const ratePct=Math.round((Math.max(.80,Math.min(1.08,Number(settings.rate)||DEFAULT_RATE))-1)*100)
    fetch(apiUrl('/api/assistant/tts'),{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({text:job.text,voice:settings.selectedNeuralVoice,rate_pct:ratePct,pitch_hz:settings.profile==='female'?2:0,volume_pct:0}),
    }).then(async response=>{
      if(!response.ok)throw new Error(String(response.status))
      const blob=await response.blob(),url=URL.createObjectURL(blob),audio=new Audio(url)
      audioRef.current=audio;audio.volume=Math.max(0,Math.min(1,Number(settings.volume)||DEFAULT_VOLUME))
      audio.onended=()=>{URL.revokeObjectURL(url);audioRef.current=null;finishJob(job)}
      audio.onerror=()=>{URL.revokeObjectURL(url);audioRef.current=null;fallbackBrowser()}
      await audio.play()
    }).catch(()=>fallbackBrowser())
  },[finishJob])
  useEffect(()=>{drainQueueRef.current=drainQueue},[drainQueue])

  const enqueueSpeech=useCallback((text:string,priority:'normal'|'important'='normal',opts:{dedupeKey?:string,cooldownMs?:number,force?:boolean}={})=>{
    const clean=text.replace(/\s+/g,' ').trim();if(!clean)return
    const key=opts.dedupeKey??normalized(clean).slice(0,96),cooldownMs=Math.max(0,opts.cooldownMs??(priority==='important'?9000:30000))
    const last=lastSpokenRef.current.get(key)??0
    if(!opts.force&&Date.now()-last<cooldownMs)return
    if(queueRef.current.some(x=>x.key===key))return
    const job:SpeechJob={text:clean,priority,key,cooldownMs,force:opts.force}
    if(priority==='important')queueRef.current.unshift(job);else queueRef.current.push(job)
    if(queueRef.current.length>5)queueRef.current=queueRef.current.slice(0,5)
    drainQueueRef.current()
  },[])

  useEffect(()=>{
    const handler=(event:any)=>enqueueSpeech(String(event?.detail?.text??''),event?.detail?.priority==='important'?'important':'normal',{dedupeKey:event?.detail?.dedupeKey,cooldownMs:Number(event?.detail?.cooldownMs??0)||undefined})
    window.addEventListener('atlas-speak',handler as EventListener);return()=>window.removeEventListener('atlas-speak',handler as EventListener)
  },[enqueueSpeech])

  useEffect(()=>{
    if(!user||!enabled)return
    if(engine==='neural'&&neuralAvailable===null)return
    if(engine==='browser'&&!preferredVoice)return
    const key=`atlas_ai_welcome_${user.id}`;if(sessionStorage.getItem(key)==='1')return
    sessionStorage.setItem(key,'1')
    const first=String(user.name||'operador').trim().split(/\s+/)[0]
    window.setTimeout(()=>enqueueSpeech(`${periodGreeting()}, ${first}. ATLAS pronta. Desejo boas operações.`,'normal',{dedupeKey:`welcome:${user.id}`,cooldownMs:60_000}),900)
  },[user?.id,enabled,engine,neuralAvailable,preferredVoice,enqueueSpeech])

  useEffect(()=>{
    if(!enabled)return
    const latest=notices[0];if(!latest||!['CRITICAL','ATTENTION'].includes(latest.level))return
    enqueueSpeech(`${latest.title}. ${latest.message}`,latest.level==='CRITICAL'?'important':'normal',{dedupeKey:`notice:${latest.dedupeKey??latest.id}`,cooldownMs:60_000})
  },[notices,enabled,enqueueSpeech])

  useEffect(()=>()=>{if(timerRef.current)window.clearTimeout(timerRef.current);window.speechSynthesis?.cancel();audioRef.current?.pause()},[])

  const saveProfile=(next:AssistantProfile)=>{setProfile(next);localStorage.setItem(PROFILE_KEY,next);localStorage.removeItem(VOICE_KEY);setVoiceURI('')}
  const saveEnabled=(next:boolean)=>{setEnabled(next);localStorage.setItem(ENABLED_KEY,next?'1':'0');if(!next){queueRef.current=[];busyRef.current=false;window.speechSynthesis?.cancel();audioRef.current?.pause();setSpeaking(false)}}
  const saveEngine=(next:VoiceEngine)=>{setEngine(next);localStorage.setItem(ENGINE_KEY,next);localStorage.removeItem(VOICE_KEY);setVoiceURI('')}
  const saveVoice=(uri:string)=>{setVoiceURI(uri);localStorage.setItem(VOICE_KEY,uri)}
  const saveVolume=(v:number)=>{setVolume(v);localStorage.setItem('atlas_ai_volume',String(v))}
  const saveRate=(v:number)=>{setRate(v);localStorage.setItem('atlas_ai_rate',String(v))}
  const firstName=String(user?.name??'Operador').split(/\s+/)[0]

  const preview=()=>{
    queueRef.current=[];window.speechSynthesis?.cancel();audioRef.current?.pause();busyRef.current=false
    enqueueSpeech(`${periodGreeting()}, ${firstName}. Sou ${profile==='male'?'o ATLAS':'a ATLAS'}. Estou acompanhando o mercado com você. Se algo importante mudar, eu aviso.`,'important',{dedupeKey:`preview:${Date.now()}`,cooldownMs:0,force:true})
  }

  const panel=open?createPortal(<div className="atlas-ai-modal-layer" onMouseDown={e=>{if(e.target===e.currentTarget)setOpen(false)}}>
    <div className="atlas-assistant-panel atlas-assistant-panel-modal">
      <header><div><span>ASSISTENTE OPERACIONAL</span><strong>{profile==='male'?'O ATLAS':'ATLAS'}</strong></div><button onClick={()=>setOpen(false)}>×</button></header>
      <div className="atlas-assistant-hero"><img src={profile==='male'?'/assets/atlas-ai-male.png':'/assets/atlas-ai-female.png'} alt="Avatar da IA ATLAS"/><div><strong>{periodGreeting()}, {firstName}.</strong><span>Assistente contextual do cockpit.</span></div></div>
      <label className="atlas-ai-switch"><span>VOZ DA ATLAS</span><button className={enabled?'on':'off'} onClick={()=>saveEnabled(!enabled)}><i/></button></label>
      <div className="atlas-ai-profile"><button className={profile==='female'?'active':''} onClick={()=>saveProfile('female')}>ATLAS · FEMININA</button><button className={profile==='male'?'active':''} onClick={()=>saveProfile('male')}>ATLAS · MASCULINO</button></div>
      <label>MOTOR DE VOZ<select value={engine} onChange={e=>saveEngine(e.target.value as VoiceEngine)}><option value="neural">NEURAL ONLINE · MAIS NATURAL</option><option value="browser">LOCAL / NAVEGADOR · CONTINGÊNCIA</option></select></label>
      {engine==='neural'?<label>VOZ NEURAL<select value={selectedNeuralVoice} onChange={e=>saveVoice(e.target.value)}>{neuralCandidates.map(v=><option value={v.id} key={v.id}>{v.label}</option>)}</select><small className="atlas-ai-engine-status">{neuralAvailable?'ONLINE · voz neural pronta':'INDISPONÍVEL · fallback local automático'}</small></label>:<label>VOZ LOCAL<select value={voiceURI} onChange={e=>saveVoice(e.target.value)}><option value="">AUTOMÁTICA · PT-BR</option>{rankedVoices.map(v=><option value={v.voiceURI} key={v.voiceURI}>{v.name} · {v.lang}</option>)}</select></label>}
      <label>VOLUME <input type="range" min="0" max="1" step=".05" value={volume} onChange={e=>saveVolume(Number(e.target.value))}/></label>
      <label>VELOCIDADE <input type="range" min=".80" max="1.08" step=".02" value={rate} onChange={e=>saveRate(Number(e.target.value))}/></label>
      <button className="atlas-ai-preview" onClick={preview}>▶ OUVIR PRÉVIA</button>
      <p>V2.12.20 usa voz neural online como padrão e mantém a voz local apenas como contingência. A ATLAS respeita fila, cooldown e não repete o mesmo sinal a cada candle.</p>
    </div>
  </div>,document.body):null

  return <div className="atlas-assistant-wrap">
    <button className={`atlas-assistant-orb ${speaking?'speaking':''} ${enabled?'enabled':'disabled'}`} onClick={()=>setOpen(v=>!v)} title="Assistente ATLAS"><img src={profile==='male'?'/assets/atlas-ai-male.png':'/assets/atlas-ai-female.png'} alt="ATLAS IA"/><i/><em/></button>
    {panel}
  </div>
}
