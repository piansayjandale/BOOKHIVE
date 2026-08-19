import http from "http";
import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initSocketServer } from "./socket.js";

const app = createApp();
const server = http.createServer(app);

initSocketServer(server);

server.listen(env.port, "0.0.0.0", () => {
  console.log(`BookHive Express API & Socket.io listening on port ${env.port} (0.0.0.0)`);
});

