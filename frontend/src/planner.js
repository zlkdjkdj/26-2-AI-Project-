export function filterActions(steps,budget,effort){
  return steps.map(step=>({...step,visibleOptions:(step.options||[]).filter(option=>(budget==='all'||option.budget===budget)&&(effort==='all'||option.effort===effort))})).filter(step=>step.visibleOptions.length);
}
