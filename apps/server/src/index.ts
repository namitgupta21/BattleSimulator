import { createServer } from "./server/app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const HOST = process.env.HOST || "0.0.0.0";
const { httpServer } = createServer();

httpServer.listen(PORT, HOST, () => {
  console.log(`[Pokemon Battle Server] Listening on ${HOST}:${PORT}`);
});
