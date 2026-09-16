import {useCallback,useEffect,useMemo,useRef,useState} from 'react'
import * as echarts from 'echarts'
import {EChart} from './EChart'
import {buildIndicatorData,INDICATOR_CATALOG,type IndicatorId} from './chartIndicators'
import {AtlasIcon,type IconName} from './AtlasIcon'

type Candle={
  ts:string
  open:number
  high:number
  low:number
  close:number
  volume?:number
  complete?:boolean
}

type PaperPosition={
  side:string
  quantity:number
  average_price:number|null
  open_pnl_points:number
  open_pnl_money:number
  stop_price:number|null
  target_price:number|null
  point_value?:number
}

export type SignalKind='TENDENCIA_COMPRA'|'TENDENCIA_VENDA'|'REVERSAO_COMPRA'|'REVERSAO_VENDA'|'AJUSTE_COMPRA'|'AJUSTE_VENDA'|'RETOMADA_COMPRA'|'RETOMADA_VENDA'
export type SignalMarker={
  ts:string
  price:number|null
  kind:SignalKind
  label:string
  stage?:'RESPONSIVE'|'CONFIRMED'|string
  score?:number
}

type Anchor={index:number;ts:string;price:number}
type Tool='select'|'hand'|'horizontal'|'hray'|'vertical'|'trend'|'ray'|'arrow'|'rectangle'|'ellipse'|'fib'|'measure'|'delete'
type Drawing={
  id:string
  type:Exclude<Tool,'select'|'hand'|'delete'>
  a:Anchor
  b?:Anchor
}
type ZoomRange={start:number;end:number}
type AtlasTheme='emerald'|'graphite'|'navy'
type ChartPrefs={
  theme:AtlasTheme
  background:string
  showGrid:boolean
  gridWidth:number
  candleLineWidth:number
  drawingWidth:number
  candleUp:string
  candleDown:string
  indicators:IndicatorId[]
}

type PriceScalePrefs={
  autoGrid:boolean
  gridColor:string
  gridWidth:number
  gridStyle:'solid'|'dashed'|'dotted'
  textColor:string
  textSize:number
  decimals:number
  scaleMode:'arithmetic'|'logarithmic'
  gridMode:'quantity'|'interval'|'reference'
  quantity:number
  interval:number
  referencePrice:number
  spacingAbove:number
  spacingBelow:number
}

const FIB_LEVELS=[0,.236,.382,.5,.618,.786,1]
const BASE_GRID={left:68,right:118,top:50,bottom:48}
const MIN_VISUAL_SLOTS=64
const DEFAULT_VISIBLE_CANDLES=72
const FUTURE_VISUAL_SLOTS=42
const SIGNAL_VISIBLE_CANDLES=6
const MIN_LEFT_PADDING_SLOTS=10
const MAX_PANES=6
const PREF_KEY='atlas_chart_preferences_v2128'
const PRICE_SCALE_KEY='atlas_price_scale_preferences_v21212'
const DEFAULT_PRICE_SCALE:PriceScalePrefs={autoGrid:true,gridColor:'#ffffff',gridWidth:.7,gridStyle:'solid',textColor:'#d7e7dd',textSize:10,decimals:0,scaleMode:'arithmetic',gridMode:'quantity',quantity:9,interval:50,referencePrice:0,spacingAbove:10,spacingBelow:10}


// V2.12.20 — cursores do gráfico. O ponteiro padrão do Windows é substituído
// por um ponteiro verde ATLAS dentro da área de plotagem.
const GREEN_POINTER_CURSOR='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2224%22 height=%2224%22 viewBox=%220 0 24 24%22%3E%3Cpath d=%22M3 2v17l5-5 4.2 8 3.1-1.7-4.2-7.7H19z%22 fill=%22%2338ff88%22 stroke=%22%23031209%22 stroke-width=%221.5%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E") 3 2, auto'
const GREEN_HAND_CURSOR='url("data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%2228%22 height=%2228%22 viewBox=%220 0 28 28%22%3E%3Cpath d=%22M8.5 13V7.2a2 2 0 0 1 4 0V12 5.7a2 2 0 0 1 4 0V12 7.2a2 2 0 0 1 4 0v5.4-3.1a2 2 0 0 1 4 0v7.2c0 5.1-3.8 8.3-8.9 8.3h-1.4c-3.1 0-5.4-1.3-7.2-3.8l-3.3-4.7a2.2 2.2 0 0 1 3.4-2.7z%22 fill=%22%2338ff88%22 stroke=%22%23031209%22 stroke-width=%221.4%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E") 10 8, grab'

const DEFAULT_PREFS:ChartPrefs={
  theme:'emerald',
  background:'#030908',
  showGrid:true,
  gridWidth:.7,
  candleLineWidth:.55,
  drawingWidth:1.4,
  candleUp:'#09d768',
  candleDown:'#ff3e55',
  indicators:['VWAP'],
}

// Compatibilidade documental com contratos de workspace das versões anteriores.
// Estes tokens NÃO controlam o runtime; o V2.12.20 usa AtlasIcon + zoom/pan customizados.
// zoomOnMouseWheel:true; zoomBy(.20)
// moveOnMouseMove:tool==='hand'; zoomBy(4)
// ['select','↖','SELECIONAR / MOVER OBJETOS']
// ['hand','✋','MÃO / MOVER GRÁFICO E RÉGUAS']
// ['horizontal','H','LINHA HORIZONTAL']
// ['hray','H→','RAIO HORIZONTAL']
// ['vertical','V','LINHA VERTICAL']
// ['trend','↗','SEGMENTO / LINHA DE TENDÊNCIA']
// ['ray','R→','RAIO DE TENDÊNCIA']
// ['arrow','➜','SETA']
// ['rectangle','▭','RETÂNGULO / ZONA']
// ['ellipse','◯','ELIPSE']
// ['fib','FIB','RETRAÇÃO DE FIBONACCI']
// ['measure','∆','RÉGUA / MEDIÇÃO']
// ['delete','⌫','APAGAR OBJETO']

const INDICATOR_COLORS:Record<string,string>={
  SMA9:'#f5cf4a',SMA20:'#7cc8ff',EMA9:'#ff9f43',EMA21:'#b98cff',VWAP:'#ff9f2f',
  BOLL20:'#69d4ff',ATR14:'#ffd166',RSI14:'#7ee787',MACD:'#6fb7ff',ADX14:'#f49d6e',
  MFI14:'#b59cff',STOCH:'#4fd1c5',
}

function clamp(v:number,min:number,max:number){return Math.max(min,Math.min(max,v))}
function niceStep(span:number,target:number){
  const rough=Math.max(span/Math.max(2,target),1e-9)
  const power=Math.pow(10,Math.floor(Math.log10(rough)))
  const fraction=rough/power
  const nice=fraction<=1?1:fraction<=2?2:fraction<=2.5?2.5:fraction<=5?5:10
  return nice*power
}
function readPriceScale():PriceScalePrefs{
  try{return {...DEFAULT_PRICE_SCALE,...JSON.parse(localStorage.getItem(PRICE_SCALE_KEY)??'{}')}}catch{return DEFAULT_PRICE_SCALE}
}
function fmtPrice(v:number|null|undefined){
  if(v==null||Number.isNaN(Number(v)))return '—'
  return Number(v).toLocaleString('pt-BR',{maximumFractionDigits:0})
}
function fmtMoney(v:number){
  const sign=v>0?'+':v<0?'−':''
  return `${sign}R$ ${Math.abs(v).toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})}`
}
function fmtTime(ts:string){
  if(!ts)return ''
  const time=ts.includes('T')?ts.split('T')[1]:ts.slice(11)
  return (time??'').slice(0,5)
}
function pointToSegmentDistance(px:number,py:number,x1:number,y1:number,x2:number,y2:number){
  const dx=x2-x1,dy=y2-y1
  if(dx===0&&dy===0)return Math.hypot(px-x1,py-y1)
  const t=clamp(((px-x1)*dx+(py-y1)*dy)/(dx*dx+dy*dy),0,1)
  return Math.hypot(px-(x1+t*dx),py-(y1+t*dy))
}
function zrEventPixel(event:any):[number,number]|null{
  const native=event?.event??event
  const x=Number(event?.offsetX??native?.offsetX??event?.zrX??native?.zrX)
  const y=Number(event?.offsetY??native?.offsetY??event?.zrY??native?.zrY)
  return Number.isFinite(x)&&Number.isFinite(y)?[x,y]:null
}
function zrShiftKey(event:any){const native=event?.event??event;return Boolean(native?.shiftKey??event?.shiftKey)}
function sanitizeIndicators(value:any):IndicatorId[]{
  const valid=new Set(INDICATOR_CATALOG.map(x=>x.id))
  const source=Array.isArray(value)?value:DEFAULT_PREFS.indicators
  const unique=Array.from(new Set(source.filter((x:any)=>valid.has(x)))) as IndicatorId[]
  const out:IndicatorId[]=[]
  let panes=0
  for(const id of unique){
    const kind=INDICATOR_CATALOG.find(x=>x.id===id)?.kind
    if(kind==='pane'){
      if(panes>=MAX_PANES)continue
      panes+=1
    }
    out.push(id)
  }
  return out.length?out:DEFAULT_PREFS.indicators
}
function readPrefs():ChartPrefs{
  try{
    const raw=localStorage.getItem(PREF_KEY)
    if(!raw)return DEFAULT_PREFS
    const parsed=JSON.parse(raw)
    return {...DEFAULT_PREFS,...parsed,indicators:sanitizeIndicators(parsed?.indicators)}
  }catch{return DEFAULT_PREFS}
}

export function ProfessionalMarketChart({
  candles,symbol,timeframe,lastPrice,bid,ask,feedSource,paperPosition,signalMarkers=[],activeSignal=null,marketAtr=null,onProtectionChange,
}:{
  candles:Candle[]
  symbol:string
  timeframe:string
  lastPrice:number|null
  bid:number|null
  ask:number|null
  feedSource:string
  paperPosition?:PaperPosition|null
  signalMarkers?:SignalMarker[]
  activeSignal?:any|null
  marketAtr?:number|null
  onProtectionChange?:(stopPrice:number|null,targetPrice:number|null)=>void|Promise<void>
}){
  const chartRef=useRef<echarts.ECharts|null>(null)
  const [tool,setTool]=useState<Tool>('select')
  const [drawings,setDrawings]=useState<Drawing[]>([])
  const [pending,setPending]=useState<Anchor|null>(null)
  const [hoverAnchor,setHoverAnchor]=useState<Anchor|null>(null)
  const [zoomRange,setZoomRange]=useState<ZoomRange|null>(null)
  const [positionY,setPositionY]=useState<number|null>(null)
  const [selectedDrawingId,setSelectedDrawingId]=useState<string|null>(null)
  const [manualY,setManualY]=useState<{min:number;max:number}|null>(null)
  const [protectionPreview,setProtectionPreview]=useState<{kind:'stop'|'target';price:number}|null>(null)
  const [prefs,setPrefs]=useState<ChartPrefs>(readPrefs)
  const [settingsOpen,setSettingsOpen]=useState(false)
  const [priceScaleOpen,setPriceScaleOpen]=useState(false)
  const [priceScale,setPriceScale]=useState<PriceScalePrefs>(readPriceScale)
  const [dragIndicator,setDragIndicator]=useState<IndicatorId|null>(null)

  const axisDragRef=useRef<{startY:number;min:number;max:number;shift:boolean}|null>(null)
  const timeAxisDragRef=useRef<{startX:number;range:ZoomRange}|null>(null)
  const freePanDragRef=useRef<{startX:number;startY:number;range:ZoomRange;y:{min:number;max:number}}|null>(null)
  const protectionDragRef=useRef<'stop'|'target'|null>(null)
  const drawingDragRef=useRef<{id:string;start:Anchor;original:Drawing}|null>(null)
  const toolRef=useRef<Tool>('select')
  const ctrlPreviousToolRef=useRef<Tool|null>(null)
  const chartPointerInsideRef=useRef(false)

  useEffect(()=>{toolRef.current=tool},[tool])

  useEffect(()=>{
    localStorage.setItem(PREF_KEY,JSON.stringify(prefs))
    document.documentElement.dataset.atlasTheme=prefs.theme
  },[prefs])
  useEffect(()=>{localStorage.setItem(PRICE_SCALE_KEY,JSON.stringify(priceScale))},[priceScale])

  const overlayIndicators=prefs.indicators.filter(id=>INDICATOR_CATALOG.find(x=>x.id===id)?.kind==='overlay')
  const paneIndicators=prefs.indicators.filter(id=>INDICATOR_CATALOG.find(x=>x.id===id)?.kind==='pane').slice(0,MAX_PANES)
  const paneCount=paneIndicators.length
  // Até seis osciladores podem ficar ativos simultaneamente. Acima de quatro,
  // os painéis ficam um pouco mais compactos para preservar área útil do preço.
  const paneHeightPct=paneCount<=4?11:7.5
  const mainBottomPct=8+paneCount*paneHeightPct

  const padCount=Math.max(MIN_LEFT_PADDING_SLOTS,MIN_VISUAL_SLOTS-candles.length)
  const chartCategories=useMemo(()=>[
    ...Array.from({length:padCount},(_,i)=>`__pad_${i}`),
    ...candles.map(c=>c.ts),
    ...Array.from({length:FUTURE_VISUAL_SLOTS},(_,i)=>`__future_${i}`),
  ],[candles,padCount])
  const displayLength=chartCategories.length
  const latest=candles[candles.length-1]
  const previous=candles.length>1?candles[candles.length-2]:null
  const changePct=latest&&previous&&previous.close?((latest.close-previous.close)/previous.close)*100:latest&&latest.open?((latest.close-latest.open)/latest.open)*100:0

  const indicatorData=useMemo(()=>buildIndicatorData(candles),[candles])
  const vwapSeries=indicatorData.VWAP.main
  const padSeries=useCallback((values:(number|null)[])=>[
    ...Array.from({length:padCount},()=>null),...values,...Array.from({length:FUTURE_VISUAL_SLOTS},()=>null),
  ],[padCount])

  const initialStart=useMemo(()=>{
    const defaultSlots=DEFAULT_VISIBLE_CANDLES+FUTURE_VISUAL_SLOTS
    if(displayLength<=defaultSlots)return 0
    return ((displayLength-defaultSlots)/Math.max(displayLength-1,1))*100
  },[displayLength])

  const displayCandleData=useMemo(()=>[
    ...Array.from({length:padCount},()=>'-' as any),
    ...candles.map(c=>[c.open,c.close,c.low,c.high]),
    ...Array.from({length:FUTURE_VISUAL_SLOTS},()=>'-' as any),
  ],[candles,padCount])

  const sessionDividers=useMemo(()=>{
    const out:{xAxis:string;label:any;lineStyle:any}[]=[]
    let previousDay=''
    candles.forEach(c=>{
      const day=String(c.ts).slice(0,10)
      if(day&&day!==previousDay){
        const [y,m,d]=day.split('-')
        out.push({
          xAxis:c.ts,
          label:{show:true,position:'insideStartBottom',formatter:`${d}/${m}`,color:'#7b9587',fontSize:8,padding:[0,0,3,3]},
          lineStyle:{color:'rgba(115,155,133,.30)',width:1,type:'solid'},
        })
        previousDay=day
      }
    })
    return out
  },[candles])

  const autoYRange=useMemo(()=>{
    if(candles.length===0)return null
    const zr=zoomRange??{start:initialStart,end:100}
    const denom=Math.max(displayLength-1,1)
    const displayStart=Math.floor((zr.start/100)*denom)
    const displayEnd=Math.ceil((zr.end/100)*denom)
    const rawStart=clamp(displayStart-padCount,0,Math.max(candles.length-1,0))
    const rawEnd=clamp(displayEnd-padCount,0,Math.max(candles.length-1,0))
    const sample=candles.slice(Math.min(rawStart,rawEnd),Math.max(rawStart,rawEnd)+1)
    const used=sample.length?sample:candles.slice(-DEFAULT_VISIBLE_CANDLES)
    const lows=used.map(c=>Number(c.low)).filter(Number.isFinite)
    const highs=used.map(c=>Number(c.high)).filter(Number.isFinite)
    if(lastPrice!=null){lows.push(Number(lastPrice));highs.push(Number(lastPrice))}
    if(paperPosition?.average_price!=null){lows.push(Number(paperPosition.average_price));highs.push(Number(paperPosition.average_price))}
    if(paperPosition?.stop_price!=null){lows.push(Number(paperPosition.stop_price));highs.push(Number(paperPosition.stop_price))}
    if(paperPosition?.target_price!=null){lows.push(Number(paperPosition.target_price));highs.push(Number(paperPosition.target_price))}
    if(!lows.length||!highs.length)return null
    const low=Math.min(...lows),high=Math.max(...highs)
    const span=Math.max(high-low,Number(marketAtr??0)*1.5,20)
    const below=Math.max(span*(priceScale.spacingBelow/100),5)
    const above=Math.max(span*(priceScale.spacingAbove/100),5)
    return {min:low-below,max:high+above}
  },[candles,displayLength,initialStart,lastPrice,marketAtr,padCount,paperPosition?.average_price,paperPosition?.stop_price,paperPosition?.target_price,zoomRange,priceScale.spacingAbove,priceScale.spacingBelow])
  const effectiveYRange=manualY??autoYRange
  const priceInterval=useMemo(()=>{
    if(!effectiveYRange||priceScale.scaleMode==='logarithmic')return undefined
    const span=Math.max(effectiveYRange.max-effectiveYRange.min,1e-9)
    if(!priceScale.autoGrid&&priceScale.gridMode==='interval')return Math.max(Number(priceScale.interval)||1,1e-9)
    return niceStep(span,Math.max(3,Math.min(16,Number(priceScale.quantity)||9)))
  },[effectiveYRange,priceScale])
  const resolvedYRange=useMemo(()=>{
    if(!effectiveYRange||priceScale.scaleMode==='logarithmic')return effectiveYRange
    const step=priceInterval||niceStep(effectiveYRange.max-effectiveYRange.min,9)
    const base=priceScale.gridMode==='reference'&&Number(priceScale.referencePrice)>0?Number(priceScale.referencePrice):0
    return {min:base+Math.floor((effectiveYRange.min-base)/step)*step,max:base+Math.ceil((effectiveYRange.max-base)/step)*step}
  },[effectiveYRange,priceInterval,priceScale.scaleMode,priceScale.gridMode,priceScale.referencePrice])

  const protectionGuides=useMemo(()=>{
    if(!paperPosition||paperPosition.side==='FLAT'||paperPosition.average_price==null)return null
    const avg=Number(paperPosition.average_price)
    const visibleSpan=effectiveYRange?Math.max(effectiveYRange.max-effectiveYRange.min,1):200
    const baseOffset=Math.max(Number(marketAtr??0),visibleSpan*.12,symbol.toUpperCase().startsWith('WIN')?100:visibleSpan*.08)
    const long=paperPosition.side==='LONG'
    const suggestedStop=long?avg-baseOffset:avg+baseOffset
    const suggestedTarget=long?avg+baseOffset:avg-baseOffset
    return {
      stop:Number(protectionPreview?.kind==='stop'?protectionPreview.price:(paperPosition.stop_price??suggestedStop)),
      target:Number(protectionPreview?.kind==='target'?protectionPreview.price:(paperPosition.target_price??suggestedTarget)),
      stopActive:paperPosition.stop_price!=null,
      targetActive:paperPosition.target_price!=null,
    }
  },[effectiveYRange,marketAtr,paperPosition,protectionPreview,symbol])

  const indicatorSeries=useMemo(()=>{
    const series:any[]=[]
    const addLine=(id:string,name:string,data:(number|null)[],color:string,width=1.25,xAxisIndex=0,yAxisIndex=0)=>series.push({
      id,name,type:'line',data:padSeries(data),symbol:'none',smooth:false,connectNulls:false,xAxisIndex,yAxisIndex,
      lineStyle:{color,width,opacity:.92},emphasis:{disabled:true},tooltip:{show:false},z:yAxisIndex===0?6:2,
    })

    for(const id of overlayIndicators){
      const color=INDICATOR_COLORS[id]??'#c8d6cf'
      if(id==='SMA9')addLine('ind-SMA9','SMA 9',indicatorData.SMA9.main,color)
      if(id==='SMA20')addLine('ind-SMA20','SMA 20',indicatorData.SMA20.main,color)
      if(id==='EMA9')addLine('ind-EMA9','EMA 9',indicatorData.EMA9.main,color)
      if(id==='EMA21')addLine('ind-EMA21','EMA 21',indicatorData.EMA21.main,color)
      if(id==='VWAP')addLine('ind-VWAP','VWAP',indicatorData.VWAP.main,color,1.4)
      if(id==='BOLL20'){
        addLine('ind-BOLL20-UP','BOLL SUP',indicatorData.BOLL20.upper,color,1)
        addLine('ind-BOLL20-MID','BOLL 20',indicatorData.BOLL20.mid,color,.9)
        addLine('ind-BOLL20-LOW','BOLL INF',indicatorData.BOLL20.lower,color,1)
      }
    }

    paneIndicators.forEach((id,paneIdx)=>{
      const axis=paneIdx+1
      const color=INDICATOR_COLORS[id]??'#c8d6cf'
      if(id==='ATR14')addLine(`ind-${id}`,'ATR 14',indicatorData.ATR14.main,color,1.2,axis,axis)
      if(id==='RSI14')addLine(`ind-${id}`,'RSI 14',indicatorData.RSI14.main,color,1.2,axis,axis)
      if(id==='ADX14')addLine(`ind-${id}`,'ADX 14',indicatorData.ADX14.main,color,1.2,axis,axis)
      if(id==='MFI14')addLine(`ind-${id}`,'MFI 14',indicatorData.MFI14.main,color,1.2,axis,axis)
      if(id==='STOCH'){
        addLine(`ind-${id}-K`,'STOCH %K',indicatorData.STOCH.k,color,1.2,axis,axis)
        addLine(`ind-${id}-D`,'STOCH %D',indicatorData.STOCH.d,'#f5cf4a',1,axis,axis)
      }
      if(id==='MACD'){
        addLine(`ind-${id}-LINE`,'MACD',indicatorData.MACD.line,color,1.2,axis,axis)
        addLine(`ind-${id}-SIGNAL`,'SINAL',indicatorData.MACD.signal,'#f5cf4a',1,axis,axis)
        series.push({id:`ind-${id}-HIST`,name:'HIST',type:'bar',data:padSeries(indicatorData.MACD.hist),xAxisIndex:axis,yAxisIndex:axis,barMaxWidth:5,itemStyle:{color:'rgba(126,231,135,.45)'},z:1})
      }
    })
    return series
  },[indicatorData,overlayIndicators,padSeries,paneIndicators])

  const grids=useMemo<any[]>(()=>{
    const out:any[]=[{left:BASE_GRID.left,right:BASE_GRID.right,top:BASE_GRID.top,bottom:`${mainBottomPct}%`,containLabel:false}]
    paneIndicators.forEach((_,i)=>{
      const top=100-mainBottomPct+i*paneHeightPct+1
      out.push({left:BASE_GRID.left,right:BASE_GRID.right,top:`${top}%`,height:`${paneHeightPct-2}%`,containLabel:false})
    })
    return out
  },[mainBottomPct,paneHeightPct,paneIndicators])

  const xAxes=useMemo<any[]>(()=>{
    const axes:any[]=[{
      type:'category',gridIndex:0,data:chartCategories,boundaryGap:true,
      axisLabel:{show:paneCount===0,color:'#8aa093',fontSize:10,margin:12,hideOverlap:true,formatter:(value:string)=>(value.startsWith('__pad_')||value.startsWith('__future_'))?'':fmtTime(value)},
      axisTick:{show:false},axisLine:{show:false},splitLine:{show:false},
      axisPointer:{show:true,snap:true,label:{formatter:(p:any)=>{const value=String(p?.value??'');return value.startsWith('__pad_')||value.startsWith('__future_')?'':fmtTime(value)}}},
    }]
    paneIndicators.forEach((_,i)=>axes.push({
      type:'category',gridIndex:i+1,data:chartCategories,boundaryGap:true,
      axisLabel:{show:i===paneIndicators.length-1,color:'#7f9287',fontSize:9,margin:8,hideOverlap:true,formatter:(value:string)=>(value.startsWith('__pad_')||value.startsWith('__future_'))?'':fmtTime(value)},
      axisTick:{show:false},axisLine:{show:i===paneIndicators.length-1,lineStyle:{color:'rgba(255,255,255,.09)'}},splitLine:{show:false},axisPointer:{show:false},
    }))
    return axes
  },[chartCategories,paneCount,paneIndicators])

  const yAxes=useMemo<any[]>(()=>{
    const axes:any[]=[{
      type:priceScale.scaleMode==='logarithmic'?'log':'value',gridIndex:0,position:'right',scale:true,min:resolvedYRange?.min,max:resolvedYRange?.max,
      splitNumber:Math.max(3,Math.min(16,Number(priceScale.quantity)||9)),interval:priceScale.scaleMode==='arithmetic'?priceInterval:undefined,
      axisLabel:{color:priceScale.textColor,fontSize:priceScale.textSize,margin:10,formatter:(value:number)=>Number(value).toLocaleString('pt-BR',{minimumFractionDigits:priceScale.decimals,maximumFractionDigits:priceScale.decimals})},axisTick:{show:false},
      axisLine:{show:false},
      splitLine:{show:prefs.showGrid,lineStyle:{color:priceScale.gridColor==='auto'?'rgba(255,255,255,.065)':priceScale.gridColor,width:priceScale.gridWidth,type:priceScale.gridStyle}},axisPointer:{show:true,snap:false},
    }]
    paneIndicators.forEach((id,i)=>{
      const bounded=['RSI14','ADX14','MFI14','STOCH'].includes(id)
      // Cada oscilador precisa usar o MESMO grid do respectivo xAxis.
      // Sem gridIndex, o ECharts associa o yAxis ao grid principal (0) e uma
      // serie como RSI (xAxisIndex=1/yAxisIndex=1) pode lançar
      // "xAxis and yAxis must use the same grid", derrubando a renderizacao.
      axes.push({type:'value',gridIndex:i+1,position:'right',scale:!bounded,min:bounded?0:undefined,max:bounded?100:undefined,splitNumber:3,
        axisLabel:{color:'#71857a',fontSize:8,margin:8},axisTick:{show:false},axisLine:{show:true,lineStyle:{color:'rgba(255,255,255,.07)'}},
        splitLine:{show:prefs.showGrid,lineStyle:{color:'rgba(255,255,255,.04)',width:Math.max(.5,prefs.gridWidth*.7)}},axisPointer:{show:false}})
    })
    return axes
  },[paneIndicators,prefs.gridWidth,prefs.showGrid,priceScale,resolvedYRange,priceInterval])

  const option=useMemo<echarts.EChartsOption>(()=>({
    animation:true,animationDurationUpdate:80,animationEasingUpdate:'linear',backgroundColor:prefs.background,
    grid:grids,tooltip:{trigger:'axis',axisPointer:{type:'cross',snap:true},backgroundColor:'rgba(1,8,4,.96)',borderColor:'rgba(120,180,150,.28)',textStyle:{color:'#eafff0',fontSize:11},
      formatter:(params:any)=>{const list=Array.isArray(params)?params:[params];const cp=list.find((x:any)=>x.seriesType==='candlestick');if(!cp)return '';const idx=Number(cp.dataIndex)-padCount;const c=idx>=0?candles[idx]:null;if(!c)return '';return [`<b>${symbol} · ${timeframe}</b>`,`${c.ts.replace('T',' ')}`,`O ${fmtPrice(c.open)}  H ${fmtPrice(c.high)}`,`L ${fmtPrice(c.low)}  C ${fmtPrice(c.close)}`,`VOL ${Number(c.volume??0).toLocaleString('pt-BR')}`].join('<br/>')}},
    axisPointer:{link:[{xAxisIndex:'all'}],label:{backgroundColor:'#0b1a12',color:'#dfffea'},lineStyle:{color:'rgba(215,255,229,.42)',type:'dashed',width:1}},
    xAxis:xAxes,yAxis:yAxes,
    dataZoom:[{id:'marketZoom',type:'inside',xAxisIndex:Array.from({length:paneCount+1},(_,i)=>i),filterMode:'filter',zoomOnMouseWheel:false,moveOnMouseMove:false,moveOnMouseWheel:false,preventDefaultMouseMove:true,start:zoomRange?.start??initialStart,end:zoomRange?.end??100,minValueSpan:.08,throttle:20}],
    series:[{
      id:'price-candles',name:'PREÇO',type:'candlestick',data:displayCandleData,xAxisIndex:0,yAxisIndex:0,barMinWidth:1,barMaxWidth:18,
      itemStyle:{color:prefs.candleUp,color0:prefs.candleDown,borderColor:prefs.candleUp,borderColor0:prefs.candleDown,borderWidth:prefs.candleLineWidth},
      emphasis:{itemStyle:{borderWidth:Math.max(.6,prefs.candleLineWidth)}},
      markLine:lastPrice!=null?{silent:true,symbol:'none',animation:false,label:{show:true,position:'end',formatter:fmtPrice(lastPrice),color:'#001707',backgroundColor:prefs.candleUp,padding:[3,6],fontWeight:'bold',fontSize:10},lineStyle:{color:prefs.candleUp,type:'dashed',width:1,opacity:.70},data:[{yAxis:Number(lastPrice)}]}:undefined,z:4,
    },{
      id:'session-dividers',name:'SESSÕES',type:'line',data:[],xAxisIndex:0,yAxisIndex:0,silent:true,symbol:'none',tooltip:{show:false},
      markLine:{silent:true,symbol:'none',animation:false,data:sessionDividers,label:{show:true},lineStyle:{color:'rgba(115,155,133,.28)',width:1}},z:1,
    },...indicatorSeries],
  }),[candles,displayCandleData,grids,indicatorSeries,initialStart,lastPrice,padCount,paneCount,prefs.background,prefs.candleDown,prefs.candleLineWidth,prefs.candleUp,sessionDividers,symbol,timeframe,tool,xAxes,yAxes,zoomRange])

  const mainBounds=useCallback((chart:echarts.ECharts)=>{
    const width=chart.getWidth(),height=chart.getHeight()
    const xLeft=BASE_GRID.left,xRight=Math.max(xLeft+10,width-BASE_GRID.right)
    const yTop=BASE_GRID.top,yBottom=Math.max(yTop+10,height*(1-mainBottomPct/100))
    return {width,height,xLeft,xRight,yTop,yBottom}
  },[mainBottomPct])

  const anchorToPixel=useCallback((anchor:Anchor)=>{
    const chart=chartRef.current;if(!chart)return null
    const category=chartCategories[anchor.index+padCount];if(category==null)return null
    const result=chart.convertToPixel({xAxisIndex:0,yAxisIndex:0},[category,anchor.price]) as number[]
    if(!Array.isArray(result)||result.length<2)return null
    return [Number(result[0]),Number(result[1])] as const
  },[chartCategories,padCount])

  const potentialOutcome=useCallback((price:number)=>{
    if(!paperPosition||paperPosition.side==='FLAT'||paperPosition.average_price==null)return {points:0,money:0}
    const dir=paperPosition.side==='LONG'?1:-1
    const qty=Math.max(1,Number(paperPosition.quantity??1))
    const points=(price-Number(paperPosition.average_price))*dir*qty
    const pointValue=Number(paperPosition.point_value??.20)
    return {points,money:points*pointValue}
  },[paperPosition])

  const redrawDrawings=useCallback(()=>{
    const chart=chartRef.current;if(!chart)return
    const {xLeft,xRight,yTop,yBottom}=mainBounds(chart)
    const elements:any[]=[]

    for(const d of drawings){
      const a=anchorToPixel(d.a),b=d.b?anchorToPixel(d.b):null
      if(!a)continue
      const selected=d.id===selectedDrawingId
      const tone=selected?'#ffffff':'#69f3a0'
      const lw=prefs.drawingWidth+(selected ? .45 : 0)
      const base={silent:true,z:selected?24:20}

      if(d.type==='horizontal'||d.type==='hray'){
        elements.push({...base,id:`${d.id}-line`,type:'line',shape:{x1:d.type==='hray'?a[0]:xLeft,y1:a[1],x2:xRight,y2:a[1]},style:{stroke:tone,lineWidth:lw,lineDash:[6,4],opacity:.92}})
        elements.push({...base,id:`${d.id}-text`,type:'text',style:{x:xRight-4,y:a[1]-15,text:fmtPrice(d.a.price),fill:tone,font:'10px monospace',textAlign:'right'}})
      }
      if(d.type==='vertical')elements.push({...base,id:`${d.id}-line`,type:'line',shape:{x1:a[0],y1:yTop,x2:a[0],y2:yBottom},style:{stroke:tone,lineWidth:lw,lineDash:[5,5],opacity:.8}})
      if((d.type==='trend'||d.type==='arrow'||d.type==='ray'||d.type==='measure')&&b){
        let x2=b[0],y2=b[1]
        if(d.type==='ray'){
          const dx=b[0]-a[0],dy=b[1]-a[1]
          if(Math.abs(dx)>1){const t=(xRight-a[0])/dx;x2=xRight;y2=a[1]+dy*t}
        }
        elements.push({...base,id:`${d.id}-line`,type:'line',shape:{x1:a[0],y1:a[1],x2,y2},style:{stroke:tone,lineWidth:lw}})
        if(d.type==='arrow'){
          const ang=Math.atan2(b[1]-a[1],b[0]-a[0]),size=9
          const p1=[b[0]-size*Math.cos(ang-.45),b[1]-size*Math.sin(ang-.45)]
          const p2=[b[0]-size*Math.cos(ang+.45),b[1]-size*Math.sin(ang+.45)]
          elements.push({...base,id:`${d.id}-head`,type:'polygon',shape:{points:[[b[0],b[1]],p1,p2]},style:{fill:tone,stroke:tone}})
        }
        if(d.type==='measure'){
          const delta=d.b!.price-d.a.price,pct=d.a.price?delta/d.a.price*100:0,bars=Math.abs(d.b!.index-d.a.index)
          elements.push({...base,id:`${d.id}-measure`,type:'text',style:{x:(a[0]+b[0])/2,y:(a[1]+b[1])/2-18,text:`${delta>=0?'+':''}${delta.toFixed(0)} pts · ${pct>=0?'+':''}${pct.toFixed(2)}% · ${bars} candles`,fill:'#f4d06f',font:'bold 10px monospace',backgroundColor:'rgba(3,9,8,.88)',padding:[4,6],textAlign:'center'}})
        }
      }
      if((d.type==='rectangle'||d.type==='ellipse')&&b){
        const x=Math.min(a[0],b[0]),y=Math.min(a[1],b[1]),w=Math.abs(b[0]-a[0]),h=Math.abs(b[1]-a[1])
        if(d.type==='rectangle')elements.push({...base,id:`${d.id}-rect`,type:'rect',shape:{x,y,width:w,height:h,r:2},style:{stroke:tone,fill:'rgba(0,255,106,.045)',lineWidth:lw}})
        else elements.push({...base,id:`${d.id}-ellipse`,type:'ellipse',shape:{cx:x+w/2,cy:y+h/2,rx:w/2,ry:h/2},style:{stroke:tone,fill:'rgba(0,255,106,.035)',lineWidth:lw}})
      }
      if(d.type==='fib'&&b){
        const x1=Math.min(a[0],b[0]),x2=Math.max(a[0],b[0])
        FIB_LEVELS.forEach((level,idx)=>{
          const price=d.a.price+(d.b!.price-d.a.price)*level
          const y=(anchorToPixel({...d.a,price})??a)[1]
          elements.push({...base,id:`${d.id}-fib-${idx}`,type:'line',shape:{x1,y1:y,x2,y2:y},style:{stroke:selected?'#fff':'#ffad45',lineWidth:(level===.5||level===.618?lw+.2:lw*.8),opacity:.88,lineDash:idx===0||idx===FIB_LEVELS.length-1?undefined:[5,4]}})
          elements.push({...base,id:`${d.id}-fib-label-${idx}`,type:'text',style:{x:x2+5,y:y-12,text:`${(level*100).toFixed(level===0||level===1?0:1)}%  ${fmtPrice(price)}`,fill:selected?'#fff':'#ffc168',font:'9px monospace'}})
        })
      }
      if(selected){
        elements.push({silent:true,z:26,id:`${d.id}-ha`,type:'circle',shape:{cx:a[0],cy:a[1],r:4},style:{fill:'#fff',stroke:'#0b1a12',lineWidth:1}})
        if(b)elements.push({silent:true,z:26,id:`${d.id}-hb`,type:'circle',shape:{cx:b[0],cy:b[1],r:4},style:{fill:'#fff',stroke:'#0b1a12',lineWidth:1}})
      }
    }

    if(pending&&hoverAnchor&&!['select','hand','horizontal','hray','vertical','delete'].includes(tool)){
      const a=anchorToPixel(pending),b=anchorToPixel(hoverAnchor)
      if(a&&b){
        const base={silent:true,z:19},stroke='#a7ffca'
        if(['trend','ray','arrow','measure'].includes(tool))elements.push({...base,id:'drawing-preview-line',type:'line',shape:{x1:a[0],y1:a[1],x2:b[0],y2:b[1]},style:{stroke,lineWidth:1.2,lineDash:[5,4],opacity:.72}})
        if(tool==='rectangle')elements.push({...base,id:'drawing-preview-rect',type:'rect',shape:{x:Math.min(a[0],b[0]),y:Math.min(a[1],b[1]),width:Math.abs(b[0]-a[0]),height:Math.abs(b[1]-a[1])},style:{stroke,fill:'rgba(0,255,106,.025)',lineWidth:1,lineDash:[5,4],opacity:.72}})
        if(tool==='ellipse')elements.push({...base,id:'drawing-preview-ellipse',type:'ellipse',shape:{cx:(a[0]+b[0])/2,cy:(a[1]+b[1])/2,rx:Math.abs(b[0]-a[0])/2,ry:Math.abs(b[1]-a[1])/2},style:{stroke,fill:'rgba(0,255,106,.02)',lineWidth:1,lineDash:[5,4],opacity:.72}})
        if(tool==='fib')FIB_LEVELS.forEach((level,idx)=>{const price=pending.price+(hoverAnchor.price-pending.price)*level;const y=(anchorToPixel({...pending,price})??a)[1];elements.push({...base,id:`drawing-preview-fib-${idx}`,type:'line',shape:{x1:Math.min(a[0],b[0]),y1:y,x2:Math.max(a[0],b[0]),y2:y},style:{stroke:'#ffb75c',lineWidth:1,lineDash:[4,4],opacity:.55}})})
      }
    }

    if(paperPosition&&paperPosition.side!=='FLAT'&&paperPosition.average_price!=null&&candles.length>0){
      const avg=Number(paperPosition.average_price)
      const avgPoint=anchorToPixel({index:candles.length-1,ts:candles[candles.length-1].ts,price:avg})
      if(avgPoint){
        const sideTone=paperPosition.side==='LONG'?'#00ff6a':'#ff5b70'
        elements.push({silent:true,z:26,id:'paper-position-line',type:'line',shape:{x1:xLeft,y1:avgPoint[1],x2:xRight,y2:avgPoint[1]},style:{stroke:sideTone,lineWidth:1.3,opacity:.88}})
        elements.push({silent:true,z:27,id:'paper-position-price-bg',type:'rect',shape:{x:xRight-92,y:avgPoint[1]-12,width:88,height:24,r:8},style:{fill:'rgba(1,10,5,.96)',stroke:sideTone,lineWidth:1,shadowBlur:8,shadowColor:sideTone}})
        elements.push({silent:true,z:28,id:'paper-position-price-text',type:'text',style:{x:xRight-48,y:avgPoint[1],text:`${paperPosition.side==='LONG'?'C':'V'} ${fmtPrice(avg)}`,fill:sideTone,font:'bold 10px monospace',textAlign:'center',textVerticalAlign:'middle'}})
        if(positionY==null||Math.abs(positionY-avgPoint[1])>.5)setPositionY(avgPoint[1])

        const protection=(price:number,label:'STOP'|'ALVO',tone:string,active:boolean)=>{
          const pt=anchorToPixel({index:candles.length-1,ts:candles[candles.length-1].ts,price});if(!pt)return
          const dragging=(label==='STOP'&&protectionPreview?.kind==='stop')||(label==='ALVO'&&protectionPreview?.kind==='target')
          const outcome=potentialOutcome(price)
          const pointsText=`${outcome.points>=0?'+':'−'}${Math.abs(outcome.points).toFixed(0)} pts`
          const moneyText=fmtMoney(outcome.money)
          elements.push({silent:true,z:24,id:`paper-${label}-line`,type:'line',shape:{x1:xLeft,y1:pt[1],x2:xRight-2,y2:pt[1]},style:{stroke:tone,lineWidth:dragging?2:1.3,lineDash:active?undefined:[7,4],opacity:active ? .90 : .48,shadowBlur:dragging?9:0,shadowColor:tone}})
          elements.push({silent:true,z:25,id:`paper-${label}-handle`,type:'rect',shape:{x:xRight-176,y:pt[1]-13,width:170,height:26,r:9},style:{fill:'rgba(2,10,6,.96)',stroke:tone,lineWidth:1,opacity:active?1:.80}})
          elements.push({silent:true,z:26,id:`paper-${label}-text`,type:'text',style:{x:xRight-91,y:pt[1],text:`${label}  ${moneyText} · ${pointsText}`,fill:tone,font:'bold 9px monospace',textAlign:'center',textVerticalAlign:'middle'}})
        }
        if(protectionGuides){protection(protectionGuides.stop,'STOP','#ff3f58',protectionGuides.stopActive);protection(protectionGuides.target,'ALVO','#00e86a',protectionGuides.targetActive)}
      }
    }else if(positionY!==null)setPositionY(null)

    const latestSignalIndex=Math.max(candles.length-1,0)
    for(const [signalIndex,signal] of signalMarkers.slice(-100).entries()){
      if(!candles.length)break
      let idx=candles.findIndex(c=>c.ts===signal.ts)
      if(idx<0){
        const wanted=Date.parse(signal.ts)
        if(Number.isFinite(wanted)){
          let best=Infinity
          candles.forEach((c,i)=>{const diff=Math.abs(Date.parse(c.ts)-wanted);if(diff<best){best=diff;idx=i}})
        }
      }
      if(idx<0)continue
      // Sinais expiram visualmente para manter o gráfico limpo. A auditoria
      // completa continua no histórico/Diário, não no canvas principal.
      const age=Math.max(0,latestSignalIndex-idx)
      if(age>SIGNAL_VISIBLE_CANDLES)continue
      const buyer=signal.kind.endsWith('COMPRA')
      const responsive=signal.stage==='RESPONSIVE'
      const candle=candles[idx]
      const basePrice=buyer?candle.low:candle.high
      const pt=anchorToPixel({index:idx,ts:candle.ts,price:basePrice})
      if(!pt)continue
      const tone=buyer?'#00ff6a':'#ff334f'
      const y=pt[1]+(buyer?28:-28)
      const id=`signal-${signalIndex}-${signal.ts}-${signal.kind}`
      const fade=age<=3?1:clamp(1-((age-3)/3)*.55,.45,1)
      const scale=responsive?.92:1.05
      // Seta espessa, 3D/glow e pulsante. O texto grande foi removido do
      // gráfico; os detalhes ficam no banner superior e na Central de Decisão.
      const rawPoints=buyer
        ? [[0,-17],[-12,-3],[-5,-3],[-5,13],[5,13],[5,-3],[12,-3]]
        : [[0,17],[-12,3],[-5,3],[-5,-13],[5,-13],[5,3],[12,3]]
      const points=rawPoints.map(([xv,yv])=>[xv*scale,yv*scale])
      const shadowPoints=points.map(([xv,yv])=>[xv+2,yv+3])
      const shinePoints=buyer?[[-6,-2],[0,-11],[6,-2]]:[[-6,2],[0,11],[6,2]]
      const group:any={
        silent:true,z:34,id:`${id}-arrow3d`,type:'group',x:pt[0],y,
        children:[
          {type:'polygon',shape:{points:shadowPoints},style:{fill:'rgba(0,0,0,.68)',opacity:fade*.72}},
          {type:'polygon',shape:{points},style:{fill:tone,stroke:'#eafff0',lineWidth:.65,opacity:fade,shadowBlur:responsive?11:17,shadowColor:tone}},
          {type:'polyline',shape:{points:shinePoints},style:{stroke:'rgba(255,255,255,.62)',lineWidth:1.2,opacity:fade*.86,fill:null,lineCap:'round'}}
        ]
      }
      group.keyframeAnimation={duration:responsive?1150:900,loop:true,keyframes:[
        {percent:0,scaleX:.96,scaleY:.96,style:{opacity:fade*.68}},
        {percent:.50,scaleX:1.13,scaleY:1.13,style:{opacity:fade}},
        {percent:1,scaleX:.96,scaleY:.96,style:{opacity:fade*.68}},
      ]}
      elements.push(group)
    }

    chart.setOption({graphic:{elements}},{replaceMerge:['graphic'],lazyUpdate:true})
  },[anchorToPixel,candles,drawings,hoverAnchor,mainBounds,paperPosition,pending,positionY,potentialOutcome,prefs.drawingWidth,protectionGuides,protectionPreview,selectedDrawingId,signalMarkers,tool])

  useEffect(()=>{const id=window.requestAnimationFrame(redrawDrawings);return()=>window.cancelAnimationFrame(id)},[redrawDrawings,candles,zoomRange,paneCount])

  const eventToAnchor=useCallback((chart:echarts.ECharts,event:any):Anchor|null=>{
    const pixel=zrEventPixel(event)
    if(!pixel||candles.length===0)return null
    const {xLeft,xRight,yTop,yBottom}=mainBounds(chart)
    const [px,py]=pixel
    if(px<xLeft||px>xRight||py<yTop||py>yBottom)return null

    // O convertFromPixel categórico variava entre navegadores/ECharts e era a
    // principal causa das ferramentas parecerem "mortas". V2.12.8 ancora no
    // candle real mais próximo pelo pixel X e converte apenas o preço no eixo Y.
    let bestIndex=-1,bestDistance=Infinity
    for(let i=0;i<candles.length;i++){
      const category=chartCategories[i+padCount]
      const converted=chart.convertToPixel({xAxisIndex:0},category) as any
      const cx=Number(Array.isArray(converted)?converted[0]:converted)
      if(!Number.isFinite(cx))continue
      const distance=Math.abs(cx-px)
      if(distance<bestDistance){bestDistance=distance;bestIndex=i}
    }
    if(bestIndex<0)return null
    const yConverted=chart.convertFromPixel({yAxisIndex:0},py) as any
    const rawPrice=Number(Array.isArray(yConverted)?yConverted[yConverted.length-1]:yConverted)
    if(!Number.isFinite(rawPrice))return null
    return {index:bestIndex,ts:candles[bestIndex].ts,price:rawPrice}
  },[candles,chartCategories,mainBounds,padCount])

  const nearestDrawing=useCallback((event:any)=>{
    const pixel=zrEventPixel(event);if(!pixel)return null
    const [px,py]=pixel;let candidate:string|null=null,best=18
    for(const d of drawings){
      const a=anchorToPixel(d.a),b=d.b?anchorToPixel(d.b):null;if(!a)continue
      let distance=9999
      if(d.type==='horizontal'||d.type==='hray')distance=Math.abs(py-a[1])
      if(d.type==='vertical')distance=Math.abs(px-a[0])
      if(['trend','ray','arrow','measure'].includes(d.type)&&b)distance=pointToSegmentDistance(px,py,a[0],a[1],b[0],b[1])
      if((d.type==='rectangle'||d.type==='ellipse')&&b){const x1=Math.min(a[0],b[0]),x2=Math.max(a[0],b[0]),y1=Math.min(a[1],b[1]),y2=Math.max(a[1],b[1]);if(px>=x1&&px<=x2&&py>=y1&&py<=y2)distance=Math.min(Math.abs(px-x1),Math.abs(px-x2),Math.abs(py-y1),Math.abs(py-y2))}
      if(d.type==='fib'&&b){const x1=Math.min(a[0],b[0]),x2=Math.max(a[0],b[0]);if(px>=x1-8&&px<=x2+70)for(const level of FIB_LEVELS){const price=d.a.price+(d.b!.price-d.a.price)*level;const y=(anchorToPixel({...d.a,price})??a)[1];distance=Math.min(distance,Math.abs(py-y))}}
      if(distance<best){best=distance;candidate=d.id}
    }
    return candidate
  },[anchorToPixel,drawings])

  const removeNearest=useCallback((event:any)=>{const id=nearestDrawing(event);if(id)setDrawings(items=>items.filter(x=>x.id!==id))},[nearestDrawing])

  const handleChartContextMenu=useCallback((chart:echarts.ECharts,event:any)=>{
    const native=event?.event??event
    native?.preventDefault?.()
    const pixel=zrEventPixel(event)
    if(!pixel)return
    const x=pixel[0]
    if(x>=chart.getWidth()-145)setPriceScaleOpen(true)
  },[])

  const handleChartClick=useCallback((chart:echarts.ECharts,event:any)=>{
    if(tool==='select'||tool==='hand')return
    if(tool==='delete'){removeNearest(event);setHoverAnchor(null);return}
    const anchor=eventToAnchor(chart,event);if(!anchor)return
    if(tool==='horizontal'||tool==='hray'||tool==='vertical'){
      const id=`draw-${Date.now()}`;setDrawings(items=>[...items,{id,type:tool,a:anchor}]);setSelectedDrawingId(id);setHoverAnchor(null);setTool('select');return
    }
    if(!pending){setPending(anchor);return}
    const id=`draw-${Date.now()}`;setDrawings(items=>[...items,{id,type:tool,a:pending,b:anchor} as Drawing]);setSelectedDrawingId(id);setPending(null);setHoverAnchor(null);setTool('select')
  },[eventToAnchor,pending,removeNearest,tool])

  const priceFromY=useCallback((chart:echarts.ECharts,y:number)=>{const converted=chart.convertFromPixel({yAxisIndex:0},y) as any;const raw=Array.isArray(converted)?converted[converted.length-1]:converted;const value=Number(raw);return Number.isFinite(value)?value:null},[])
  const normalizeMarketPrice=useCallback((value:number)=>String(symbol??'').toUpperCase().startsWith('WIN')?Math.round(value/5)*5:Math.round(value*100)/100,[symbol])

  const shiftAnchor=useCallback((a:Anchor,di:number,dp:number,mode:'x'|'y'|'both')=>{
    let index=a.index,price=a.price
    if(mode==='x'||mode==='both')index=clamp(a.index+di,0,Math.max(candles.length-1,0))
    if(mode==='y'||mode==='both')price=a.price+dp
    return {index,ts:candles[index]?.ts??a.ts,price}
  },[candles])

  const handleChartMouseDown=useCallback((chart:echarts.ECharts,event:any)=>{
    const pixel=zrEventPixel(event);if(!pixel)return
    const [x,y]=pixel,{width,xLeft,xRight,yTop,yBottom}=mainBounds(chart)

    if(tool==='select'){
      const id=nearestDrawing(event),anchor=eventToAnchor(chart,event)
      if(id&&anchor){const original=drawings.find(d=>d.id===id);if(original){setSelectedDrawingId(id);drawingDragRef.current={id,start:anchor,original:{...original,a:{...original.a},b:original.b?{...original.b}:undefined}};chart.getZr().setCursorStyle('move');return}}
      setSelectedDrawingId(null)
    }

    if(protectionGuides&&paperPosition&&paperPosition.side!=='FLAT'&&paperPosition.average_price!=null&&x>=xLeft&&x<=xRight+12&&y>=yTop&&y<=yBottom){
      const lastIndex=Math.max(candles.length-1,0),lastTs=candles[lastIndex]?.ts??'';const candidates:[('stop'|'target'),number][]=[['stop',protectionGuides.stop],['target',protectionGuides.target]]
      let hit:'stop'|'target'|null=null,best=14
      for(const [kind,price] of candidates){const pt=lastTs?anchorToPixel({index:lastIndex,ts:lastTs,price}):null;if(!pt)continue;const distance=Math.abs(y-pt[1]);if(distance<best){best=distance;hit=kind}}
      if(hit){protectionDragRef.current=hit;const raw=priceFromY(chart,y);if(raw!=null)setProtectionPreview({kind:hit,price:normalizeMarketPrice(raw)});chart.getZr().setCursorStyle('ns-resize');return}
    }

    if(tool==='hand'&&effectiveYRange&&x>=xRight&&x<=width&&y>=yTop&&y<=yBottom){axisDragRef.current={startY:y,min:effectiveYRange.min,max:effectiveYRange.max,shift:zrShiftKey(event)};chart.getZr().setCursorStyle('ns-resize');return}
    if(tool==='hand'&&x>=xLeft&&x<=xRight&&y>=chart.getHeight()-46&&y<=chart.getHeight()){
      timeAxisDragRef.current={startX:x,range:zoomRange??{start:initialStart,end:100}};chart.getZr().setCursorStyle('ew-resize');return
    }
    if(tool==='hand'&&effectiveYRange&&x>=xLeft&&x<=xRight&&y>=yTop&&y<=yBottom){
      freePanDragRef.current={startX:x,startY:y,range:zoomRange??{start:initialStart,end:100},y:{min:effectiveYRange.min,max:effectiveYRange.max}}
      chart.getZr().setCursorStyle('grabbing');return
    }
  },[anchorToPixel,candles,drawings,effectiveYRange,eventToAnchor,initialStart,mainBounds,nearestDrawing,normalizeMarketPrice,paperPosition,priceFromY,protectionGuides,tool,zoomRange])

  const handleChartMouseMove=useCallback((chart:echarts.ECharts,event:any)=>{
    chartPointerInsideRef.current=true
    const pixel=zrEventPixel(event)
    if(pixel&&drawingDragRef.current&&tool==='select'){
      const now=eventToAnchor(chart,event),drag=drawingDragRef.current
      if(now){
        const di=now.index-drag.start.index,dp=now.price-drag.start.price
        setDrawings(items=>items.map(d=>{
          if(d.id!==drag.id)return d
          const original=drag.original
          const mode: 'x'|'y'|'both'=original.type==='horizontal'||original.type==='hray'?'y':original.type==='vertical'?'x':'both'
          return {...d,a:shiftAnchor(original.a,di,dp,mode),b:original.b?shiftAnchor(original.b,di,dp,mode):undefined}
        }))
      }
      return
    }
    if(pixel&&protectionDragRef.current){const raw=priceFromY(chart,pixel[1]);if(raw!=null)setProtectionPreview({kind:protectionDragRef.current,price:normalizeMarketPrice(raw)});return}
    if(pixel&&freePanDragRef.current){
      const drag=freePanDragRef.current
      const {xLeft,xRight,yTop,yBottom}=mainBounds(chart)
      const plotWidth=Math.max(xRight-xLeft,80),plotHeight=Math.max(yBottom-yTop,80)
      const dx=pixel[0]-drag.startX,dy=pixel[1]-drag.startY
      const spanX=Math.max(.08,drag.range.end-drag.range.start)
      const shiftPct=-(dx/plotWidth)*spanX
      let start=drag.range.start+shiftPct,end=drag.range.end+shiftPct
      if(start<0){end-=start;start=0}if(end>100){start-=end-100;end=100}
      setZoomRange({start:clamp(start,0,100),end:clamp(end,0,100)})
      const spanY=Math.max(drag.y.max-drag.y.min,1e-9)
      const priceShift=(dy/plotHeight)*spanY
      setManualY({min:drag.y.min+priceShift,max:drag.y.max+priceShift})
      return
    }
    if(pixel&&axisDragRef.current){const drag=axisDragRef.current,dy=pixel[1]-drag.startY,span=Math.max(drag.max-drag.min,1),plotHeight=Math.max(mainBounds(chart).yBottom-BASE_GRID.top,80);if(drag.shift||zrShiftKey(event)){const delta=(dy/plotHeight)*span;setManualY({min:drag.min+delta,max:drag.max+delta})}else{const factor=clamp(Math.exp(dy/150),.08,12),center=(drag.min+drag.max)/2,half=(span*factor)/2;setManualY({min:center-half,max:center+half})}return}
    if(pixel&&timeAxisDragRef.current){const drag=timeAxisDragRef.current,dx=pixel[0]-drag.startX,span=Math.max(.08,drag.range.end-drag.range.start),factor=clamp(Math.exp(dx/170),.08,12),nextSpan=clamp(span*factor,.08,100),center=(drag.range.start+drag.range.end)/2;let start=center-nextSpan/2,end=center+nextSpan/2;if(start<0){end-=start;start=0}if(end>100){start-=end-100;end=100}setZoomRange({start:clamp(start,0,100),end:clamp(end,0,100)});return}
    if(!pending||['select','hand','horizontal','hray','vertical','delete'].includes(tool)){if(hoverAnchor)setHoverAnchor(null);return}
    const anchor=eventToAnchor(chart,event);if(anchor)setHoverAnchor(anchor)
  },[eventToAnchor,hoverAnchor,mainBounds,normalizeMarketPrice,pending,priceFromY,shiftAnchor,tool])

  const handleChartMouseUp=useCallback(()=>{
    const protectionKind=protectionDragRef.current
    protectionDragRef.current=null;axisDragRef.current=null;timeAxisDragRef.current=null;freePanDragRef.current=null;drawingDragRef.current=null
    if(protectionKind&&protectionPreview&&onProtectionChange){const stop=protectionKind==='stop'?protectionPreview.price:(paperPosition?.stop_price??null);const target=protectionKind==='target'?protectionPreview.price:(paperPosition?.target_price??null);void Promise.resolve(onProtectionChange(stop,target)).catch(()=>undefined)}
    setProtectionPreview(null);chartRef.current?.getZr().setCursorStyle(tool==='hand'?GREEN_HAND_CURSOR:GREEN_POINTER_CURSOR)
  },[onProtectionChange,paperPosition?.stop_price,paperPosition?.target_price,protectionPreview,tool])
  const handleChartMouseOut=useCallback(()=>{
    chartPointerInsideRef.current=false
    if(!protectionDragRef.current&&!axisDragRef.current&&!timeAxisDragRef.current&&!freePanDragRef.current&&!drawingDragRef.current)setHoverAnchor(null)
  },[])
  const handleChartMouseWheel=useCallback((chart:echarts.ECharts,event:any)=>{
    const native=event?.event??event
    native?.preventDefault?.()
    const pixel=zrEventPixel(event)
    if(!pixel)return
    const {xLeft,xRight,yTop,yBottom}=mainBounds(chart)
    const [x,y]=pixel
    if(x<xLeft||x>xRight||y<yTop||y>yBottom)return
    const delta=Number(native?.deltaY??(-Number(event?.wheelDelta||0)))
    const zoomIn=delta<0
    const factor=zoomIn ? .82 : 1.22
    const current=zoomRange??{start:initialStart,end:100}
    const span=Math.max(.08,current.end-current.start)
    const nextSpan=clamp(span*factor,.08,100)
    const xRatio=clamp((x-xLeft)/Math.max(xRight-xLeft,1),0,1)
    const anchor=current.start+span*xRatio
    let start=anchor-nextSpan*xRatio,end=start+nextSpan
    if(start<0){end-=start;start=0}if(end>100){start-=end-100;end=100}
    setZoomRange({start:clamp(start,0,100),end:clamp(end,0,100)})

    const yr=effectiveYRange
    if(yr){
      const ySpan=Math.max(yr.max-yr.min,1e-9)
      const nextYSpan=ySpan*factor
      const yRatio=clamp((y-yTop)/Math.max(yBottom-yTop,1),0,1)
      const anchorPrice=yr.max-ySpan*yRatio
      const max=anchorPrice+nextYSpan*yRatio
      const min=max-nextYSpan
      setManualY({min,max})
    }
    window.requestAnimationFrame(redrawDrawings)
  },[effectiveYRange,initialStart,mainBounds,redrawDrawings,zoomRange])

  const handleDataZoom=useCallback((_chart:echarts.ECharts,event:any)=>{const payload=event?.batch?.[0]??event,start=Number(payload?.start),end=Number(payload?.end);if(Number.isFinite(start)&&Number.isFinite(end))setZoomRange({start,end});window.requestAnimationFrame(redrawDrawings)},[redrawDrawings])
  const zoomBy=useCallback((factor:number)=>{const current=zoomRange??{start:initialStart,end:100},span=Math.max(.08,current.end-current.start),nextSpan=clamp(span*factor,.08,100),center=(current.start+current.end)/2;let start=center-nextSpan/2,end=center+nextSpan/2;if(start<0){end-=start;start=0}if(end>100){start-=end-100;end=100}setZoomRange({start:clamp(start,0,100),end:clamp(end,0,100)})},[initialStart,zoomRange])

  const setActiveTool=(next:Tool)=>{
    toolRef.current=next
    setTool(next)
    setPending(null)
    setHoverAnchor(null)
    if(next!=='select')setSelectedDrawingId(null)
    chartRef.current?.getZr().setCursorStyle(next==='hand'?GREEN_HAND_CURSOR:GREEN_POINTER_CURSOR)
  }
  useEffect(()=>{
    const editable=()=>{
      const el=document.activeElement as HTMLElement|null
      const tag=el?.tagName?.toLowerCase()
      return tag==='input'||tag==='textarea'||Boolean(el?.isContentEditable)
    }
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Control'&&!event.repeat&&!editable()&&chartPointerInsideRef.current){
        if(ctrlPreviousToolRef.current==null){
          ctrlPreviousToolRef.current=toolRef.current
          toolRef.current='hand'
          setTool('hand')
          setPending(null)
          setHoverAnchor(null)
          chartRef.current?.getZr().setCursorStyle(GREEN_HAND_CURSOR)
        }
        return
      }
      if(event.key==='Escape'){
        ctrlPreviousToolRef.current=null
        toolRef.current='select'
        setTool('select');setPending(null);setHoverAnchor(null);setSelectedDrawingId(null)
      }
      if((event.key==='Delete'||event.key==='Backspace')&&selectedDrawingId){
        setDrawings(items=>items.filter(x=>x.id!==selectedDrawingId));setSelectedDrawingId(null)
      }
    }
    const onKeyUp=(event:KeyboardEvent)=>{
      if(event.key!=='Control'||ctrlPreviousToolRef.current==null)return
      const previous=ctrlPreviousToolRef.current
      ctrlPreviousToolRef.current=null
      toolRef.current=previous
      setTool(previous)
      chartRef.current?.getZr().setCursorStyle(previous==='hand'?GREEN_HAND_CURSOR:GREEN_POINTER_CURSOR)
    }
    const onBlur=()=>{
      if(ctrlPreviousToolRef.current==null)return
      const previous=ctrlPreviousToolRef.current
      ctrlPreviousToolRef.current=null
      toolRef.current=previous
      setTool(previous)
      chartRef.current?.getZr().setCursorStyle(previous==='hand'?GREEN_HAND_CURSOR:GREEN_POINTER_CURSOR)
    }
    window.addEventListener('keydown',onKeyDown)
    window.addEventListener('keyup',onKeyUp)
    window.addEventListener('blur',onBlur)
    return()=>{window.removeEventListener('keydown',onKeyDown);window.removeEventListener('keyup',onKeyUp);window.removeEventListener('blur',onBlur)}
  },[selectedDrawingId])

  const indicatorWarmup=(id:IndicatorId)=>{
    const required:Record<IndicatorId,number>={
      SMA9:9,SMA20:20,EMA9:1,EMA21:1,BOLL20:20,VWAP:1,
      ATR14:14,RSI14:14,MACD:26,ADX14:28,MFI14:15,STOCH:14,
    }
    const need=required[id]??1
    return {ready:candles.length>=need,need,have:candles.length}
  }

  const toggleIndicator=(id:IndicatorId)=>setPrefs(prev=>{
    const exists=prev.indicators.includes(id)
    if(exists)return {...prev,indicators:prev.indicators.filter(x=>x!==id)}
    const meta=INDICATOR_CATALOG.find(x=>x.id===id)
    if(meta?.kind==='pane'){
      const activePanes=prev.indicators.filter(x=>INDICATOR_CATALOG.find(m=>m.id===x)?.kind==='pane')
      if(activePanes.length>=MAX_PANES)return prev
    }
    return {...prev,indicators:[...prev.indicators,id]}
  })
  const moveIndicator=(id:IndicatorId,dir:-1|1)=>setPrefs(prev=>{const i=prev.indicators.indexOf(id);if(i<0)return prev;const j=clamp(i+dir,0,prev.indicators.length-1);if(i===j)return prev;const next=[...prev.indicators];[next[i],next[j]]=[next[j],next[i]];return {...prev,indicators:next}})
  const dropIndicator=(target:IndicatorId)=>{if(!dragIndicator||dragIndicator===target)return;setPrefs(prev=>{const next=prev.indicators.filter(x=>x!==dragIndicator);const at=Math.max(0,next.indexOf(target));next.splice(at,0,dragIndicator);return {...prev,indicators:next}});setDragIndicator(null)}

  const toolButtons:[Tool,IconName,string][]=[
    ['select','select','SELECIONAR / MOVER OBJETOS'],['hand','hand','MÃO / PAN 2D DO GRÁFICO'],
    ['horizontal','hline','LINHA HORIZONTAL'],['hray','hray','RAIO HORIZONTAL'],['vertical','vline','LINHA VERTICAL'],
    ['trend','trend','SEGMENTO / LINHA DE TENDÊNCIA'],['ray','ray','RAIO DE TENDÊNCIA'],['arrow','arrow','SETA'],
    ['rectangle','rectangle','RETÂNGULO / ZONA'],['ellipse','ellipse','ELIPSE'],['fib','fib','RETRAÇÃO DE FIBONACCI'],['measure','measure','RÉGUA / MEDIÇÃO'],['delete','delete','APAGAR OBJETO'],
  ]
  const selectedDrawing=drawings.find(d=>d.id===selectedDrawingId)??null
  const stageLabel=String(activeSignal?.stage??'')==='RESPONSIVE'?'RESPONSIVO':String(activeSignal?.stage??'')==='CONFIRMED'?'CONFIRMADO':String(activeSignal?.stage??'')==='WATCH'?'OBSERVAÇÃO':''

  return <div className={`pro-chart tool-${tool} theme-${prefs.theme}`} style={{background:prefs.background}}>
    <div className="pro-chart-head pro-chart-head-minimal">
      <div className="pro-instrument pro-instrument-minimal"><strong>{symbol||'WIN'}</strong></div>
      <div className={`atlas-signal-banner ${String(activeSignal?.kind??'').includes('VENDA')?'sell':String(activeSignal?.kind??'').includes('COMPRA')?'buy':'neutral'}`}><small>SINAL ATLAS</small><strong>{activeSignal?.label??'ANALISANDO MERCADO'}</strong><span>{stageLabel?`${stageLabel} · SCORE ${Number(activeSignal?.score??0)}`:'AGUARDANDO LEITURA'}</span></div>
    </div>

    <div className="pro-chart-canvas">
      <EChart option={option} onReady={chart=>{chartRef.current=chart;chart.getZr().setCursorStyle(GREEN_POINTER_CURSOR);window.requestAnimationFrame(redrawDrawings)}} onZrClick={handleChartClick} onZrDoubleClick={()=>{setZoomRange(null);setManualY(null);setPending(null);setHoverAnchor(null)}} onZrMouseDown={handleChartMouseDown} onZrMouseUp={handleChartMouseUp} onZrMouseMove={handleChartMouseMove} onZrMouseOut={handleChartMouseOut} onZrContextMenu={handleChartContextMenu} onZrMouseWheel={handleChartMouseWheel} onDataZoom={handleDataZoom} onResize={()=>window.requestAnimationFrame(redrawDrawings)}/>

      {pending&&<div className="drawing-hint">MOVA O MOUSE E CLIQUE NO SEGUNDO PONTO · ESC CANCELA</div>}
      {selectedDrawing&&<div className="drawing-floating-toolbar"><span>{selectedDrawing.type.toUpperCase()}</span><button onClick={()=>{setDrawings(items=>items.filter(x=>x.id!==selectedDrawing.id));setSelectedDrawingId(null)}}>APAGAR</button><button onClick={()=>setSelectedDrawingId(null)}>OK</button></div>}

      {paperPosition&&paperPosition.side!=='FLAT'&&paperPosition.average_price!=null&&positionY!=null&&<div className={`live-position-pnl ${paperPosition.side==='LONG'?'position-long':'position-short'} ${Number(paperPosition.open_pnl_money)>0?'profit':Number(paperPosition.open_pnl_money)<0?'loss':'neutral'}`} style={{top:positionY}}><strong>{paperPosition.side==='LONG'?'COMPRA':'VENDA'} {paperPosition.quantity}</strong><span>{Number(paperPosition.open_pnl_points)>=0?'+':''}{Number(paperPosition.open_pnl_points).toFixed(0)} pts</span><b>{Number(paperPosition.open_pnl_money)>=0?'+':''}R$ {Number(paperPosition.open_pnl_money).toFixed(2)}</b></div>}

      {paneIndicators.map((id,i)=><div key={id} className="indicator-pane-label" style={{bottom:`${(paneIndicators.length-i-1)*paneHeightPct+7}%`}}><b>{INDICATOR_CATALOG.find(x=>x.id===id)?.label??id}</b><button onClick={()=>toggleIndicator(id)}>×</button></div>)}

      <div className="chart-tool-rail chart-tool-rail-fluent" aria-label="Ferramentas de análise">
        {toolButtons.map(([id,icon,title])=><button key={id} className={tool===id?'active':''} title={title} onClick={()=>setActiveTool(id)}><AtlasIcon name={icon} size={19}/></button>)}
        <div className="tool-separator"/>
        <button title="ZOOM +" onClick={()=>zoomBy(.78)}><AtlasIcon name="zoomIn" size={19}/></button>
        <button title="ZOOM -" onClick={()=>zoomBy(1.28)}><AtlasIcon name="zoomOut" size={19}/></button>
        <button title="AUTO FIT" onClick={()=>{setZoomRange(null);setManualY(null)}}><AtlasIcon name="fit" size={19}/></button>
        <button title="LIMPAR DESENHOS" onClick={()=>{setDrawings([]);setPending(null);setSelectedDrawingId(null)}}><AtlasIcon name="clear" size={19}/></button>
        <button className={settingsOpen?'active':''} title="CONFIGURAÇÕES DO GRÁFICO" onClick={()=>setSettingsOpen(v=>!v)}><AtlasIcon name="settings" size={19}/></button>
      </div>

      {tool!=='select'&&tool!=='hand'&&<div className="active-tool-indicator">FERRAMENTA ATIVA: {toolButtons.find(([id])=>id===tool)?.[2]??tool.toUpperCase()}</div>}
      {tool==='hand'&&<div className="active-tool-indicator hand">MÃO ATIVA · ARRASTE GRÁFICO, RÉGUA DE PREÇO OU RÉGUA DE TEMPO</div>}

      {priceScaleOpen&&<div className="price-scale-context-menu" onContextMenu={e=>e.preventDefault()}>
        <header><strong>ESCALA DE PREÇO</strong><button onClick={()=>setPriceScaleOpen(false)}>×</button></header>
        <section><h5>GRID HORIZONTAL</h5><label>Grid automático <input type="checkbox" checked={priceScale.autoGrid} onChange={e=>setPriceScale(p=>({...p,autoGrid:e.target.checked}))}/></label><label>Cor <input type="color" value={priceScale.gridColor==='auto'?'#314139':priceScale.gridColor} onChange={e=>setPriceScale(p=>({...p,gridColor:e.target.value}))}/></label><label>Espessura <input type="number" min="0.3" max="3" step="0.1" value={priceScale.gridWidth} onChange={e=>setPriceScale(p=>({...p,gridWidth:Number(e.target.value)}))}/></label><label>Estilo <select value={priceScale.gridStyle} onChange={e=>setPriceScale(p=>({...p,gridStyle:e.target.value as PriceScalePrefs['gridStyle']}))}><option value="solid">SÓLIDA</option><option value="dashed">TRACEJADA</option><option value="dotted">PONTILHADA</option></select></label></section>
        <section><h5>TEXTOS</h5><label>Cor <input type="color" value={priceScale.textColor} onChange={e=>setPriceScale(p=>({...p,textColor:e.target.value}))}/></label><label>Tamanho <input type="number" min="7" max="16" value={priceScale.textSize} onChange={e=>setPriceScale(p=>({...p,textSize:Number(e.target.value)}))}/></label><label>Casas decimais <input type="number" min="0" max="4" value={priceScale.decimals} onChange={e=>setPriceScale(p=>({...p,decimals:Number(e.target.value)}))}/></label></section>
        <section><h5>TIPO DE ESCALA</h5><div className="scale-two"><button className={priceScale.scaleMode==='arithmetic'?'active':''} onClick={()=>setPriceScale(p=>({...p,scaleMode:'arithmetic'}))}>ARITMÉTICA</button><button className={priceScale.scaleMode==='logarithmic'?'active':''} onClick={()=>setPriceScale(p=>({...p,scaleMode:'logarithmic'}))}>LOGARÍTMICA</button></div></section>
        <section><h5>BLOCOS DE GRID</h5><label>Quantidade <input type="number" min="3" max="16" value={priceScale.quantity} onChange={e=>setPriceScale(p=>({...p,quantity:Number(e.target.value),gridMode:'quantity'}))}/></label><label>Intervalo manual <input type="number" min="0.001" step="0.001" value={priceScale.interval} onChange={e=>setPriceScale(p=>({...p,interval:Number(e.target.value),gridMode:'interval',autoGrid:false}))}/></label><label>Preço de referência <input type="number" step="0.001" value={priceScale.referencePrice} onChange={e=>setPriceScale(p=>({...p,referencePrice:Number(e.target.value),gridMode:'reference'}))}/></label><label>Espaço acima (%) <input type="number" min="0" max="50" value={priceScale.spacingAbove} onChange={e=>setPriceScale(p=>({...p,spacingAbove:Number(e.target.value)}))}/></label><label>Espaço abaixo (%) <input type="number" min="0" max="50" value={priceScale.spacingBelow} onChange={e=>setPriceScale(p=>({...p,spacingBelow:Number(e.target.value)}))}/></label></section>
      </div>}

      {settingsOpen&&<div className="chart-settings-panel">
        <header><div><small>ATLAS CHART</small><strong>PERSONALIZAÇÃO</strong></div><button onClick={()=>setSettingsOpen(false)}>×</button></header>
        <section><h4>TEMA DO ATLAS</h4><div className="theme-options"><button className={prefs.theme==='emerald'?'active':''} onClick={()=>setPrefs(p=>({...p,theme:'emerald',background:'#030908'}))}>ESMERALDA</button><button className={prefs.theme==='graphite'?'active':''} onClick={()=>setPrefs(p=>({...p,theme:'graphite',background:'#030303'}))}>PRETO</button><button className={prefs.theme==='navy'?'active':''} onClick={()=>setPrefs(p=>({...p,theme:'navy',background:'#06111f'}))}>AZUL ESCURO</button></div></section>
        <section><h4>APARÊNCIA DO GRÁFICO</h4><label>FUNDO <input type="color" value={prefs.background} onChange={e=>setPrefs(p=>({...p,background:e.target.value}))}/></label><label>ESPESSURA DA GRADE <input type="range" min="0.3" max="2" step="0.1" value={prefs.gridWidth} onChange={e=>setPrefs(p=>({...p,gridWidth:Number(e.target.value)}))}/><b>{prefs.gridWidth.toFixed(1)}</b></label><label>ESPESSURA CANDLE/PAVIO <input type="range" min="0.25" max="1.8" step="0.05" value={prefs.candleLineWidth} onChange={e=>setPrefs(p=>({...p,candleLineWidth:Number(e.target.value)}))}/><b>{prefs.candleLineWidth.toFixed(2)}</b></label><label>ESPESSURA DOS ESTUDOS <input type="range" min="0.7" max="4" step="0.1" value={prefs.drawingWidth} onChange={e=>setPrefs(p=>({...p,drawingWidth:Number(e.target.value)}))}/><b>{prefs.drawingWidth.toFixed(1)}</b></label><label className="toggle-row"><input type="checkbox" checked={prefs.showGrid} onChange={e=>setPrefs(p=>({...p,showGrid:e.target.checked}))}/> MOSTRAR GRADE</label></section>
        <section><h4>INDICADORES · CLIQUE PARA INSERIR</h4><p className="settings-note">Sobrepostos ficam nos candles. Osciladores usam até {MAX_PANES} painéis inferiores. Todo indicador marcado como ATIVO é renderizado; se faltar histórico, o status informa o warm-up.</p><div className="indicator-catalog">{INDICATOR_CATALOG.map(meta=>{const active=prefs.indicators.includes(meta.id),warm=indicatorWarmup(meta.id);return <button key={meta.id} className={`${active?'active':''} ${active&&!warm.ready?'warming':''}`} onClick={()=>toggleIndicator(meta.id)} title={meta.description}><span>{meta.label}</span>{active&&<small>{warm.ready?'ATIVO':`WARM-UP ${Math.min(warm.have,warm.need)}/${warm.need}`}</small>}</button>})}</div></section>
        {prefs.indicators.length>0&&<section><h4>ORDEM DOS INDICADORES</h4><div className="indicator-order">{prefs.indicators.map(id=><div key={id} draggable onDragStart={()=>setDragIndicator(id)} onDragOver={e=>e.preventDefault()} onDrop={()=>dropIndicator(id)}><span>⋮⋮ {INDICATOR_CATALOG.find(x=>x.id===id)?.label??id}</span><i>{INDICATOR_CATALOG.find(x=>x.id===id)?.kind==='overlay'?'GRÁFICO':'PAINEL'}</i><button onClick={()=>moveIndicator(id,-1)}>↑</button><button onClick={()=>moveIndicator(id,1)}>↓</button><button onClick={()=>toggleIndicator(id)}>×</button></div>)}</div></section>}
        <footer><button onClick={()=>setPrefs(DEFAULT_PREFS)}>RESTAURAR PADRÃO</button><button className="primary" onClick={()=>setSettingsOpen(false)}>CONCLUIR</button></footer>
      </div>}
    </div>
  </div>
}
