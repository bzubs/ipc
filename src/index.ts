import { startWSServer } from "./ws/server.js";
import { startHTTPServer } from "./http/server.js";


startHTTPServer();
startWSServer();

console.log("Started WebSocket and HTTP server");
