import { useEffect, useRef, useState } from 'react';
import { ArrowUpRight,ArrowRight,ScanLine,Move,Palette,GitCompareArrows,SlidersHorizontal,ShieldCheck,Check } from 'lucide-react';
const features=[
 [ScanLine,'위험을 찾는 사진 점검','가구·전선·콘센트·멀티탭의 사진 위치와 주변 물건을 함께 살펴요. 확인할 이유, 예상 사고, 우선 정리할 일과 보완 방법을 나눠 안내해요.'],
 [ShieldCheck,'우리 가족에게 맞는 안내','신생아·영유아·노약자·휠체어 사용자·거동 불편자에 맞춘 피드백을 제공해요.'],
 [Move,'안전을 위한 재배치','가구를 드래그하고 회전하며 배치 2안을 비교해요. 실측·문·창문·고정 가구를 반영하고 벽지·바닥 색상을 바꾼 예상 모습을 PNG로 저장해요.'],
 [Palette,'놓친 위험도 직접 등록','사진에 안 잡힌 들뜬 매트나 가려진 장애물도 직접 등록해요. 관찰한 상황과 사용자 판단 위험등급을 기록하며 기존 분석 점수와 구분해 관리해요.'],
 [GitCompareArrows,'같은 가구의 전후 기록','재촬영한 사진에서 같은 가구를 직접 연결해 위치와 확인 항목을 비교해요.'],
 [SlidersHorizontal,'담당자와 목표일이 있는 계획','예산과 작업량에 맞춘 개선 방법을 고르고 담당자·목표일을 정해요. 조치 완료와 현장 재확인을 구분하고 변경 이력을 남겨요.'],
];
function ProductPreview(){
 const [mode,setMode]=useState('photo'),[floor,setFloor]=useState('#ded1bd');
 return <section data-reveal className="home-product" aria-label="서비스 기능 화면 예시">
  <div className="home-windowbar"><div className="home-windowdots"><i/><i/><i/></div><span>앗차차 / SPACE STUDIO</span><span className="home-demo-label">기능 화면 예시 · 실제 분석 아님</span></div>
  <div className="home-workspace"><aside className="home-demo-nav"><span className="home-studio-mark"><ShieldCheck size={25}/></span>{[['photo','01','사진 점검'],['design','02','공간 꾸미기'],['track','03','변화 기록']].map(([key,number,label])=><button key={key} aria-pressed={mode===key} onClick={()=>setMode(key)}><small>{number}</small><span>{label}</span>{mode===key&&<ArrowUpRight size={14}/>}</button>)}<div className="home-demo-nav-note">사진에서 시작해<br/>변화로 이어지는 공간.</div></aside>
   <div className="home-demo-content"><div className="home-demo-heading"><div><span>OUR SPACE, NEXT CHAPTER</span><h3>{mode==='photo'?'보이는 것부터 차근차근.':mode==='design'?'지금 가구로, 새로운 배치.':'변화를 한 번 더 확인해요.'}</h3></div><i><span/>YOUR SPACE</i></div>
   {mode==='photo'?<div className="home-photo-demo"><img src="/interior/natural.webp" alt="사진 점검 흐름을 설명하기 위한 다른 집의 거실 예시"/><div><ScanLine size={28}/><strong>사진 관찰 → 직접 확인</strong><p>객체의 위치와 가구별 안내를 살펴보고 실제 통로·고정 상태를 확인하세요.</p><span>공간 예시 · Max Vakhtbovych / Pexels</span></div></div>:mode==='design'?<div className="home-design-demo"><div className="home-demo-plan" style={{backgroundColor:floor}}><div className="home-demo-window"/><div className="home-demo-sofa"><span>소파</span></div><div className="home-demo-table">테이블</div><div className="home-demo-chair a">의자</div><div className="home-demo-chair b">의자</div><div className="home-demo-path">이동 여백</div><span className="home-plan-note">가상 배치도 예시 · 실측 결과 아님</span></div><div className="home-demo-properties"><span>MY INTERIOR</span><h4>내추럴 우드</h4><p>현재 가구를 살리고,<br/>나에게 맞는 여백을 남겨요.</p><label>바닥 색상 체험</label><div className="home-demo-swatches">{['#ded1bd','#b89b7b','#bcc8ce','#d1c6ba'].map(color=><button key={color} aria-label={`예시 바닥 색상 ${color}`} aria-pressed={floor===color} onClick={()=>setFloor(color)} style={{background:color}}/>)}</div>{['가구 이동·회전','벽지·바닥 색상','무료 예상 이미지'].map(label=><div className="home-demo-check" key={label}><Check size={13}/>{label}</div>)}</div></div>:<div className="home-track-demo"><div><small>BEFORE</small><h4>이전 사진의 의자</h4><span className="home-chair-symbol"/><p>사진 속 위치와 확인 항목</p></div><div className="home-link-demo"><GitCompareArrows size={28}/><span>같은 가구인지<br/>사용자가 확인</span></div><div><small>AFTER</small><h4>다시 촬영한 의자</h4><span className="home-chair-symbol after"/><p>연결한 가구의 변화 기록</p></div></div>}
   </div>
  </div>
 </section>;
}
const stack = [
 ['01', 'INTERFACE', 'React · Vite', '사진 첨부부터 배치 편집까지', 'React로 화면 상태와 편집 흐름을 연결하고, SVG·CSS로 가구 배치와 예상 모습을 그립니다.', ['React 19', 'Vite', 'SVG', 'Lucide']],
 ['02', 'API & STORAGE', 'FastAPI · SQLite', '점검과 공간의 기록을 연결', 'Python API가 사진 입력을 검증하고, SQLite에 점검 결과·배치 설정·가구 연결을 저장합니다.', ['Python', 'FastAPI', 'SQLite', 'Pillow']],
 ['03', 'VISION', 'YOLO · Grounding DINO', '가구와 전기설비를 함께 관찰', 'YOLO가 생활 가구를 찾고 Grounding DINO가 전선·콘센트·멀티탭을 보완합니다. 작은 전선 후보는 확대 후 재검증합니다.', ['ONNX Runtime', 'YOLOv8n', 'Grounding DINO']],
 ['04', 'STYLE & GUIDANCE', 'CLIP · Gemini', '취향 분석과 개선 안내', 'CLIP은 서버 CPU에서 참고 사진의 스타일 후보를 찾습니다. Gemini가 활성화된 환경에서는 개선 설명을 보완합니다.', ['CLIP ViT-B/32', 'Local CPU', 'Gemini 옵션']],
];
const faqs = [
 ['사진 한 장으로 무엇을 알 수 있나요?', '지원하는 가구·전기설비의 위치와 규칙에 따른 확인 항목을 안내합니다. 물기, 전기 과부하, 가구 고정 상태, 실제 통로 폭은 사진만으로 확정할 수 없어 직접 점검 항목으로 확인합니다.'],
 ['예상 모습은 어떻게 만들어지나요?', '현재 가구와 직접 추가한 가구를 바탕으로 도형 기반 가상 이미지를 그립니다. 벽·바닥 색상, 위치와 회전을 바로 바꿀 수 있습니다. 실사 AI 이미지 생성은 기본 비활성 상태입니다.'],
 ['실측과 참고 사진은 어떻게 활용하나요?', '방과 가구 치수를 입력하면 배치도 비율에 반영합니다. 원하는 인테리어 사진은 7개 미적 스타일의 후보와 대표색으로 분석하고, 접근성을 위한 편안한 동선까지 총 8가지 컨셉을 선택할 수 있습니다.'],
 ['사진과 분석 결과는 저장되나요?', '점검 결과와 배치 설정은 로컬 서버에 저장됩니다. 점검 원본 사진은 보관에 동의한 경우만 저장하며, 스타일 분석용 참고 사진은 저장하지 않습니다. 스타일 분석은 외부 이미지 API를 사용하지 않습니다.'],
];
function useScrollReveal(ref) {
 useEffect(() => {
  const root=ref.current;
  if(!root || !('IntersectionObserver' in window) || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const nodes=[...root.querySelectorAll('[data-reveal]')];
  const observer=new IntersectionObserver(entries=>entries.forEach(entry=>{
   if(entry.isIntersecting){entry.target.classList.add('is-visible');observer.unobserve(entry.target);}
  }),{threshold:0.12,rootMargin:'0px 0px -24px 0px'});
  nodes.forEach(node=>{node.classList.add('reveal-ready');observer.observe(node);});
  return ()=>{observer.disconnect();nodes.forEach(node=>node.classList.remove('reveal-ready'));};
 },[ref]);
}
export default function Landing({onStart,onHistory}){
 const root=useRef(null);useScrollReveal(root);
 return <div className="home-page" ref={root}>
  <nav className="home-section-nav" aria-label="서비스 소개 메뉴"><span>OUR SPACE, BETTER</span><div><a href="#how-it-works">이용 방법</a><a href="#features">주요 기능</a><a href="#technology">기술 스택</a><a href="#questions">궁금한 점</a></div></nav>
  <section className="home-intro"><span className="home-badge"><span/>AI 생활공간 안전관리</span><h1>위험을 살피고.<br/><span>변화를 관리하고.</span></h1><p>우리 집의 위험 후보를 찾고, 현장에서 확인하고, 개선을 기록하세요.<br/>발견에서 조치, 재확인까지 이어지는 생활 안전관리.</p><div className="home-hero-actions"><button className="home-primary" onClick={onStart}>사진 점검으로 이동하기<ArrowUpRight size={21}/></button><button className="home-secondary" onClick={onHistory}>지난 점검 보기<ArrowRight size={16}/></button></div><div className="home-facts"><span><ShieldCheck size={14}/>사진 기본 미보관</span><span><Move size={14}/>현장 확인·개선 이력</span><span><Palette size={14}/>기존 탐지·안전점수 유지</span></div></section>
  <ProductPreview/>
  <section data-reveal id="how-it-works" className="home-journey"><div><span className="home-section-number">THE PROCESS / 01—03</span><h2>살펴보고. 바꿔보고.<br/>다시 확인하고.</h2></div><div>{[['01','우리 공간을 담아요','사용 대상 5종과 공간을 선택하고 사진을 올려요. 바닥·가구·이동 통로가 함께 나오도록 촬영하면 확인에 도움이 돼요.'],['02','내 방식으로 계획해요','항목별로 실제 위험 조건을 확인하고 개선 방법·담당자·목표일을 정해요. 실측 배치와 예산·작업량 필터로 실행할 일을 구체화해요.'],['03','변화를 이어가요','조치 완료 후 현장을 다시 확인해 메모를 남겨요. 같은 공간을 재촬영하고 가구를 연결해 비교하며, 기록이 사라져도 자동 해결로 간주하지 않아요.']].map(([number,title,text])=><article key={number}><span>{number}</span><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></section>
  <section id="features" className="home-capabilities"><div data-reveal className="home-section-heading"><div><span className="home-section-number">MADE FOR YOUR EVERYDAY</span><h2>한 공간을 위한,<br/>여섯 가지 도구.</h2></div><p>정리 → 재배치 → 필요한 보완.<br/>큰 변화보다 실천할 수 있는 변화에 집중해요.</p></div><div className="home-feature-grid">{features.map(([Icon,title,text],index)=><article data-reveal style={{'--reveal-delay':`${index%3*75}ms`}} key={title}><div><Icon size={24}/><span>0{index+1}</span></div><h3>{title}</h3><p>{text}</p></article>)}</div></section>
  <section id="technology" className="home-technology">
   <div data-reveal className="home-section-heading"><div><span className="home-section-number">BEHIND THE EXPERIENCE</span><h2>공간을 이해하는 기술.<br/>변화를 돕는 도구.</h2></div><p>사진 관찰에서 취향 분석, 배치와 기록까지.<br/>각 단계의 역할을 나눠 연결했습니다.</p></div>
   <div className="home-stack-grid">{stack.map(([number,category,name,title,description,tags],index)=><article data-reveal style={{'--reveal-delay':`${index%2*75}ms`}} key={number}><div className="home-stack-top"><span>{category}</span><small>{number}</small></div><h3>{name}</h3><strong>{title}</strong><p>{description}</p><div className="home-stack-tags">{tags.map(tag=><span key={tag}>{tag}</span>)}</div></article>)}</div>
   <div data-reveal className="home-data-flow"><span>사진 입력</span><ArrowRight size={16}/><span>객체·스타일 분석</span><ArrowRight size={16}/><span>맞춤 안내·배치</span><ArrowRight size={16}/><span>개선 기록</span></div>
  </section>
  <section data-reveal id="questions" className="home-faq"><div><span className="home-section-number">A LITTLE MORE TO KNOW</span><h2>시작 전에,<br/>궁금할 수 있는 것들.</h2><p>어디까지 살펴볼 수 있는지,<br/>어떻게 활용하면 좋은지 알려드려요.</p></div><div>{faqs.map(([question,answer])=><details key={question}><summary>{question}<span aria-hidden="true">+</span></summary><p>{answer}</p></details>)}</div></section>
  <section data-reveal className="home-bottom"><div><span>YOUR SPACE. YOUR PACE.</span><h2>우리 집의 안전한 변화,<br/>사진 한 장에서 시작하세요.</h2><button className="home-primary" onClick={onStart}>사진 첨부 화면으로 이동<ArrowUpRight size={21}/></button></div><div className="home-bottom-note"><ShieldCheck size={24}/><strong>사진은 확인을 돕는 출발점이에요.</strong><p>물기·과부하·가구 고정·실제 이동 가능 여부는 현장에서 확인해 주세요. 탐지 누락은 안전을 뜻하지 않으며 점수와 가상 배치는 안전 인증이 아닙니다.</p></div></section>
 </div>;
}
