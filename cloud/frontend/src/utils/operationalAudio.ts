const KEY='atlas_operational_sound_enabled'

export function operationalSoundEnabled(){
  return localStorage.getItem(KEY)!=='0'
}

export function setOperationalSoundEnabled(enabled:boolean){
  localStorage.setItem(KEY,enabled?'1':'0')
}

function tone(ctx:AudioContext,frequency:number,start:number,duration:number,gainValue:number,type:OscillatorType='sine'){
  const osc=ctx.createOscillator()
  const gain=ctx.createGain()
  osc.type=type
  osc.frequency.value=frequency
  gain.gain.setValueAtTime(0.0001,start)
  gain.gain.exponentialRampToValueAtTime(gainValue,start+.012)
  gain.gain.exponentialRampToValueAtTime(0.0001,start+duration)
  osc.connect(gain);gain.connect(ctx.destination)
  osc.start(start);osc.stop(start+duration+.02)
}

export function playOperationalSound(kind:'entry'|'target'|'stop'){
  if(!operationalSoundEnabled())return
  try{
    const AC=(window.AudioContext||(window as any).webkitAudioContext)
    if(!AC)return
    const ctx=new AC()
    const t=ctx.currentTime+.01
    if(kind==='entry'){
      tone(ctx,620,t,.10,.07,'triangle')
      tone(ctx,880,t+.08,.13,.055,'triangle')
    }else if(kind==='target'){
      tone(ctx,740,t,.11,.065,'sine')
      tone(ctx,990,t+.08,.12,.065,'sine')
      tone(ctx,1320,t+.16,.16,.055,'sine')
    }else{
      tone(ctx,260,t,.17,.075,'square')
      tone(ctx,190,t+.12,.20,.065,'square')
    }
    window.setTimeout(()=>ctx.close().catch(()=>{}),650)
  }catch{}
}
