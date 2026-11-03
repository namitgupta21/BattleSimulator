import { createServer } from "./server/app.js";

const PORT = parseInt(process.env.PORT || "3000", 10);
const { httpServer } = createServer();

httpServer.listen(PORT, () => {
  console.log(`[Pokemon Battle Server] Listening on port ${PORT}`);
});
