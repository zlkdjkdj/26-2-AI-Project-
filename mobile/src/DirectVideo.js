import { useEffect, useState } from "react";
import { AppState, StyleSheet, Text, View } from "react-native";
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

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function description(peer) {
  for (let i = 0; i < 100; i++) {
    if (peer.connectionState === "closed")
      throw new Error("영상 연결이 종료되었습니다.");
    if (
      peer.iceGatheringState === "complete" &&
      hasTailnetCandidate(peer.localDescription?.sdp || "")
    )
      break;
    await pause(100);
  }
  const network = await Bridge.networkStatus();
  return tailnetSdp(peer.localDescription.sdp, network);
}

// Each mounted session owns and closes its peer and media tracks.
export default function DirectVideo({
  camera,
  connection,
  fit = "contain",
  onStop,
}) {
  useKeepAwake();
  const [stream, setStream] = useState(null);
  const [message, setMessage] = useState("영상 준비 중…");
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
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") onStop();
    });
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
          const sdp = await description(current);
          if (active && current === peer) Bridge.setAnswer(offer.id, sdp);
        }
      } catch (error) {
        update(error.message);
      }
      if (active) poll = setTimeout(cameraPoll, 800);
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
        await current.setLocalDescription(await current.createOffer());
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
            poll = setTimeout(heartbeat, answered ? 2500 : 800);
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
  return (
    <View style={styles.video}>
      {stream && (
        <RTCView
          streamURL={stream.toURL()}
          style={StyleSheet.absoluteFill}
          objectFit={fit}
        />
      )}
      <View style={styles.status}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  video: { flex: 1, backgroundColor: "#18211d", overflow: "hidden" },
  status: {
    position: "absolute",
    bottom: 16,
    left: 16,
    right: 16,
    padding: 12,
    borderRadius: 8,
    backgroundColor: "#18211de6",
  },
  text: {
    color: "#fff",
    fontFamily: "SUIT-Regular",
    fontSize: 13,
    lineHeight: 20,
  },
});
