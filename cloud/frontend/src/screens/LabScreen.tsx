import {useEffect,useMemo,useState} from 'react'
import {api} from '../api/client'
import {EChart} from '../components/EChart'
import {EmptyState} from '../components/EmptyState'
import {useAppStore} from '../store/appStore'
import type {EChartsOption} from 'echarts'

export function LabScreen(){
  const setScreen=useAppStore(s=>s.setScreen)
  const [report,setReport]=useState<any>(null)
  const [equity,setEquity]=useState<any[]>([])
  const [error,setError]=useState('')

  useEffect(()=>{
    Promise.all([
      api<any>('/api/lab/dashboard'),
      api<any[]>('/api/lab/equity'),
    ]).then(([r,e])=>{
      setReport(r)
      setEquity(e)
      setError('')
    }).catch(e=>{
      setError(e instanceof Error?e.message:String(e))
    })
  },[])

  const option=useMemo<EChartsOption>(()=>({
    grid:{left:62,right:24,top:26,bottom:42},
    xAxis:{
      type:'category',
      data:equity.map(x=>x.x),
      axisLabel:{show:false},
      axisLine:{lineStyle:{color:'rgba(255,255,255,.07)'}},
    },
    yAxis:{
      type:'value',
      axisLabel:{color:'#8aa096',fontSize:11},
      splitLine:{lineStyle:{color:'rgba(255,255,255,.04)'}},
    },
    series:[{
      type:'line',
      data:equity.map(x=>x.y),
      showSymbol:false,
      lineStyle:{color:'#00ff6a',width:2},
      areaStyle:{color:'rgba(0,255,106,.10)'}
    }]
  }),[equity])

  const baseline=report?.baseline??{}
  const oos=report?.walk_forward?.aggregate_oos??{}
  const noResults=report?.status==='NO_RESULTS'||!report

  return <section className="content-screen">
    <div className="screen-title">
      <span>VALIDAÇÃO QUANTITATIVA</span>
      <h2>LABORATÓRIO DE BACKTEST</h2>
    </div>

    {error&&
      <div className="status-banner error">
        <strong>LABORATÓRIO INDISPONÍVEL</strong>
        <span>{error}</span>
      </div>
    }

    <div className="metric-grid">
      {[
        ['RESULTADO LÍQUIDO',baseline.net_money],
        ['EXPECTATIVA',baseline.expectancy_money],
        ['FATOR DE LUCRO',baseline.profit_factor],
        ['TAXA DE ACERTO',(baseline.win_rate??0)*100],
        ['DRAWDOWN MÁX.',baseline.max_drawdown_money],
        ['RESULTADO FORA DA AMOSTRA',oos.net_money],
      ].map(([a,b])=><div className="metric" key={a}>
        <span>{a}</span>
        <strong>{Number(b??0).toLocaleString('pt-BR',{maximumFractionDigits:2})}</strong>
      </div>)}
    </div>

    <div className="lab-chart">
      {noResults
        ? <EmptyState
            eyebrow="SEM RESULTADOS"
            title="AINDA NÃO HÁ BACKTEST CARREGADO"
            description={report?.message??'O laboratório exibirá curva de capital, expectativa, fator de lucro, drawdown e resultado fora da amostra após uma execução válida.'}
            actionLabel="ABRIR AUDITORIA DE REPLAY"
            onAction={()=>setScreen('audit')}
          />
        : <EChart option={option}/>
      }
    </div>
  </section>
}
