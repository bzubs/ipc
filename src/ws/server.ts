import { WebSocketServer } from "ws";
import type { Request, pubRequest, subRequest, ackRequest } from "../models/wsReq.js";
import type { topicQueue, event } from "../store.js";
import { globalQueue, topicExists } from "../store.js";

export function startWSServer() {

    const wss = new WebSocketServer({ port: 8080 });

    function safeSend(socket: any, payload: any) {
        if (socket.readyState === socket.OPEN && socket.bufferedAmount < 1e6) {
            socket.send(JSON.stringify(payload));
        }
    }

    wss.on("connection", (socket) => {

        // cleanup dead sockets
        socket.on("close", () => {
            globalQueue.forEach(topic => {
                topic.group.forEach(g => {
                    g.subs = g.subs.filter(s => s.socket !== socket);
                });
            });
        });

        socket.on("message", (msg) => {
            let base: Request;

            try {
                base = JSON.parse(msg.toString());
            } catch {
                safeSend(socket, { status: "error", msg: "invalid JSON" });
                return;
            }

            if (!["SUBSCRIBE", "PUBLISH", "ACK"].includes(base.requestType)) {
                safeSend(socket, { status: "error", msg: "invalid request type" });
                return;
            }

            //---------------- SUBSCRIBE ----------------
            if (base.requestType === "SUBSCRIBE") {
                const parsed = base as subRequest;
                const res = topicExists(parsed.topic);

                if (!res.valid || !res.object) {
                    safeSend(socket, { status: "error", msg: "no such topic" });
                    return;
                }

                const element = res.object;
                const group = element.group.find(g => g.groupId === parsed.groupId);

                if (!group) {
                    safeSend(socket, { status: "error", msg: "invalid group" });
                    return;
                }

                let subscriber = group.subs.find(s => s.consumerId === parsed.consumerId);

                if (!subscriber) {
                    subscriber = {
                        consumerId: parsed.consumerId,
                        socket,
                        topic: parsed.topic,
                        lastEventId: -1
                    };
                    group.subs.push(subscriber);

                    safeSend(socket, { status: "ok", msg: "subscribed" });
                } else {
                    subscriber.socket = socket; // reconnect
                }

                // replay ONLY for fanout
                if (element.mode === "fanout") {
                    element.queue.forEach(e => {
                        if (
                            e.id > subscriber!.lastEventId &&
                            e.status[group.groupId] !== "ACK"
                        ) {
                            e.status[group.groupId] = "IN-FLIGHT";
                            safeSend(subscriber!.socket, e);
                        }
                    });
                }
            }

            //---------------- PUBLISH ----------------
            if (base.requestType === "PUBLISH") {
                const parsed = base as pubRequest;
                const res = topicExists(parsed.topic);

                if (!res.valid || !res.object) {
                    safeSend(socket, { status: "error", msg: "topic not found" });
                    return;
                }

                const element = res.object;

                if (element.queue.length === 0) element.nextId = 0;

                const eve: event = {
                    id: element.nextId++,
                    message: parsed.message,
                    status: {}
                };

                // initialize status
                element.group.forEach(g => {
                    eve.status[g.groupId] = "PENDING";
                });

                element.queue.push(eve);

                // FANOUT
                if (element.mode === "fanout") {
                    element.group.forEach(g => {
                        g.subs.forEach(s => {
                            eve.status[g.groupId] = "IN-FLIGHT";
                            safeSend(s.socket, eve);
                        });
                    });
                }

                // QUEUE (consumer groups)
                else if (element.mode === "queue") {
                    element.group.forEach(g => {
                        if (g.subs.length === 0) return;

                        const idx = g.rrIndex % g.subs.length;
                        const sub = g.subs[idx];
                        g.rrIndex++;

                        eve.status[g.groupId] = "IN-FLIGHT";
                        if (sub) safeSend(sub.socket, eve);
                    });
                }

                safeSend(socket, { status: "ok", msg: "published", id: eve.id });
            }

            //---------------- ACK ----------------
            if (base.requestType === "ACK") {
                const parsed = base as ackRequest;
                const res = topicExists(parsed.topic);

                if (!res.valid || !res.object) {
                    safeSend(socket, { status: "error", msg: "topic not found" });
                    return;
                }

                const element = res.object;
                const event = element.queue.find(e => e.id === parsed.eventid);

                if (!event) {
                    safeSend(socket, { status: "error", msg: "event not found" });
                    return;
                }

                const group = element.group.find(g => g.groupId === parsed.groupId);
                const subscriber = group?.subs.find(s => s.consumerId === parsed.consumerId);

                if (subscriber) {
                    subscriber.lastEventId = parsed.eventid;
                }

                event.status[parsed.groupId] = "ACK";

                safeSend(socket, { status: "ok", msg: "ACK accepted" });
            }

        });
    });

    
    console.log("WebSocket Server running on port 8080");
}