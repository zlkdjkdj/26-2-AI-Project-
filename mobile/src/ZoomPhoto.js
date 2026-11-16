import { useMemo, useRef, useState } from "react";
import { Image, Modal, PanResponder, Pressable, SafeAreaView, StyleSheet, Text, View } from "react-native";
import { clampPosition, fittedSize, zoomAtCenter } from "./photoZoomGeometry";
const point = touches => {
  const a=touches[0], b=touches[1] || a;
  return { x:(a.pageX+b.pageX)/2, y:(a.pageY+b.pageY)/2, distance:touches.length>1?Math.hypot(a.pageX-b.pageX,a.pageY-b.pageY):0, count:touches.length };
};
export default function ZoomPhoto({ photo, hazards, selected, initialMode = "all", onClose }) {
  const [view,setView]=useState({width:0,height:0});
  const [transform,setTransform]=useState({scale:1,x:0,y:0});
  const [mode,setMode]=useState(initialMode);
  const frame=useRef({view:{width:0,height:0},base:{width:0,height:0},transform:{scale:1,x:0,y:0},start:null});
  function update(next) { frame.current.transform=next; setTransform(next); }
  function layout(event) {
    const {width,height}=event.nativeEvent.layout;
    const bounds={width,height}, base=fittedSize(bounds,photo), pos=clampPosition(bounds,base,1,0,0);
    frame.current={view:bounds,base,transform:{scale:1,...pos},start:null};
    setView(bounds); setTransform({scale:1,...pos});
  }
  // The ref is read only inside gesture callbacks, after render.
  // eslint-disable-next-line react-hooks/refs
  const responder=useMemo(()=>PanResponder.create({
    onStartShouldSetPanResponder:()=>true,
    onMoveShouldSetPanResponder:()=>true,
    onPanResponderGrant:e=>{const touches=e.nativeEvent.touches; if(touches.length) frame.current.start={point:point(touches),transform:{...frame.current.transform}};},
    onPanResponderMove:e=>{
      const touches=e.nativeEvent.touches; if(!touches.length)return;
      const now=point(touches), state=frame.current, start=state.start;
      if(!start || start.point.count!==now.count) {state.start={point:now,transform:{...state.transform}};return;}
      const scale=now.count>1 && start.point.distance>0 ? start.transform.scale*now.distance/start.point.distance : start.transform.scale;
      update(zoomAtCenter(state.view,state.base,start.transform,scale,now.x-start.point.x,now.y-start.point.y));
    },
    onPanResponderRelease:()=>{frame.current.start=null;},
    onPanResponderTerminate:()=>{frame.current.start=null;},
  }),[]);
  function changeZoom(amount) { const state=frame.current; update(zoomAtCenter(state.view,state.base,state.transform,state.transform.scale+amount)); }
  function reset() { const state=frame.current; update({scale:1,...clampPosition(state.view,state.base,1,0,0)}); }
  const base=fittedSize(view,photo);
  return <Modal visible animationType="fade" onRequestClose={onClose}><SafeAreaView style={z.screen}>
    <View style={z.header}><Text style={z.title}>사진 자세히 보기</Text><Pressable onPress={onClose} accessibilityRole="button"><Text style={z.close}>닫기</Text></Pressable></View>
    <Text style={z.hint}>두 손가락으로 확대·축소하고 드래그해 이동하세요</Text>
    <View style={z.viewport} onLayout={layout} {...responder.panHandlers}>
      {!!base.width && <View style={{position:"absolute",left:transform.x,top:transform.y,width:base.width*transform.scale,height:base.height*transform.scale}} pointerEvents="none">
        <Image source={{uri:photo.uri}} style={StyleSheet.absoluteFill} resizeMode="stretch" />
        {mode!=="none" && hazards.map((h,i)=>h.bbox?.length===4 && (mode==="all" || i===selected) && <View key={h.id||i} style={{position:"absolute",left:`${h.bbox[0]*100}%`,top:`${h.bbox[1]*100}%`,width:`${h.bbox[2]*100}%`,height:`${h.bbox[3]*100}%`,borderWidth:2,borderColor:h.risk_level==="HIGH"?"#ff5252":h.risk_level==="MEDIUM"?"#ffb020":"#1685ff",borderRadius:4}}><Text style={z.badge}>{i+1}</Text></View>)}
      </View>}
    </View>
    <View style={z.controls}><Pressable style={z.control} onPress={()=>changeZoom(-.5)} accessibilityLabel="사진 축소"><Text style={z.controlText}>−</Text></Pressable><Pressable style={z.control} onPress={reset}><Text style={z.controlSmall}>{Math.round(transform.scale*100)}% · 초기화</Text></Pressable><Pressable style={z.control} onPress={()=>changeZoom(.5)} accessibilityLabel="사진 확대"><Text style={z.controlText}>＋</Text></Pressable></View>
    <View style={z.controls}>{[["all","전체 표시"],["selected","선택 항목만"],["none","박스 숨기기"]].map(([id,label])=><Pressable key={id} onPress={()=>setMode(id)} accessibilityRole="button" accessibilityState={{selected:mode===id}} style={[z.filter,mode===id&&z.filterActive]}><Text style={[z.filterText,mode===id&&z.filterTextActive]}>{label}</Text></Pressable>)}</View>
  </SafeAreaView></Modal>;
}
const z=StyleSheet.create({screen:{flex:1,backgroundColor:"#101218"},header:{paddingHorizontal:20,paddingTop:14,paddingBottom:8,flexDirection:"row",justifyContent:"space-between",alignItems:"center"},title:{fontSize:19,fontWeight:"700",color:"#fff"},close:{fontSize:16,color:"#a9caff",padding:8},hint:{color:"#b7becb",fontSize:13,paddingHorizontal:20,paddingBottom:12},viewport:{flex:1,overflow:"hidden",backgroundColor:"#08090b"},badge:{alignSelf:"flex-start",backgroundColor:"#075ac1",color:"#fff",fontSize:13,fontWeight:"700",paddingHorizontal:6,paddingVertical:2,overflow:"hidden"},controls:{flexDirection:"row",justifyContent:"center",gap:8,paddingHorizontal:12,paddingTop:10,paddingBottom:10},control:{minWidth:55,height:44,borderRadius:12,backgroundColor:"#2c313b",alignItems:"center",justifyContent:"center",paddingHorizontal:12},controlText:{color:"#fff",fontSize:25},controlSmall:{color:"#fff",fontSize:14},filter:{flex:1,minHeight:42,borderRadius:11,borderWidth:1,borderColor:"#454b58",alignItems:"center",justifyContent:"center",paddingHorizontal:4},filterActive:{backgroundColor:"#eaf3ff",borderColor:"#eaf3ff"},filterText:{fontSize:12,color:"#dce0e8"},filterTextActive:{color:"#075ac1",fontWeight:"700"}});
