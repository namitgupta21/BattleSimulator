import { createServer } from "./server/app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const { httpServer, io, socketHandler } = createServer();

let isShuttingDown = false;

httpServer.listen(PORT, HOST, () => {
  const version = process.env.GIT_SHA || "dev";
  console.log(`[Pokemon Battle Server] Listening on ${HOST}:${PORT} (version: ${version})`);
});

function gracefulShutdown(signal: string) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`[Pokemon Battle Server] Received ${signal}. Initiating graceful shutdown...`);

  // 1. Stop accepting new rooms in socket handler
  socketHandler.setShuttingDown(true);

  // 2. Notify all connected clients of impending restart
  io.emit("server:shutdown", {
    message: "Server is restarting for maintenance. Active battles have concluded.",
  });

  // 3. Stop accepting new HTTP/WS connections
  httpServer.close(() => {
    console.log("[Pokemon Battle Server] HTTP connection listener closed.");
    // 4. Disconnect remaining sockets
    io.close(() => {
      console.log("[Pokemon Battle Server] Socket.IO closed. Terminating process cleanly.");
      process.exit(0);
    });
  });

  // 5. Force termination if graceful drain does not complete within 5 seconds
  setTimeout(() => {
    console.warn("[Pokemon Battle Server] Forcing exit after shutdown timeout.");
    process.exit(0);
  }, 5000).unref();
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));
