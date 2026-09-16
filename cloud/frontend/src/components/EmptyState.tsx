type Props={
  eyebrow?:string
  title:string
  description?:string
  actionLabel?:string
  onAction?:()=>void
  compact?:boolean
}

export function EmptyState({
  eyebrow='AGUARDANDO',
  title,
  description,
  actionLabel,
  onAction,
  compact=false,
}:Props){
  return <div className={`ort-empty ${compact?'compact':''}`}>
    <div className="ort-empty-mark">
      <i/><i/><i/>
    </div>

    <div className="ort-empty-copy">
      <span>{eyebrow}</span>
      <strong>{title}</strong>
      {description&&<p>{description}</p>}
    </div>

    {actionLabel&&onAction&&
      <button
        type="button"
        className="ort-btn secondary"
        onClick={onAction}
      >
        {actionLabel}
      </button>
    }
  </div>
}
