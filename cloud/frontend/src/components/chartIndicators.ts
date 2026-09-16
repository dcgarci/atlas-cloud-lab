export type IndicatorCandle={
  ts:string
  open:number
  high:number
  low:number
  close:number
  volume?:number
}

export type IndicatorId=
  |'SMA9'|'SMA20'|'EMA9'|'EMA21'|'BOLL20'|'VWAP'
  |'ATR14'|'RSI14'|'MACD'|'ADX14'|'MFI14'|'STOCH'

export const INDICATOR_CATALOG:{id:IndicatorId;label:string;kind:'overlay'|'pane';description:string}[]=[
  {id:'SMA9',label:'Média Simples 9',kind:'overlay',description:'Média móvel simples de 9 períodos'},
  {id:'SMA20',label:'Média Simples 20',kind:'overlay',description:'Média móvel simples de 20 períodos'},
  {id:'EMA9',label:'Média Exponencial 9',kind:'overlay',description:'Média móvel exponencial de 9 períodos'},
  {id:'EMA21',label:'Média Exponencial 21',kind:'overlay',description:'Média móvel exponencial de 21 períodos'},
  {id:'BOLL20',label:'Bandas de Bollinger 20,2',kind:'overlay',description:'Média 20 com 2 desvios-padrão'},
  {id:'VWAP',label:'VWAP',kind:'overlay',description:'Preço médio ponderado pelo volume da sessão'},
  {id:'ATR14',label:'ATR 14',kind:'pane',description:'Average True Range / volatilidade'},
  {id:'RSI14',label:'IFR / RSI 14',kind:'pane',description:'Índice de Força Relativa'},
  {id:'MACD',label:'MACD 12,26,9',kind:'pane',description:'Convergência/divergência de médias'},
  {id:'ADX14',label:'ADX 14',kind:'pane',description:'Força da tendência'},
  {id:'MFI14',label:'MFI 14',kind:'pane',description:'Money Flow Index'},
  {id:'STOCH',label:'Estocástico 14,3',kind:'pane',description:'Oscilador estocástico'},
]

function finite(v:number|null|undefined){return v!=null&&Number.isFinite(Number(v))}

export function sma(values:number[],period:number):(number|null)[]{
  const out:(number|null)[]=Array(values.length).fill(null)
  let sum=0
  for(let i=0;i<values.length;i++){
    sum+=values[i]
    if(i>=period)sum-=values[i-period]
    if(i>=period-1)out[i]=sum/period
  }
  return out
}

export function ema(values:number[],period:number):(number|null)[]{
  const out:(number|null)[]=Array(values.length).fill(null)
  if(!values.length)return out
  const k=2/(period+1)
  let prev=values[0]
  out[0]=prev
  for(let i=1;i<values.length;i++){
    prev=values[i]*k+prev*(1-k)
    out[i]=prev
  }
  return out
}

export function rollingStd(values:number[],period:number):(number|null)[]{
  const out:(number|null)[]=Array(values.length).fill(null)
  for(let i=period-1;i<values.length;i++){
    const sample=values.slice(i-period+1,i+1)
    const mean=sample.reduce((a,b)=>a+b,0)/period
    const variance=sample.reduce((a,b)=>a+(b-mean)*(b-mean),0)/period
    out[i]=Math.sqrt(variance)
  }
  return out
}

export function vwap(candles:IndicatorCandle[]):(number|null)[]{
  let numerator=0,denominator=0,session=''
  return candles.map(c=>{
    const day=String(c.ts).slice(0,10)
    if(day!==session){session=day;numerator=0;denominator=0}
    const vol=Number(c.volume??0)
    const typical=(Number(c.high)+Number(c.low)+Number(c.close))/3
    numerator+=typical*vol
    denominator+=vol
    return denominator?numerator/denominator:Number(c.close)
  })
}

export function trueRange(candles:IndicatorCandle[]):number[]{
  return candles.map((c,i)=>{
    if(i===0)return Math.max(0,Number(c.high)-Number(c.low))
    const prev=Number(candles[i-1].close)
    return Math.max(
      Number(c.high)-Number(c.low),
      Math.abs(Number(c.high)-prev),
      Math.abs(Number(c.low)-prev),
    )
  })
}

function wilder(values:number[],period:number):(number|null)[]{
  const out:(number|null)[]=Array(values.length).fill(null)
  if(values.length<period)return out
  let avg=values.slice(0,period).reduce((a,b)=>a+b,0)/period
  out[period-1]=avg
  for(let i=period;i<values.length;i++){
    avg=(avg*(period-1)+values[i])/period
    out[i]=avg
  }
  return out
}

export function atr(candles:IndicatorCandle[],period=14){
  return wilder(trueRange(candles),period)
}

export function rsi(candles:IndicatorCandle[],period=14):(number|null)[]{
  const closes=candles.map(c=>Number(c.close))
  const gains:number[]=Array(closes.length).fill(0)
  const losses:number[]=Array(closes.length).fill(0)
  for(let i=1;i<closes.length;i++){
    const d=closes[i]-closes[i-1]
    gains[i]=Math.max(d,0);losses[i]=Math.max(-d,0)
  }
  const avgG=wilder(gains,period),avgL=wilder(losses,period)
  return closes.map((_,i)=>{
    if(!finite(avgG[i])||!finite(avgL[i]))return null
    const g=Number(avgG[i]),l=Number(avgL[i])
    if(l===0)return 100
    const rs=g/l
    return 100-(100/(1+rs))
  })
}

export function macd(candles:IndicatorCandle[]){
  const closes=candles.map(c=>Number(c.close))
  const fast=ema(closes,12),slow=ema(closes,26)
  const line=closes.map((_,i)=>finite(fast[i])&&finite(slow[i])?Number(fast[i])-Number(slow[i]):null)
  const seed=line.map(v=>Number(v??0))
  const signalRaw=ema(seed,9)
  const signal=signalRaw.map((v,i)=>line[i]==null?null:v)
  const hist=line.map((v,i)=>v==null||signal[i]==null?null:Number(v)-Number(signal[i]))
  return {line,signal,hist}
}

export function adx(candles:IndicatorCandle[],period=14):(number|null)[]{
  const plusDM:number[]=Array(candles.length).fill(0)
  const minusDM:number[]=Array(candles.length).fill(0)
  for(let i=1;i<candles.length;i++){
    const up=Number(candles[i].high)-Number(candles[i-1].high)
    const down=Number(candles[i-1].low)-Number(candles[i].low)
    plusDM[i]=up>down&&up>0?up:0
    minusDM[i]=down>up&&down>0?down:0
  }
  const atrW=wilder(trueRange(candles),period)
  const pW=wilder(plusDM,period),mW=wilder(minusDM,period)
  const dx=candles.map((_,i)=>{
    if(!finite(atrW[i])||Number(atrW[i])===0||!finite(pW[i])||!finite(mW[i]))return 0
    const p=100*Number(pW[i])/Number(atrW[i])
    const m=100*Number(mW[i])/Number(atrW[i])
    return (p+m)===0?0:100*Math.abs(p-m)/(p+m)
  })
  return wilder(dx,period)
}

export function mfi(candles:IndicatorCandle[],period=14):(number|null)[]{
  const typical=candles.map(c=>(Number(c.high)+Number(c.low)+Number(c.close))/3)
  const flow=typical.map((p,i)=>p*Number(candles[i].volume??0))
  const out:(number|null)[]=Array(candles.length).fill(null)
  for(let i=period;i<candles.length;i++){
    let pos=0,neg=0
    for(let j=i-period+1;j<=i;j++){
      if(typical[j]>typical[j-1])pos+=flow[j]
      else if(typical[j]<typical[j-1])neg+=flow[j]
    }
    if(neg===0)out[i]=100
    else{const ratio=pos/neg;out[i]=100-(100/(1+ratio))}
  }
  return out
}

export function stochastic(candles:IndicatorCandle[],period=14,smooth=3){
  const k:(number|null)[]=Array(candles.length).fill(null)
  for(let i=period-1;i<candles.length;i++){
    const sample=candles.slice(i-period+1,i+1)
    const low=Math.min(...sample.map(c=>Number(c.low)))
    const high=Math.max(...sample.map(c=>Number(c.high)))
    k[i]=high===low?50:100*(Number(candles[i].close)-low)/(high-low)
  }
  const d=sma(k.map(v=>Number(v??0)),smooth).map((v,i)=>k[i]==null?null:v)
  return {k,d}
}

export function buildIndicatorData(candles:IndicatorCandle[]){
  const closes=candles.map(c=>Number(c.close))
  const sma9=sma(closes,9),sma20=sma(closes,20),ema9=ema(closes,9),ema21=ema(closes,21)
  const std20=rollingStd(closes,20)
  const bollMid=sma20
  const bollUpper=bollMid.map((v,i)=>v==null||std20[i]==null?null:Number(v)+2*Number(std20[i]))
  const bollLower=bollMid.map((v,i)=>v==null||std20[i]==null?null:Number(v)-2*Number(std20[i]))
  return {
    SMA9:{main:sma9},
    SMA20:{main:sma20},
    EMA9:{main:ema9},
    EMA21:{main:ema21},
    BOLL20:{mid:bollMid,upper:bollUpper,lower:bollLower},
    VWAP:{main:vwap(candles)},
    ATR14:{main:atr(candles,14)},
    RSI14:{main:rsi(candles,14)},
    MACD:macd(candles),
    ADX14:{main:adx(candles,14)},
    MFI14:{main:mfi(candles,14)},
    STOCH:stochastic(candles,14,3),
  } as const
}
