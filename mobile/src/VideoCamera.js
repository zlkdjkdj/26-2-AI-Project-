import { useEffect, useRef, useState } from "react";
import { AppState, StyleSheet } from "react-native";
import { RTCView, RTCPeerConnection, mediaDevices } from "react-native-webrtc";
import { useKeepAwake } from "expo-keep-awake";
import { cameraRequest } from "./api";
import { excludeUnsupportedAv1 } from './videoCodecs';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function gather(pc) {
  for (let i = 0; i < 60 && pc.iceGatheringState !== "complete"; i++)
    await sleep(100);
}

export default function VideoCamera({
  connection,
  onStop,
  onExpired,
  onUpdate,
}) {
  useKeepAwake();
  const callbacks = useRef({ onStop, onExpired, onUpdate });
  useEffect(() => {
    callbacks.current = { onStop, onExpired, onUpdate };
  });
  const [stream, setStream] = useState(null);
  useEffect(() => {
    let active = true,
      media,
      peer,
      lastId,
      timer;
    const token = connection.device_token;
    const get = (path) =>
      cameraRequest(connection.server, path, { token, method: "GET" });
    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active") callbacks.current.onStop();
    });
    async function poll() {
      if (!active) return;
      try {
        const offer = await get("/api/homecam/device/video/offer");
        if (!active) return;
        if (offer.exchange_id && offer.exchange_id !== lastId) {
          peer?.close();
          const config = await get("/api/homecam/device/video/ice");
          if (!active) return;
          peer = new RTCPeerConnection(config);
          media.getTracks().forEach((track) => peer.addTrack(track, media));
          peer.addEventListener("connectionstatechange", () => {
            if (active)
              callbacks.current.onUpdate({
                message: `영상 연결: ${peer.connectionState}`,
              });
          });
          await peer.setRemoteDescription({ type: "offer", sdp: offer.sdp });
          excludeUnsupportedAv1(peer);
          const answer = await peer.createAnswer();
          await peer.setLocalDescription(answer);
          await gather(peer);
          if (!active) return;
          await cameraRequest(
            connection.server,
            "/api/homecam/device/video/answer",
            {
              token,
              json: {
                exchange_id: offer.exchange_id,
                sdp: peer.localDescription.sdp,
              },
            },
          );
          lastId = offer.exchange_id;
        }
      } catch (error) {
        if (active && error.status === 401) {
          callbacks.current.onExpired();
          return;
        }
        if (active)
          callbacks.current.onUpdate({
            message: `영상 연결 대기 · ${error.message}`,
          });
      }
      if (active) timer = setTimeout(poll, 2000);
    }
    async function start() {
      try {
        media = await mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: "environment",
            width: 960,
            height: 720,
            frameRate: 15,
          },
        });
        if (!active) {
          media.getTracks().forEach((track) => track.stop());
          return;
        }
        setStream(media);
        callbacks.current.onUpdate({
          message: "웹에서 영상 연결을 기다리고 있습니다.",
        });
        poll();
      } catch (error) {
        if (active) {
          callbacks.current.onStop();
          callbacks.current.onUpdate({
            message: `카메라 시작 실패 · ${error.message}`,
          });
        }
      }
    }
    start();
    return () => {
      active = false;
      clearTimeout(timer);
      sub.remove();
      peer?.close();
      media?.getTracks().forEach((track) => track.stop());
    };
  }, [connection]);
  return stream ? (
    <RTCView
      streamURL={stream.toURL()}
      style={StyleSheet.absoluteFill}
      objectFit="cover"
    />
  ) : null;
}
