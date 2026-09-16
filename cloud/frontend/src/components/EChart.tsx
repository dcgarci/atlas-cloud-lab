import {useEffect,useRef} from 'react'
import * as echarts from 'echarts'

export function EChart({
  option,
  onReady,
  onZrClick,
  onZrDoubleClick,
  onZrMouseMove,
  onZrMouseOut,
  onZrMouseDown,
  onZrMouseUp,
  onZrContextMenu,
  onZrMouseWheel,
  onDataZoom,
  onResize,
}:{
  option:echarts.EChartsOption
  onReady?:(chart:echarts.ECharts)=>void
  onZrClick?:(chart:echarts.ECharts,event:any)=>void
  onZrDoubleClick?:(chart:echarts.ECharts,event:any)=>void
  onZrMouseMove?:(chart:echarts.ECharts,event:any)=>void
  onZrMouseOut?:(chart:echarts.ECharts,event:any)=>void
  onZrMouseDown?:(chart:echarts.ECharts,event:any)=>void
  onZrMouseUp?:(chart:echarts.ECharts,event:any)=>void
  onZrContextMenu?:(chart:echarts.ECharts,event:any)=>void
  onZrMouseWheel?:(chart:echarts.ECharts,event:any)=>void
  onDataZoom?:(chart:echarts.ECharts,event:any)=>void
  onResize?:(chart:echarts.ECharts)=>void
}){
  const ref=useRef<HTMLDivElement>(null)
  const chartRef=useRef<echarts.ECharts|null>(null)
  const seriesSignatureRef=useRef('')
  const readyRef=useRef(onReady)
  const clickRef=useRef(onZrClick)
  const dblClickRef=useRef(onZrDoubleClick)
  const moveRef=useRef(onZrMouseMove)
  const outRef=useRef(onZrMouseOut)
  const downRef=useRef(onZrMouseDown)
  const upRef=useRef(onZrMouseUp)
  const contextRef=useRef(onZrContextMenu)
  const wheelRef=useRef(onZrMouseWheel)
  const zoomRef=useRef(onDataZoom)
  const resizeRef=useRef(onResize)

  useEffect(()=>{readyRef.current=onReady},[onReady])
  useEffect(()=>{clickRef.current=onZrClick},[onZrClick])
  useEffect(()=>{dblClickRef.current=onZrDoubleClick},[onZrDoubleClick])
  useEffect(()=>{moveRef.current=onZrMouseMove},[onZrMouseMove])
  useEffect(()=>{outRef.current=onZrMouseOut},[onZrMouseOut])
  useEffect(()=>{downRef.current=onZrMouseDown},[onZrMouseDown])
  useEffect(()=>{upRef.current=onZrMouseUp},[onZrMouseUp])
  useEffect(()=>{contextRef.current=onZrContextMenu},[onZrContextMenu])
  useEffect(()=>{wheelRef.current=onZrMouseWheel},[onZrMouseWheel])
  useEffect(()=>{zoomRef.current=onDataZoom},[onDataZoom])
  useEffect(()=>{resizeRef.current=onResize},[onResize])

  useEffect(()=>{
    if(!ref.current)return

    const chart=echarts.init(ref.current,null,{renderer:'canvas'})
    chartRef.current=chart

    const zr=chart.getZr()
    const handleClick=(event:any)=>clickRef.current?.(chart,event)
    const handleDblClick=(event:any)=>dblClickRef.current?.(chart,event)
    const handleMouseMove=(event:any)=>moveRef.current?.(chart,event)
    const handleMouseOut=(event:any)=>outRef.current?.(chart,event)
    const handleMouseDown=(event:any)=>downRef.current?.(chart,event)
    const handleMouseUp=(event:any)=>upRef.current?.(chart,event)
    const handleContextMenu=(event:any)=>contextRef.current?.(chart,event)
    const handleMouseWheel=(event:any)=>wheelRef.current?.(chart,event)
    const handleZoom=(event:any)=>zoomRef.current?.(chart,event)

    zr.on('click',handleClick)
    zr.on('dblclick',handleDblClick)
    zr.on('mousemove',handleMouseMove)
    zr.on('mouseout',handleMouseOut)
    zr.on('mousedown',handleMouseDown)
    zr.on('mouseup',handleMouseUp)
    zr.on('contextmenu',handleContextMenu)
    zr.on('mousewheel',handleMouseWheel)
    chart.on('datazoom',handleZoom)

    const ro=new ResizeObserver(()=>{
      chart.resize()
      resizeRef.current?.(chart)
    })
    ro.observe(ref.current)
    readyRef.current?.(chart)

    return()=>{
      ro.disconnect()
      zr.off('click',handleClick)
      zr.off('dblclick',handleDblClick)
      zr.off('mousemove',handleMouseMove)
      zr.off('mouseout',handleMouseOut)
      zr.off('mousedown',handleMouseDown)
      zr.off('mouseup',handleMouseUp)
      zr.off('contextmenu',handleContextMenu)
      zr.off('mousewheel',handleMouseWheel)
      chart.off('datazoom',handleZoom)
      chart.dispose()
      chartRef.current=null
    }
  },[])

  useEffect(()=>{
    const chart=chartRef.current
    if(!chart)return
    const series=Array.isArray((option as any)?.series)?(option as any).series:[]
    const signature=series.map((s:any)=>String(s?.id??s?.name??s?.type??'series')).join('|')
    const structureChanged=seriesSignatureRef.current!==signature
    seriesSignatureRef.current=signature
    try{
      chart.setOption(option,structureChanged
        ?{notMerge:false,lazyUpdate:false,replaceMerge:['series','grid','xAxis','yAxis','dataZoom']}
        :{notMerge:false,lazyUpdate:true}
      )
    }catch(error){
      // Falha de uma configuracao do grafico nao pode derrubar toda a janela
      // do ATLAS. Mantemos o ultimo frame valido e registramos o diagnostico.
      console.error('[ATLAS][EChart] Falha ao atualizar grafico',error)
    }
  },[option])

  return <div ref={ref} className="echart"/>
}
