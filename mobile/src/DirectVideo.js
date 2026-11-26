import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AppState, Pressable, StyleSheet, Text, View } from "react-native";
import {
  MediaStream,
  RTCView,
  RTCPeerConnection,
  mediaDevices,
} from "react-native-webrtc";
import { useKeepAwake } from "expo-keep-awake";
import Bridge from "../modules/homecam-bridge";
import {
  directRequest,
  hasTailnetCandidate,
  tailnetSdp,
} from "./directProtocol";
import { excludeUnsupportedAv1 } from "./videoCodecs";
import { stripVideoOrientation } from "./sdpOrientation";
import { addBitrateHints, tuneVideoSender } from "./videoQuality";
import { mapPersonBox } from "./personBoxGeometry";
import { containBox } from "./videoFit";
import { IS_TABLET } from "./variant";
import { advancePersonTrack } from "./personTracking";

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let detectionQueue = Promise.resolve();
let fallQueue = Promise.resolve();
let manualQueue = Promise.resolve();
const queueManual = (operation) => {
  manualQueue = manualQueue.catch(() => {}).then(operation);
  return manualQueue;
};
const queueFall = (operation) => {
  fallQueue = fallQueue.catch(() => {}).then(operation);
  return fallQueue;
};
const queueDetection = (operation) => {
  detectionQueue = detectionQueue.catch(() => {}).then(operation);
  return detectionQueue;
};
async function description(peer) {
  let firstCandidateAt = 0;
  for (let i = 0; i < 100; i++) {
    if (peer.connectionState === "closed")
      throw new Error("영상 연결이 종료되었습니다.");
    const hasCandidate = hasTailnetCandidate(peer.localDescription?.sdp || "");
    if (hasCandidate && !firstCandidateAt) firstCandidateAt = Date.now();
    // Give other Tailnet interfaces a short chance to appear without waiting
    // for unrelated ICE interfaces to finish gathering.
    if (hasCandidate && (peer.iceGatheringState === "complete" || Date.now() - firstCandidateAt >= 400)) break;
    await pause(100);
  }
  const network = await Bridge.networkStatus();
  return tailnetSdp(peer.localDescription.sdp, network);
}

// Each mounted session owns and closes its peer and media tracks.
const DirectVideo = forwardRef(function DirectVideo({
  camera,
  connection,
  fit = "contain",
  onStop,
  fallRecording = false,
  rotation = 0,
  compact = false,
}, ref) {
  useKeepAwake();
  const [stream, setStream] = useState(null);
  const [message, setMessage] = useState("영상 준비 중…");
  const [person, setPerson] = useState(null);
  const [viewport, setViewport] = useState(null);
  // 영상 크기·회전(상대 기기를 가로·세로로 돌리면 바뀜). 원본 비율 표시는 이 값으로 직접 계산한다.
  const [frame, setFrame] = useState(null);
  const [detectionMessage, setDetectionMessage] = useState("");
  const [fallMessage, setFallMessage] = useState("");
  const trackRef = useRef(null);
  const cameraTrack = useRef(null);
  const switchingCamera = useRef(false);
  const [frontCamera, setFrontCamera] = useState(false);
  useImperativeHandle(ref, () => ({
    /** 화면에 그려지는 영상 크기(회전 반영). PIP 창 비율을 맞출 때 쓴다. */
    displaySize() {
      if (!frame) return null;
      const sideways = Math.abs(frame.turn) % 180 !== 0;
      return sideways ? { width: frame.height, height: frame.width } : { width: frame.width, height: frame.height };
    },
    async startRecording() {
      if (camera || !stream) throw new Error("영상 연결 후 녹화할 수 있습니다.");
      await queueManual(() => Bridge.startManualRecorder(stream.toURL()));
    },
    stopRecording() { Bridge.finishManualRecording(); },
    recordingStatus() { return Bridge.manualRecorderStatus(); },
  }), [camera, stream, frame]);
  useEffect(() => {
    if (camera || !stream) return;
    return () => { queueManual(() => Bridge.stopManualRecorder()).catch(() => {}); };
  }, [camera, stream]);
  useEffect(() => {
    if (!camera || !stream || !fallRecording) return;
    let active = true, timer;
    const poll = () => {
      if (!active) return;
      try { setFallMessage(Bridge.fallRecorderStatus()); }
      catch { setFallMessage("낙상 의심 감지 사용 불가"); }
      timer = setTimeout(poll, 1000);
    };
    queueFall(() => Bridge.startFallRecorder(stream.toURL()))
      .then(() => { if (active) poll(); })
      .catch(() => { if (active) setFallMessage("낙상 의심 감지를 시작하지 못했어요"); });
    return () => { active = false; clearTimeout(timer); queueFall(() => Bridge.stopFallRecorder()).catch(() => {}); };
  }, [camera, stream, fallRecording]);
  useEffect(() => {
    if (camera || !stream) return;
    let active = true, timer, lastPoll = Date.now();
    const pollPerson = () => {
      if (!active) return;
      try {
        const result = Bridge.personDetectionResult();
        const now = Date.now();
        trackRef.current = advancePersonTrack(trackRef.current, result, now - lastPoll);
        lastPoll = now;
        setPerson(trackRef.current);
        setDetectionMessage(result?.error ? "사람 인식 사용 불가" : "사람 인식 중 · 최대 1명");
      }
      catch { trackRef.current = null; setPerson(null); setDetectionMessage("사람 인식 사용 불가"); }
      timer = setTimeout(pollPerson, 100);
    };
    queueDetection(() => Bridge.startPersonDetection(stream.toURL()))
      .then(() => { if (active) { setDetectionMessage("사람 인식 중 · 최대 1명"); pollPerson(); } })
      .catch(() => { if (active) setDetectionMessage("사람 인식 사용 불가"); });
    return () => {
      active = false; clearTimeout(timer); trackRef.current = null; setPerson(null);
      queueDetection(() => Bridge.stopPersonDetection()).catch(() => {});
    };
  }, [camera, stream]);
  useEffect(() => {
    let active = true,
      media,
      peer,
      offerId = "",
      poll,
      retry,
      generation = 0;
    const controller = new AbortController();
    const update = (text) => {
      if (active) setMessage(text);
    };
    const request = (path, options = {}) =>
      directRequest(connection.origin, path, {
        token: connection.token,
        signal: controller.signal,
        ...options,
      });
    let backgroundTimer;
    const checkBackground = () => {
      if (!active || AppState.currentState === "active") return;
      let pip = false;
      try { pip = !camera && Bridge.isPictureInPicture(); } catch {}
      if (!pip) onStop();
    };
    const subscription = AppState.addEventListener("change", (state) => {
      clearTimeout(backgroundTimer);
      if (state !== "active") backgroundTimer = setTimeout(checkBackground, 700);
    });
    const pipWatch = setInterval(checkBackground, 1500);
    const closePeer = () => {
      if (peer) {
        peer.close();
        peer = null;
      }
      if (!camera && media) {
        media.getTracks().forEach((t) => t.stop());
        media = null;
      }
    };
    function attach(current, reconnect) {
      current.addEventListener("connectionstatechange", () => {
        if (!active || current !== peer) return;
        if (current.connectionState === "connected") {
          clearTimeout(retry);
          update(camera ? "모니터링 기기로 실시간 전송 중" : "실시간 연결됨");
        } else if (
          ["failed", "disconnected"].includes(current.connectionState)
        ) {
          update("연결이 끊어졌습니다. 다시 연결 중…");
          if (!camera) {
            clearTimeout(retry);
            retry = setTimeout(reconnect, 4000);
          }
        }
      });
    }
    async function cameraPoll() {
      if (!active) return;
      try {
        const offer = Bridge.takeOffer();
        if (!offer) {
          if (offerId) {
            closePeer();
            offerId = "";
            update("모니터링 기기 연결 대기 중");
          }
        } else if (offer.id !== offerId) {
          closePeer();
          const current = new RTCPeerConnection({
            iceServers: [],
            candidateNetworkPolicy: "all",
            continualGatheringPolicy: "gather_continually",
          });
          peer = current;
          offerId = offer.id;
          attach(current);
          media.getTracks().forEach((track) => current.addTrack(track, media));
          await current.setRemoteDescription({ type: "offer", sdp: offer.sdp });
          excludeUnsupportedAv1(current);
          await current.setLocalDescription(await current.createAnswer());
          tuneVideoSender(current).catch(() => {});
          const sdp = await description(current);
          if (active && current === peer) Bridge.setAnswer(offer.id, sdp);
        }
      } catch (error) {
        update(error.message);
      }
      if (active) poll = setTimeout(cameraPoll, 250);
    }
    async function cameraStart() {
      try {
        media = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "environment",
            width: 1280,
            height: 720,
            frameRate: 20,
          },
        });
        if (!active) {
          media.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraTrack.current = media.getVideoTracks()[0] || null;
        setStream(media);
        Bridge.setStreaming(true);
        update("모니터링 기기 연결 대기 중");
        cameraPoll();
      } catch (error) {
        update(`카메라를 시작하지 못했습니다 · ${error.message}`);
      }
    }
    async function viewerStart() {
      clearTimeout(poll);
      clearTimeout(retry);
      clearTimeout(backgroundTimer);
      clearInterval(pipWatch);
      const attempt = ++generation;
      const oldOffer = offerId;
      offerId = "";
      closePeer();
      setStream(null);
      if (oldOffer)
        request(`/v1/offer/${oldOffer}`, { method: "DELETE" }).catch(() => {});
      try {
        update("공기계에 연결 중…");
        const status = await request("/v1/status");
        if (!active || attempt !== generation) return;
        if (status.id !== connection.id)
          throw Object.assign(
            new Error("등록된 공기계가 아닙니다. QR로 다시 등록하세요."),
            { status: 401 },
          );
        if (!status.ready)
          throw new Error(
            "공기계에서 촬영 시작을 눌러 주세요. 자동으로 다시 확인합니다.",
          );
        const current = new RTCPeerConnection({
          iceServers: [],
          candidateNetworkPolicy: "all",
          continualGatheringPolicy: "gather_continually",
        });
        peer = current;
        attach(current, viewerStart);
        current.addTransceiver("video", { direction: "recvonly" });
        excludeUnsupportedAv1(current);
        current.addEventListener("track", (event) => {
          if (!active || current !== peer) return;
          media = event.streams[0] || new MediaStream([event.track]);
          setStream(media);
        });
        const offer = await current.createOffer();
        const offerSdp = addBitrateHints(IS_TABLET ? stripVideoOrientation(offer.sdp) : offer.sdp);
        await current.setLocalDescription({ type: offer.type, sdp: offerSdp });
        const sdp = await description(current);
        if (!active || attempt !== generation) return;
        const result = await request("/v1/offer", { json: { sdp } });
        if (!active || attempt !== generation) return;
        offerId = result.id;
        let answered = false,
          waits = 0;
        const heartbeat = async () => {
          if (!active || attempt !== generation) return;
          try {
            const answer = await request(`/v1/answer/${result.id}`);
            if (!active || attempt !== generation) return;
            if (!answered && answer.sdp) {
              await current.setRemoteDescription({
                type: "answer",
                sdp: answer.sdp,
              });
              answered = true;
            }
            if (++waits > 35 && current.connectionState !== "connected")
              throw new Error("영상 경로를 다시 연결합니다.");
            poll = setTimeout(heartbeat, answered ? 2500 : 250);
          } catch (error) {
            if (active && attempt === generation) {
              update(error.message);
              retry = setTimeout(viewerStart, 4000);
            }
          }
        };
        heartbeat();
      } catch (error) {
        if (active && attempt === generation) {
          update(error.message || "Tailscale과 공기계 연결을 확인하세요.");
          if (error.status !== 401) retry = setTimeout(viewerStart, 5000);
        }
      }
    }
    if (camera) cameraStart();
    else viewerStart();
    return () => {
      active = false;
      cameraTrack.current = null;
      ++generation;
      controller.abort();
      clearTimeout(poll);
      clearTimeout(retry);
      subscription.remove();
      if (camera) Bridge.setStreaming(false);
      else if (offerId)
        directRequest(connection.origin, `/v1/offer/${offerId}`, {
          token: connection.token,
          method: "DELETE",
        }).catch(() => {});
      closePeer();
      media?.getTracks().forEach((track) => track.stop());
    };
  }, [camera, connection, onStop]);
  const turned = !camera && rotation % 180 !== 0;
  const videoViewport = viewport && turned ? { width: viewport.height, height: viewport.width } : viewport;
  const rotatedStyle = viewport && turned ? {
    position: "absolute", width: viewport.height, height: viewport.width,
    left: (viewport.width - viewport.height) / 2, top: (viewport.height - viewport.width) / 2,
    transform: [{ rotate: `${rotation}deg` }],
  } : [StyleSheet.absoluteFill, { transform: [{ rotate: `${rotation}deg` }] }];
  // 영상 회전은 영상 프레임 자체를 돌려서 그린다(videoRotation).
  // 안드로이드의 영상 화면(SurfaceView)은 부모 View의 회전을 따르지 않아, 부모를 돌리면 영상이 늘어나 보였다.
  const videoRotation = camera ? 0 : ((rotation % 360) + 360) % 360;
  // 원본 비율(contain): 실제로 그려지는 영상 크기·회전(돌린 각도 포함)으로 화면비를 구해 그 상자에 영상을 꽉 채운다.
  // PIP(compact)에서는 앱이 일시정지 상태라 화면 크기 변화가 JS로 늦게 전달된다. 이전 크기의 상자가 남으면
  // 영상이 잘린 채 축소돼 보이므로, PIP에서는 창 전체를 채우게 둔다. PIP 창 비율을 영상 비율로 열기 때문에 잘리지 않는다.
  const videoBox = !compact && fit === "contain" && frame && viewport ? containBox(frame, viewport) : null;
  return (
    <View style={styles.video} onLayout={(event) => setViewport(event.nativeEvent.layout)}>
      {stream && (
        <RTCView
          onDimensionsChange={(event) => {
            const { width, height, rotation: turn = 0 } = event.nativeEvent;
            setFrame((old) => old && old.width === width && old.height === height && old.turn === turn ? old : { width, height, turn });
          }}
          streamURL={stream.toURL()}
          videoRotation={videoRotation}
          style={videoBox || StyleSheet.absoluteFill}
          objectFit={videoBox || compact ? "cover" : fit}
          mirror={camera && frontCamera}
        />
      )}
      {/* 사람 박스는 일반 View라 회전 변환이 그대로 적용된다. 영상과 같은 각도로 돌려 위치를 맞춘다. */}
      <View pointerEvents="none" style={rotatedStyle}>
      {!compact && !camera && stream && person && videoViewport && (() => {
        const bounds = mapPersonBox(person, { width: person.frameWidth, height: person.frameHeight }, videoViewport, fit);
        return bounds ? <View pointerEvents="none" style={[styles.personBox, bounds]}><Text style={styles.personLabel}>사람</Text></View> : null;
      })()}
      </View>
      {camera && stream && <Pressable accessibilityRole="button" accessibilityLabel="전면 후면 카메라 전환" style={styles.switchCamera} onPress={async () => {
        if (switchingCamera.current) return;
        const track = cameraTrack.current;
        if (!track) return;
        switchingCamera.current = true;
        try {
          const nextFront = !frontCamera;
          await track.applyConstraints({ facingMode: nextFront ? "user" : "environment", width: 1280, height: 720, frameRate: 20 });
          if (cameraTrack.current === track) setFrontCamera(nextFront);
        } catch (error) { if (cameraTrack.current === track) setMessage(error.message || "카메라를 전환하지 못했습니다."); }
        finally { switchingCamera.current = false; }
      }}><Text style={styles.switchText}>전면 · 후면 전환</Text></Pressable>}
      {!compact && !camera && stream && !!detectionMessage && <Text pointerEvents="none" style={styles.detectionStatus}>{detectionMessage}</Text>}
      {camera && stream && fallRecording && <Text pointerEvents="none" style={styles.detectionStatus}>{fallMessage || "낙상 의심 감지 준비 중"}</Text>}
      {!compact && <View style={styles.status}>
        <Text style={styles.text}>{message}{IS_TABLET && frame ? ` · 영상 ${frame.width}x${frame.height} 회전 ${frame.turn} · 화면 ${Math.round(viewport?.width || 0)}x${Math.round(viewport?.height || 0)}` : ""}</Text>
      </View>}
    </View>
  );
});
export default DirectVideo;
const styles = StyleSheet.create({
  video: { flex: 1, backgroundColor: "#191b20", overflow: "hidden" },
  status: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#191b20e6",
  },
  text: {
    color: "#fff",
    fontFamily: "SUIT-Regular",
    fontSize: 13,
    lineHeight: 20,
  },
  switchCamera: { position: "absolute", top: 16, right: 16, backgroundColor: "#191b20e6", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  switchText: { color: "#fff", fontSize: 13, fontFamily: "SUIT-Medium" },
  personBox: { position: "absolute", borderColor: "#4C95F7", borderWidth: 2 },
  personLabel: { alignSelf: "flex-start", color: "#fff", backgroundColor: "#1765bd", paddingHorizontal: 6, paddingVertical: 2, fontSize: 12 },
  detectionStatus: { position: "absolute", top: 12, left: 12, color: "#fff", backgroundColor: "#191b20d9", paddingHorizontal: 8, paddingVertical: 5, fontSize: 12 },
});
