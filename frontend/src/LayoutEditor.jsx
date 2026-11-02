import { useRef } from 'react';
import { RotateCw } from 'lucide-react';
import { constrainPlacement } from './layout';
import RoomPreview from './RoomPreview';

const furnitureKinds=[
  {kind:'couch',label:'소파',width:.28,depth:.13},
  {kind:'chair',label:'의자',width:.10,depth:.10},
  {kind:'dining_table',label:'테이블',width:.22,depth:.15},
  {kind:'bed',label:'침대',width:.25,depth:.30},
  {kind:'tv',label:'TV',width:.22,depth:.06},
  {kind:'potted_plant',label:'화분',width:.07,depth:.07},
];
const wallColors=['#f2f0eb','#ebe5d8','#d8e2dd','#dce3ec','#eadbd7','#d2d0cd'];
const floorColors=['#d8c6ac','#bd966e','#987655','#c9c0b6','#b7aaa0','#e1ddd5'];

function ColorPicker({title,value,colors,disabled,onChange}){
  return <fieldset className="finish-picker" disabled={disabled}><legend>{title}</legend><div className="color-swatches">{colors.map(color=><button type="button" key={color} aria-label={`${title} ${color}`} aria-pressed={value.toLowerCase()===color} style={{background:color}} onClick={()=>onChange(color)}/>)}<label className="custom-color">직접 선택<input type="color" aria-label={`${title} 직접 선택`} value={value} onChange={e=>onChange(e.target.value)}/></label></div></fieldset>;
}

export default function LayoutEditor({items,style,selected,onSelect,onChange,onFinish,onError,busy,previewRef,onExport,onSave,onRestore}){
  const board=useRef(null),drag=useRef(null);
  const current=items.find(item=>item.id===selected);
  function point(event){const element=board.current,rect=element.getBoundingClientRect();return {x:(event.clientX-rect.left-element.clientLeft)/element.clientWidth,y:(event.clientY-rect.top-element.clientTop)/element.clientHeight};}
  function move(id,x,y){onChange(items.map(item=>item.id===id&&!item.fixed?constrainPlacement(item,x,y):item));}
  function rotate(item){if(item.fixed)return;onChange(items.map(other=>other.id===item.id?constrainPlacement({...other,rotation:(other.rotation+90)%360}):other));}
  function add(kind,position={x:.3,y:.7}){
    if(busy)return;
    if(items.filter(item=>item.source==='user_added').length>=12){onError('직접 추가하는 가구는 12개까지 배치할 수 있어요.');return;}
    const template=furnitureKinds.find(item=>item.kind===kind);if(!template)return;
    const number=items.filter(item=>item.kind===kind&&item.source==='user_added').length+1;
    const item=constrainPlacement({...template,...position,id:`custom-${crypto.randomUUID().replace(/-/g,'')}`,label:`추가 ${template.label} ${number}`,rotation:0,source:'user_added',photo_position:'사용자 추가 · 가상 가구'});
    onChange([...items,item]);onSelect(item.id);
  }
  function keyboard(event,item){
    const step=event.shiftKey ? .05 : .01;
    const direction={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[event.key];
    if(direction){event.preventDefault();move(item.id,item.x+direction[0],item.y+direction[1]);}
    if(event.key.toLowerCase()==='r'){event.preventDefault();rotate(item);}
  }
  return <div className="workspace-grid">
    <div className="workspace-canvas">
      <div className="workspace-heading"><div><span className="eyebrow">직접 꾸미는 공간</span><h3>가구를 잡고 옮겨보세요</h3></div><button className="plain-button" disabled={busy} onClick={onRestore}>저장한 상태로 되돌리기</button></div>
      <p className="editor-help">가구 선택 → 드래그로 이동 · 방향키로 미세 조절 · R 키로 회전</p>
      <div className={`layout-board floor-${style.floor_pattern}`} ref={board} style={{backgroundColor:style.floor,borderColor:style.wall,aspectRatio:style.room_width&&style.room_depth?style.room_width/style.room_depth:1.25}}
        onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();add(event.dataTransfer.getData('application/x-atchacha-furniture'),point(event));}}
        onPointerMove={event=>{if(!drag.current||busy)return;const p=point(event);move(drag.current.id,p.x+drag.current.dx,p.y+drag.current.dy);}}
        onPointerUp={()=>{drag.current=null;}} onPointerCancel={()=>{drag.current=null;}} onLostPointerCapture={()=>{drag.current=null;}}>
        <div className="layout-path">가상 여백 가이드</div>
        {(style.opening_zones||[]).map(zone=><div key={zone.id} className={`opening-zone ${zone.kind}`} style={{left:`${zone.x*100}%`,top:`${zone.y*100}%`,width:`${zone.width*100}%`,height:`${zone.depth*100}%`}}>{zone.label}</div>)}
        {items.map(item=><button key={item.id} className={`layout-item ${selected===item.id?'selected':''} ${item.source==='user_added'?'user-added':''}`} style={{left:`${item.x*100}%`,top:`${item.y*100}%`,width:`${(item.rotation%180?item.depth:item.width)*100}%`,height:`${(item.rotation%180?item.width:item.depth)*100}%`,background:style.fabric}}
          disabled={busy} aria-label={`${item.label} 이동 및 회전`} aria-pressed={selected===item.id}
          onKeyDown={event=>keyboard(event,item)} onPointerDown={event=>{onSelect(item.id);if(event.button!==0||item.fixed)return;const p=point(event);drag.current={id:item.id,dx:item.x-p.x,dy:item.y-p.y};event.currentTarget.setPointerCapture(event.pointerId);}}
          onClick={()=>onSelect(item.id)}><span>{item.fixed?'▣ ':''}{item.label}</span></button>)}
        {!items.length&&<p className="empty-layout">가구가 탐지되지 않았어요.<br/>아래 팔레트에서 가구를 추가해 가상 배치를 시작하세요.</p>}
      </div>
      <p className="panel-note">위에서 본 가상 배치도입니다. 도형 크기·가운데 선은 실제 가구 치수나 출입문 위치가 아니에요.</p>
      <div className="furniture-tray"><h4>가구 추가</h4><p>끌어서 배치도에 놓거나 눌러서 추가하세요. 직접 추가한 가구는 사진 탐지 결과·위험점수에 반영되지 않아요.</p><div>{furnitureKinds.map(item=><button key={item.kind} disabled={busy} draggable={!busy} onDragStart={event=>event.dataTransfer.setData('application/x-atchacha-furniture',item.kind)} onClick={()=>add(item.kind)}>＋ {item.label}</button>)}</div></div>
      {current&&<div className="selection-panel"><div><strong>{current.label}</strong><small>{current.source==='user_added'?'사용자가 추가한 가상 가구':current.photo_position}</small></div><div className="selection-actions"><button className="plain-button" disabled={busy} onClick={()=>rotate(current)}><RotateCw size={15}/>90° 회전</button>{current.source==='user_added'&&<button className="plain-button" disabled={busy} onClick={()=>{onChange(items.filter(item=>item.id!==current.id));onSelect(null);}}>추가 가구 삭제</button>}</div><label>좌우<input type="range" min="0" max="100" aria-label="선택한 가구 좌우 위치" value={Math.round(current.x*100)} disabled={busy} onChange={e=>move(current.id,Number(e.target.value)/100,current.y)}/></label><label>앞뒤<input type="range" min="0" max="100" aria-label="선택한 가구 앞뒤 위치" value={Math.round(current.y*100)} disabled={busy} onChange={e=>move(current.id,current.x,Number(e.target.value)/100)}/></label></div>}
    </div>
    <aside className="workspace-settings" aria-label="색상과 예상 모습 설정">
      <h3>벽과 바닥 꾸미기</h3>
      <ColorPicker title="벽지 색상" value={style.wall} colors={wallColors} disabled={busy} onChange={value=>onFinish('wall',value)}/>
      <ColorPicker title="장판·바닥 색상" value={style.floor} colors={floorColors} disabled={busy} onChange={value=>onFinish('floor',value)}/>
      <fieldset className="finish-picker" disabled={busy}><legend>바닥 무늬</legend><div className="pattern-options">{[['wood','우드'],['tile','타일'],['plain','단색']].map(([key,label])=><button type="button" key={key} aria-pressed={style.floor_pattern===key} onClick={()=>onFinish('pattern',key)}>{label}</button>)}</div></fieldset>
      <button className="plain-button" disabled={busy} onClick={()=>onFinish('reset')}>컨셉 기본 색상으로</button>
      <div className="editor-live-preview"><h4>예상 모습 · 실시간 반영</h4><RoomPreview ref={previewRef} items={items} style={style}/><small>무료 가상 시뮬레이션 · 실제 사진 AI 편집이 아닙니다.</small></div>
      <button className="primary submit-button" disabled={busy} onClick={onSave}><span>{busy?'저장 중…':'색상·가구 배치 저장'}</span></button>
      <button className="plain-button" disabled={busy||!items.length} onClick={onExport}>예상 이미지 PNG 저장</button>
    </aside>
  </div>;
}
