import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // expose sur le LAN pour tester depuis un telephone
    port: 5173,
  },
});
