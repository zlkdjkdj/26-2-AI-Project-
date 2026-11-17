import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

// mobile/src의 순수 JS(규칙·점수·피드백)를 복사하지 않고 그대로 공유한다. mobile 쪽은 수정하지 않는다.
const shared = fileURLToPath(new URL("../mobile/src", import.meta.url));

export default defineConfig({
  base: process.env.VITE_BASE || "/",
  plugins: [react()],
  resolve: { alias: { "@shared": shared } },
  server: { fs: { allow: [".."] } },
  build: { chunkSizeWarningLimit: 1500 },
});
