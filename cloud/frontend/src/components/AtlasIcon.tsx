import type {SVGProps,ReactNode} from 'react'

type IconName=
  |'live'|'context'|'decision'|'precision'|'lifecycle'|'risk'|'lab'|'journal'|'strategy'|'audit'|'vault'|'bridge'|'test'|'settings'
  |'select'|'hand'|'hline'|'hray'|'vline'|'trend'|'ray'|'arrow'|'rectangle'|'ellipse'|'fib'|'measure'|'delete'
  |'zoomIn'|'zoomOut'|'fit'|'clear'|'bell'|'search'|'play'|'pause'|'back'|'forward'|'calendar'|'asset'|'chevron'

function P(props:SVGProps<SVGPathElement>){return <path {...props}/>}
function L(props:SVGProps<SVGLineElement>){return <line {...props}/>}
function C(props:SVGProps<SVGCircleElement>){return <circle {...props}/>}
function R(props:SVGProps<SVGRectElement>){return <rect {...props}/>}

export function AtlasIcon({name,size=18,className,title}:{name:IconName,size?:number,className?:string,title?:string}){
  const common={width:size,height:size,viewBox:'0 0 24 24',fill:'none',stroke:'currentColor',strokeWidth:1.8,strokeLinecap:'round' as const,strokeLinejoin:'round' as const,className,'aria-hidden':title?undefined:true,'aria-label':title}
  let content:ReactNode
  switch(name){
    case 'live': content=<><P d="M4 16.5V8.5M8 19V5M12 15v-6M16 20V4M20 14V10"/><P d="M3 12h18" opacity=".25"/></>;break
    case 'context': content=<><C cx="12" cy="12" r="8"/><P d="M12 8v4l3 2"/><P d="M6.5 5.5l2 1.3M17.5 5.5l-2 1.3"/></>;break
    case 'decision': content=<><P d="M5 6h5v5H5zM14 6h5v5h-5zM9.5 16h5v3h-5z"/><P d="M7.5 11v2.5h9V11M12 13.5V16"/></>;break
    case 'precision': content=<><C cx="12" cy="12" r="7.5"/><C cx="12" cy="12" r="3.2"/><P d="M12 2.5v3M21.5 12h-3M12 21.5v-3M2.5 12h3"/></>;break
    case 'lifecycle': content=<><P d="M6 7h8a4 4 0 0 1 4 4v1"/><P d="m16 9 2 3 2-3"/><P d="M18 17h-8a4 4 0 0 1-4-4v-1"/><P d="m8 15-2-3-2 3"/></>;break
    case 'risk': content=<><P d="M12 3 4.5 6v5.5c0 4.4 3 7.6 7.5 9.5 4.5-1.9 7.5-5.1 7.5-9.5V6z"/><P d="M12 7v5"/><C cx="12" cy="16" r=".7" fill="currentColor" stroke="none"/></>;break
    case 'lab': content=<><P d="M9 3h6M10 3v5l-5 8.5A2.5 2.5 0 0 0 7.2 20h9.6a2.5 2.5 0 0 0 2.2-3.5L14 8V3"/><P d="M7.5 15h9"/></>;break
    case 'journal': content=<><R x="5" y="3.5" width="14" height="17" rx="2"/><P d="M8.5 8h7M8.5 12h7M8.5 16h4"/></>;break
    case 'strategy': content=<><P d="M4 17 9 12l4 3 7-8"/><C cx="4" cy="17" r="1.5"/><C cx="9" cy="12" r="1.5"/><C cx="13" cy="15" r="1.5"/><C cx="20" cy="7" r="1.5"/></>;break
    case 'audit': content=<><R x="4" y="4" width="12" height="16" rx="2"/><P d="M7 8h6M7 12h5M7 16h4"/><C cx="17.5" cy="16.5" r="3"/><P d="m19.7 18.7 2.1 2.1"/></>;break
    case 'vault': content=<><R x="3" y="5" width="18" height="14" rx="2.5"/><C cx="12" cy="12" r="3.2"/><P d="M12 8.8v6.4M8.8 12h6.4"/></>;break
    case 'bridge': content=<><P d="M4 8h5l2 3h2l2-3h5M4 16h5l2-3h2l2 3h5"/><C cx="4" cy="8" r="1.3"/><C cx="20" cy="8" r="1.3"/><C cx="4" cy="16" r="1.3"/><C cx="20" cy="16" r="1.3"/></>;break
    case 'test': content=<><P d="M5 5h14v14H5z"/><P d="M8 9h8M8 13h5"/><P d="m14.5 15.5 1.5 1.5 3-3"/></>;break
    case 'settings': content=<><C cx="12" cy="12" r="3"/><P d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.4 3.1a7 7 0 0 0-1.7 1L5 6.1 3 9.5 5 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.4 3.1h5l.4-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5a7 7 0 0 0 .1-1z"/></>;break
    case 'select': content=<P d="M5 3 18 12l-6 1.2L9.8 19z"/>;break
    case 'hand': content=<P d="M7.5 11V6.8a1.3 1.3 0 1 1 2.6 0V10 5.5a1.3 1.3 0 1 1 2.6 0V10 6.2a1.3 1.3 0 1 1 2.6 0V10 8a1.3 1.3 0 1 1 2.6 0v5.2c0 3.2-2.6 5.8-5.8 5.8h-1.1c-2 0-3.9-1-5-2.7L4 14.2a1.5 1.5 0 0 1 2.5-1.7l1 1.1"/>;break
    case 'hline': content=<><L x1="4" y1="12" x2="20" y2="12"/><P d="M6 8v8M18 8v8" opacity=".45"/></>;break
    case 'hray': content=<><L x1="4" y1="12" x2="18" y2="12"/><P d="m15 9 3 3-3 3"/></>;break
    case 'vline': content=<><L x1="12" y1="4" x2="12" y2="20"/><P d="M8 6h8M8 18h8" opacity=".45"/></>;break
    case 'trend': content=<><P d="M4 18 9 13l4 2 7-9"/><C cx="4" cy="18" r="1" fill="currentColor" stroke="none"/><C cx="20" cy="6" r="1" fill="currentColor" stroke="none"/></>;break
    case 'ray': content=<><P d="M4 18 18 6"/><P d="m15 6 3 0 0 3"/></>;break
    case 'arrow': content=<><P d="M4 17 17 6"/><P d="m13 6 4 0 0 4"/></>;break
    case 'rectangle': content=<R x="4" y="6" width="16" height="12" rx="1.5"/>;break
    case 'ellipse': content=<C cx="12" cy="12" r="7"/>;break
    case 'fib': content=<><L x1="4" y1="6" x2="20" y2="6"/><L x1="6" y1="10" x2="18" y2="10"/><L x1="8" y1="14" x2="16" y2="14"/><L x1="10" y1="18" x2="14" y2="18"/></>;break
    case 'measure': content=<><P d="M5 18 18 5"/><P d="m6 14 4 4M10 10l4 4M14 6l4 4"/></>;break
    case 'delete': content=<><P d="M5 7h14M9 7V4h6v3M8 10v7M12 10v7M16 10v7M7 7l1 13h8l1-13"/></>;break
    case 'zoomIn': content=<><C cx="10.5" cy="10.5" r="6"/><P d="m15 15 5 5M10.5 7.5v6M7.5 10.5h6"/></>;break
    case 'zoomOut': content=<><C cx="10.5" cy="10.5" r="6"/><P d="m15 15 5 5M7.5 10.5h6"/></>;break
    case 'fit': content=<><P d="M8 4H4v4M16 4h4v4M8 20H4v-4M16 20h4v-4"/><P d="M8 12h8"/></>;break
    case 'clear': content=<><P d="m5 16 8-8 5 5-8 8H5z"/><P d="M12 20h8"/></>;break
    case 'bell': content=<><P d="M6.5 16.5h11l-1.5-2V10a4 4 0 0 0-8 0v4.5z"/><P d="M10 19a2.2 2.2 0 0 0 4 0"/></>;break
    case 'search': content=<><C cx="10.5" cy="10.5" r="6"/><P d="m15 15 5 5"/></>;break
    case 'play': content=<P d="m9 6 9 6-9 6z"/>;break
    case 'pause': content=<><L x1="9" y1="6" x2="9" y2="18"/><L x1="15" y1="6" x2="15" y2="18"/></>;break
    case 'back': content=<><P d="m11 7-5 5 5 5"/><L x1="7" y1="12" x2="19" y2="12"/></>;break
    case 'forward': content=<><P d="m13 7 5 5-5 5"/><L x1="5" y1="12" x2="17" y2="12"/></>;break
    case 'calendar': content=<><R x="4" y="5" width="16" height="15" rx="2"/><P d="M8 3v4M16 3v4M4 9h16"/></>;break
    case 'asset': content=<><C cx="12" cy="12" r="8"/><P d="M4 12h16M12 4c2.4 2.2 3.6 4.9 3.6 8S14.4 17.8 12 20c-2.4-2.2-3.6-4.9-3.6-8S9.6 6.2 12 4z"/></>;break
    case 'chevron': content=<P d="m8 10 4 4 4-4"/>;break
    default: content=<C cx="12" cy="12" r="7"/>
  }
  return <svg {...common}>{content}</svg>
}

export type {IconName}
