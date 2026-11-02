import { forwardRef } from 'react';

const project = (x,y,z=0) => [100+x*400+y*180, 195-x*70+y*180-z];
const points = coordinates => coordinates.map(p=>p.join(',')).join(' ');

function Furniture({ item, style, index }) {
  const rotated=item.rotation%180;
  const w=rotated?item.depth:item.width, d=rotated?item.width:item.depth;
  const height={chair:33,couch:35,bed:19,dining_table:39,tv:48,potted_plant:25}[item.kind]||25;
  const x=item.x-w/2,y=item.y-d/2;
  const corners=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]];
  const base=corners.map(([a,b])=>project(a,b));
  const top=corners.map(([a,b])=>project(a,b,height));
  const center=project(item.x,item.y,height+12);
  const fill=item.kind==='tv'?'#3a4049':item.kind==='dining_table'?style.accent:style.fabric;
  return <g>
    <polygon points={points(base)} fill="#302519" opacity=".12" transform="translate(5,7)"/>
    <polygon points={points([base[1],base[2],top[2],top[1]])} fill={style.accent}/>
    <polygon points={points([base[2],base[3],top[3],top[2]])} fill={fill} stroke="#433c3522"/>
    <polygon points={points(top)} fill={fill} stroke="#fff9" strokeWidth="1.5"/>
    {item.kind==='bed'&&<polygon points={points([[x+.02,y+.025],[x+w-.02,y+.025],[x+w-.02,y+.09],[x+.02,y+.09]].map(([a,b])=>project(a,b,height+3)))} fill="#fff" opacity=".8"/>}
    {['chair','couch'].includes(item.kind)&&<polygon points={points([top[0],top[1],project(x+w,y,height+19),project(x,y,height+19)])} fill={style.accent} stroke="#fff6"/>}
    {item.kind==='potted_plant'&&<><ellipse cx={center[0]} cy={center[1]-8} rx="15" ry="21" fill="#68836a"/><path d={`M${center[0]} ${center[1]+12}v-22`} stroke="#3d6545" strokeWidth="3"/></>}
    <circle cx={center[0]} cy={center[1]-36} r="11" fill="#fff" stroke="#dad6d0"/><text x={center[0]} y={center[1]-32} textAnchor="middle" fontSize="11" fill="#343638">{index+1}</text>
  </g>;
}

const RoomPreview=forwardRef(function RoomPreview({ items, style, title='가구 배치 예상 모습', compact=false },ref) {
  const sorted=items.map((item,index)=>({item,index})).sort((a,b)=>(a.item.y-a.item.x*.39)-(b.item.y-b.item.x*.39));
  return <svg ref={ref} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 700 440" role="img" aria-label={`${style.name} ${title}`}>
    <rect width="700" height="440" rx="20" fill="#f5f3ee"/>
    <polygon points="100,195 500,125 500,25 100,95" fill={style.wall}/>
    <polygon points="500,125 680,305 680,205 500,25" fill={style.wall} stroke="#a9a39844"/>
    <polygon points="100,195 500,125 680,305 280,375" fill={style.floor} stroke="#c2b8a5"/>
    {(style.opening_zones||[]).map(zone=><g key={zone.id}><polygon points={points([[zone.x,zone.y],[zone.x+zone.width,zone.y],[zone.x+zone.width,zone.y+zone.depth],[zone.x,zone.y+zone.depth]].map(([x,y])=>project(x,y,1)))} fill={zone.kind==='door'?'#db9d67':'#73b4d8'} opacity=".5"/><text x={project(zone.x+zone.width/2,zone.y+zone.depth/2,3)[0]} y={project(zone.x+zone.width/2,zone.y+zone.depth/2,3)[1]} fontSize="9" textAnchor="middle" fill="#514c47">{zone.label}</text></g>)}
    {style.floor_pattern!=='plain'&&[.2,.4,.6,.8].map(n=><line key={n} x1={project(n,0)[0]} y1={project(n,0)[1]} x2={project(n,1)[0]} y2={project(n,1)[1]} stroke="#fff" opacity=".22"/>)}
    {style.floor_pattern==='tile'&&[.2,.4,.6,.8].map(n=><line key={n} x1={project(0,n)[0]} y1={project(0,n)[1]} x2={project(1,n)[0]} y2={project(1,n)[1]} stroke="#fff" opacity=".22"/>)}
    {sorted.map(({item,index})=><Furniture key={item.id} item={item} index={index} style={style}/>)}
    {!items.length&&<text x="350" y="240" textAnchor="middle" fontSize="16" fill="#6e6e73">배치할 가구가 탐지되지 않았어요</text>}
    {!compact&&<><text x="25" y="30" fontSize="15" fill="#424747" fontFamily="sans-serif">{style.name} · {title}</text><text x="25" y="415" fontSize="12" fill="#676862" fontFamily="sans-serif">가상 배치 시뮬레이션 · 실제 사진 편집·실측 결과가 아닙니다</text></>}
  </svg>;
});

export async function downloadPreview(svg, name) {
  const data=new XMLSerializer().serializeToString(svg);
  const source=URL.createObjectURL(new Blob([data],{type:'image/svg+xml;charset=utf-8'}));
  try {
    const image=new Image();
    await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=()=>reject(new Error('예상 이미지를 저장하지 못했어요. 다시 시도하세요.'));image.src=source;});
    const canvas=document.createElement('canvas');canvas.width=1400;canvas.height=880;
    canvas.getContext('2d').drawImage(image,0,0,1400,880);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
    if(!blob)throw new Error('이미지 파일을 만들지 못했어요.');
    const url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  } finally {URL.revokeObjectURL(source);}
}

export default RoomPreview;
