export function AtlasMark({compact=false}:{compact?:boolean}){
  return <span className={`atlas-mark ${compact?'compact':''}`} aria-hidden="true">
    <i className="atlas-candle atlas-candle-a"/>
    <i className="atlas-candle atlas-candle-b"/>
    <i className="atlas-candle atlas-candle-c"/>
  </span>
}
