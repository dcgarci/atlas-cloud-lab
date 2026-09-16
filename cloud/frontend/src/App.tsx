import {useEffect} from 'react'
import {useAppStore} from './store/appStore'
import {Nav} from './components/Nav'
import {AtlasMark} from './components/AtlasMark'
import {NotificationCenter,AtlasSystemWatchdog} from './components/NotificationCenter'
import {AtlasAssistant} from './components/AtlasAssistant'
import {LoginScreen} from './screens/LoginScreen'
import {BootScreen} from './screens/BootScreen'
import {LiveScreen} from './screens/LiveScreen'
import {ContextScreen} from './screens/ContextScreen'
import {DecisionGateScreen} from './screens/DecisionGateScreen'
import {SignalPrecisionScreen} from './screens/SignalPrecisionScreen'
import {TradeLifecycleScreen} from './screens/TradeLifecycleScreen'
import {RiskScreen} from './screens/RiskScreen'
import {LabScreen} from './screens/LabScreen'
import {JournalScreen} from './screens/JournalScreen'
import {StrategyScreen} from './screens/StrategyScreen'
import {SettingsScreen} from './screens/SettingsScreen'
import {ProfitBridgeScreen} from './screens/ProfitBridgeScreen'
import {SystemTestScreen} from './screens/SystemTestScreen'
import {ReplayAuditScreen} from './screens/ReplayAuditScreen'
import {HistoricalScreen} from './screens/HistoricalScreen'
import {
  APP_VERSION,
  APP_LONG_NAME,
  APP_BUILD_LABEL,
} from './config/app'

export default function App(){
  const ready=useAppStore(s=>s.ready)
  const user=useAppStore(s=>s.user)
  const experienceReady=useAppStore(s=>s.experienceReady)
  const completeExperienceBoot=useAppStore(s=>s.completeExperienceBoot)
  const boot=useAppStore(s=>s.boot)
  const screen=useAppStore(s=>s.screen)
  const setScreen=useAppStore(s=>s.setScreen)

  useEffect(()=>{boot()},[boot])

  if(!ready)return <div className="boot"><AtlasMark compact/> ATLAS / PREPARANDO ACESSO...</div>
  if(!user)return <LoginScreen/>
  if(!experienceReady)return <BootScreen
    onComplete={completeExperienceBoot}
    onDiagnostics={()=>{setScreen('test');completeExperienceBoot()}}
  />

  return <main className="app-shell atlas-fluent-lab">
    <AtlasSystemWatchdog/>
    <div className="grid-bg"/>
    <div className="scanlines"/>

    <header className="topbar">
      <div className="brand atlas-brand">
        <AtlasMark compact/>
        <div className="atlas-wordmark">ATLAS</div>
        <div>
          <span>{APP_LONG_NAME}</span>
          <strong>{APP_BUILD_LABEL}</strong>
        </div>
      </div>

      <div className="topbar-actions">
        <AtlasAssistant/>
        <NotificationCenter/>
        <div className="operator">
          <span>OPERADOR</span>
          <strong>{user.name}</strong>
        </div>
      </div>
    </header>

    <Nav/>

    <div className="screen-host">
      {screen==='live'&&<LiveScreen/>}
      {screen==='context'&&<ContextScreen/>}
      {screen==='decision'&&<DecisionGateScreen/>}
      {screen==='signal'&&<SignalPrecisionScreen/>}
      {screen==='trade'&&<TradeLifecycleScreen/>}
      {screen==='risk'&&<RiskScreen/>}
      {screen==='lab'&&<LabScreen/>}
      {screen==='journal'&&<JournalScreen/>}
      {screen==='strategy'&&<StrategyScreen/>}
      {screen==='audit'&&<ReplayAuditScreen/>}
      {screen==='historical'&&<HistoricalScreen/>}
      {screen==='test'&&<SystemTestScreen/>}
      {screen==='bridge'&&<ProfitBridgeScreen/>}
      {screen==='settings'&&<SettingsScreen/>}
    </div>

    <footer>
      <span>ATLAS V{APP_VERSION}</span>
      <strong>AO VIVO • LAB • DIÁRIO • ESTRATÉGIA • DADOS</strong>
      <span>POWERED BY ORT ENGINE</span>
    </footer>
  </main>
}
