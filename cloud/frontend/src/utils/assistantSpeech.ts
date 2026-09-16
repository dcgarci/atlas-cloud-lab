export type AtlasSpeechPriority='normal'|'important'
export type AtlasSpeechOptions={
  dedupeKey?:string
  cooldownMs?:number
}

export function requestAtlasSpeech(
  text:string,
  priority:AtlasSpeechPriority='normal',
  options:AtlasSpeechOptions={},
){
  if(!text.trim())return
  window.dispatchEvent(new CustomEvent('atlas-speak',{detail:{text,priority,...options}}))
}
