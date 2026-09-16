import {useAppStore} from '../store/appStore'
import {AtlasIcon,type IconName} from './AtlasIcon'

// V2.12.20: o COCKPIT ATLAS ocupa o centro da barra.
// COPY TRADER PROFIT fica imediatamente ao lado e recebe destaque azul.
const items=[
  ['context','CONTEXTO DE MERCADO','context'],
  ['decision','CENTRAL DE DECISÃO','decision'],
  ['signal','PRECISÃO DO SINAL','precision'],
  ['trade','CICLO DA OPERAÇÃO','lifecycle'],
  ['risk','RISCO E GESTÃO','risk'],
  ['lab','LABORATÓRIO DE BACKTEST','lab'],
  ['live','COCKPIT ATLAS','live'],
  ['bridge','COPY TRADER PROFIT','bridge'],
  ['journal','DIÁRIO DE OPERAÇÕES','journal'],
  ['strategy','ESTRATÉGIAS','strategy'],
  ['historical','COFRE HISTÓRICO','vault'],
  ['test','TESTE DO SISTEMA','test'],
  ['settings','CONFIGURAÇÕES','settings'],
] as const satisfies readonly (readonly [string,string,IconName])[]

export function Nav(){
  const screen=useAppStore(s=>s.screen)
  const setScreen=useAppStore(s=>s.setScreen)

  return <nav className="nav nav-fluent" aria-label="Módulos do ATLAS">
    {items.map(([key,label,icon])=>{
      const classes=[
        screen===key?'active':'',
        key==='live'?'nav-cockpit-atlas':'',
        key==='bridge'?'nav-copy-trader-profit':'',
      ].filter(Boolean).join(' ')

      return <button
        type="button"
        title={label}
        aria-current={screen===key?'page':undefined}
        key={key}
        className={classes}
        onClick={()=>setScreen(key as any)}
      >
        <AtlasIcon name={icon} size={15}/>
        <span>{label}</span>
      </button>
    })}
  </nav>
}
