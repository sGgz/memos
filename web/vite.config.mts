import react from "@vitejs/plugin-react";
import http from "node:http";
import { resolve } from "path";
import type { Plugin, ProxyOptions } from "vite";
import { defineConfig } from "vite";
import tailwindcss from "@tailwindcss/vite";

let devProxyServer = "http://localhost:13388";
if (process.env.DEV_PROXY_SERVER && process.env.DEV_PROXY_SERVER.length > 0) {
  console.log("Use devProxyServer from environment: ", process.env.DEV_PROXY_SERVER);
  devProxyServer = process.env.DEV_PROXY_SERVER;
}

const createBackendProxy = (): ProxyOptions => ({
  target: devProxyServer,
  xfwd: true,
});

const connectProxyPlugin = (): Plugin => ({
  name: "connect-proxy-plugin",
  configureServer: (server) => {
    server.middlewares.use((req, res, next) => {
      if (!req.url || !req.url.startsWith("/memos.api.v1")) {
        next();
        return;
      }

      const target = new URL(req.url, devProxyServer);
      const proxyRequest = http.request(target, {
        headers: req.headers,
        method: req.method,
      });

      proxyRequest.on("response", (proxyResponse) => {
        res.writeHead(proxyResponse.statusCode ?? 500, proxyResponse.headers);
        proxyResponse.pipe(res);
      });

      proxyRequest.on("error", (error) => {
        if ((error as NodeJS.ErrnoException).code !== "ECONNREFUSED") {
          console.error(`[dev-proxy] ${req.method ?? "UNKNOWN"} ${req.url}`, error);
        }
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Proxy error");
      });

      req.pipe(proxyRequest);
    });
  },
});

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), connectProxyPlugin()],
  server: {
    host: "0.0.0.0",
    port: 3001,
    proxy: {
      "^/api": createBackendProxy(),
      "^/file": createBackendProxy(),
    },
  },
  resolve: {
    alias: {
      "@/": `${resolve(__dirname, "src")}/`,
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          "utils-vendor": ["dayjs", "lodash-es"],
          "mermaid-vendor": ["mermaid"],
          "leaflet-vendor": ["leaflet", "react-leaflet"],
        },
      },
    },
  },
});
