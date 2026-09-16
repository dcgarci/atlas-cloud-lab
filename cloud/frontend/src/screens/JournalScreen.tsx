import {useEffect,useMemo,useState} from 'react'
import {api} from '../api/client'
import {EmptyState} from '../components/EmptyState'
import {useAppStore} from '../store/appStore'

function sideLabel(side:string){
  return side==='LONG'?'COMPRA':side==='SHORT'?'VENDA':side||'—'
}

function money(v:any){
  const n=Number(v)
  if(!Number.isFinite(n))return '—'
  return `R$ ${n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}

function num(v:any,digits=0){
  const n=Number(v)
  if(!Number.isFinite(n))return '—'
  return n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits})
}

export function JournalScreen(){
  const setScreen=useAppStore(s=>s.setScreen)
  const [items,setItems]=useState<any[]>([])
  const [paper,setPaper]=useState<any[]>([])
  const [report,setReport]=useState<any|null>(null)
  const [error,setError]=useState('')
  const [paperError,setPaperError]=useState('')

  const load=async()=>{
    const [journalResult,paperResult,reportResult]=await Promise.allSettled([
      api<any[]>('/api/journal'),
      api<any[]>('/api/chart-trading/history'),
      api<any>('/api/chart-trading/report'),
    ])

    if(journalResult.status==='fulfilled'){
      setItems(journalResult.value)
      setError('')
    }else{
      const e=journalResult.reason
      setError(e instanceof Error?e.message:String(e))
    }

    if(paperResult.status==='fulfilled'){
      setPaper(paperResult.value)
      setPaperError('')
    }else{
      const e=paperResult.reason
      setPaperError(e instanceof Error?e.message:String(e))
    }

    if(reportResult.status==='fulfilled')setReport(reportResult.value)
  }

  useEffect(()=>{load()},[])

  const performance=useMemo(()=>{
    const ordered=[...paper].reverse()
    let running=0
    const curve=ordered.map(x=>{running+=Number(x.pnl_money??0);return running})
    const min=Math.min(0,...curve),max=Math.max(0,...curve),span=Math.max(1,max-min)
    const path=curve.map((v,i)=>{
      const x=curve.length===1?50:(i/(curve.length-1))*100
      const y=46-((v-min)/span)*42
      return `${i===0?'M':'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    }).join(' ')
    const automated=ordered.filter(x=>String(x.origin??'MANUAL').toUpperCase()==='AUTO')
    const automatedWins=automated.filter(x=>Number(x.pnl_points??0)>0).length
    const automationAccuracy=automated.length?(automatedWins/automated.length)*100:0
    return {totalMoney:ordered.reduce((a,x)=>a+Number(x.pnl_money??0),0),totalPoints:ordered.reduce((a,x)=>a+Number(x.pnl_points??0),0),path,automatedTrades:automated.length,automatedWins,automationAccuracy}
  },[paper])

  return <section className="content-screen">
    <div className="screen-title">
      <span>REVISÃO DE OPERAÇÕES</span>
      <h2>DIÁRIO DE OPERAÇÕES</h2>
    </div>

    <div className="journal-section-head">
      <div>
        <span>CHART TRADING</span>
        <h3>OPERAÇÕES SIMULADAS</h3>
      </div>
      <strong>{paper.length} ENCERRADAS</strong>
    </div>

    <div className="journal-performance-summary">
      <div><span>TOTAL DO DIA / SESSÃO</span><strong className={performance.totalMoney>=0?'positive':'negative'}>{performance.totalPoints>=0?'+':''}{num(performance.totalPoints)} pts</strong><small>{performance.totalMoney>=0?'+':''}{money(performance.totalMoney)}</small></div>
      <div><span>ASSERTIVIDADE AUTOMATIZADA</span><strong>{Math.max(0,Math.min(100,Number(performance.automationAccuracy??0))).toFixed(1)}%</strong><small>{performance.automatedWins} acertos / {performance.automatedTrades} operações AUTO</small></div>
      <div><span>ASSERTIVIDADE GERAL</span><strong>{Number(report?.win_rate??0).toFixed(1)}%</strong><small>{Number(report?.wins??0)} acertos / {Number(report?.trades??0)} operações</small></div>
      <div className="journal-capital"><span>CURVA DE CAPITAL</span><svg viewBox="0 0 100 50" preserveAspectRatio="none"><line x1="0" y1="46" x2="100" y2="46"/><path d={performance.path||'M 0 46 L 100 46'}/></svg></div>
    </div>

    {paperError&&<div className="status-banner error">
      <strong>NÃO FOI POSSÍVEL CARREGAR O CHART TRADING</strong>
      <span>{paperError}</span>
    </div>}

    <div className="table-shell journal-shell paper-journal-shell">
      <table>
        <thead>
          <tr>
            <th>ENTRADA</th><th>SAÍDA</th><th>ATIVO</th><th>LADO</th><th>QTD</th>
            <th>PREÇO ENTRADA</th><th>PREÇO SAÍDA</th><th>RESULTADO PTS</th>
            <th>RESULTADO R$</th><th>MFE</th><th>MAE</th><th>MOTIVO</th><th>FONTE</th>
          </tr>
        </thead>
        <tbody>
          {paper.map((x:any)=><tr key={x.trade_uid??x.id}>
            <td>{x.entry_ts??'—'}</td>
            <td>{x.exit_ts??'—'}</td>
            <td>{x.symbol??'—'}</td>
            <td className={x.side==='LONG'?'positive':'negative'}>{sideLabel(x.side)}</td>
            <td>{x.quantity??x.qty??'—'}</td>
            <td>{num(x.entry_price)}</td>
            <td>{num(x.exit_price)}</td>
            <td className={Number(x.pnl_points??0)>=0?'positive':'negative'}>{num(x.pnl_points)} pts</td>
            <td className={Number(x.pnl_money??0)>=0?'positive':'negative'}>{money(x.pnl_money)}</td>
            <td>{num(x.mfe_points??x.mfe)} pts</td>
            <td>{num(x.mae_points??x.mae)} pts</td>
            <td>{x.reason??'—'}</td>
            <td>{x.source??'—'}</td>
          </tr>)}
        </tbody>
      </table>

      {paper.length===0&&!paperError&&<EmptyState
        eyebrow="CHART TRADING PRONTO"
        title="NENHUMA OPERAÇÃO SIMULADA ENCERRADA"
        description="Compras, vendas, parciais, stops, alvos e zeragens do simulador aparecerão aqui com P&L, MFE, MAE, motivo e fonte do mercado."
        actionLabel="ABRIR COCKPIT"
        onAction={()=>setScreen('live')}
      />}
    </div>

    <div className="journal-section-head journal-strategy-head">
      <div>
        <span>MOTOR ORT</span>
        <h3>SINAIS / ESTRATÉGIA</h3>
      </div>
      <strong>{items.length} REGISTROS</strong>
    </div>

    {error&&<div className="status-banner error">
      <strong>NÃO FOI POSSÍVEL CARREGAR O DIÁRIO DA ESTRATÉGIA</strong>
      <span>{error}</span>
    </div>}

    <div className="table-shell journal-shell">
      <table>
        <thead>
          <tr>
            <th>HORÁRIO</th><th>ATIVO</th><th>LADO</th><th>SETUP</th>
            <th>SCORE</th><th>RESULTADO PTS</th><th>RESULTADO R$</th><th>VERSÃO</th>
          </tr>
        </thead>
        <tbody>
          {items.map(x=><tr key={x.id}>
            <td>{x.ts}</td>
            <td>{x.symbol}</td>
            <td className={x.side==='LONG'?'positive':'negative'}>{sideLabel(x.side)}</td>
            <td>{x.setup}</td>
            <td>{x.score??'—'}</td>
            <td>{x.pnl_points??'—'}</td>
            <td className={(x.pnl_money??0)>=0?'positive':'negative'}>{x.pnl_money??'—'}</td>
            <td>{x.strategy_version??'—'}</td>
          </tr>)}
        </tbody>
      </table>

      {items.length===0&&!error&&<EmptyState
        eyebrow="DIÁRIO DO MOTOR PRONTO"
        title="NENHUMA OPERAÇÃO REGISTRADA"
        description="Operações do motor aparecerão aqui com setup, score, resultado em pontos, resultado financeiro e versão da estratégia."
        actionLabel="ABRIR AUDITORIA DE REPLAY"
        onAction={()=>setScreen('audit')}
      />}
    </div>
  </section>
}
