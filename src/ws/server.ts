import { WebSocketServer } from "ws"
import type { Request, pubRequest, subRequest, ackRequest } from "../models/wsReq.js";
import type { topicQueue, event } from "../store.js"
import { globalQueue, topicExists } from "../store.js";

export function startWSServer() {

    const wss = new WebSocketServer({ port: 8080 });

    function safeSend(socket: any, payload: any) {
        if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify(payload));
        }
    }

    wss.on('connection', (socket) => {

        //cleanup dead sockets
        socket.on('close', () => {
            globalQueue.forEach(topic => {
                topic.group.forEach(g=>{
                    g.subs = g.subs.filter(s => s.socket !== socket);

                })
            });
        });

        socket.on('message', (msg) => {
            const data = msg.toString();

            let base: Request;
            try {
                base = JSON.parse(data);
            } catch {
                safeSend(socket, { status: "error", msg: "invalid JSON" });
                return;
            }

            // guard request type
            if (!["SUBSCRIBE", "PUBLISH", "ACK"].includes(base.requestType)) {
                safeSend(socket, { status: "error", msg: "invalid request type" });
                return;
            }

            console.log("Parsed:", base);

            //----------------SUBSCRIBE------------------
            if (base.requestType === "SUBSCRIBE") {

                const parsed = base as subRequest;

                console.log("Subscribing to:", parsed.topic);

                let res = topicExists(parsed.topic)

                if (res.valid && res.object) {
                    let element: topicQueue = res.object;

                    let group = element.group.find(g=> g.groupId === parsed.groupId)

                    let subscriber = group?.subs.find(s => s.consumerId === parsed.consumerId);

                    if (subscriber) {
                        // update socket on reconnect
                        subscriber.socket = socket;

                        element.queue.forEach((e) => {
                            if (e.id > subscriber.lastEventId) {
                                e.status = "IN-FLIGHT";
                                safeSend(subscriber.socket, e);
                            }
                        });

                    } else {
                        group?.subs.push({
                            consumerId: parsed.consumerId,
                            socket: socket,
                            topic: parsed.topic,
                            lastEventId: -1
                        });

                        safeSend(socket, {
                            status: "ok",
                            msg: "subscribed"
                        });

                        let subscriber = element.group.subs.find(s => s.consumerId === parsed.consumerId);

                        if (subscriber) {
                            element.queue.forEach((e) => {
                                if (e.id > subscriber.lastEventId) {
                                    e.status = "IN-FLIGHT";
                                    safeSend(subscriber.socket, e);
                                }
                            });
                        }
                    }

                } else {
                    safeSend(socket, {
                        status: "failed",
                        msg: "no such topic"
                    });
                }
            }

            //------------------ PUBLISH -----------------
            if (base.requestType === "PUBLISH") {

                const parsed = base as pubRequest;

                let res = topicExists(parsed.topic)

                if (!res.valid) {
                    safeSend(socket, {
                        status: "error",
                        msg: "topic doesnt exist, create one first"
                    });
                    return;
                }

                if (res.object) {
                    let element: topicQueue = res.object;

                    // per-topic ID (minimal change, no type edit)
                    if(element.queue.length === 0) {
                        element.nextId = 0;
                    }

                    let eve: event = {
                        id: element.nextId++,
                        status: "PENDING",
                        message: parsed.message
                    };

                    element.queue.push(eve);

                    element.group.subs.forEach((s) => {

                        const pending = element.queue.filter(e => e.id > s.lastEventId);

                        pending.forEach((e) => {
                            e.status = "IN-FLIGHT";
                            safeSend(s.socket, e);
                        });

                    });

                    safeSend(socket, { status: "ok", msg: "event published now" });
                }
            }

            // ----------------- ACK ----------------------
            if (base.requestType === "ACK") {

                const parsed = base as ackRequest;

                let res = topicExists(parsed.topic)

                if (res.valid && res.object) {

                    let element = res.object;

                    const event = element.queue.find(e => e.id === parsed.eventid);
                    const subscriber = element.group.subs.find(s => s.consumerId === parsed.consumerId);

                    if (!event) {
                        safeSend(socket, { status: "error", msg: "event not found" });
                        return;
                    }

                    event.status = "ACKNOWLEDGED";

                    if (subscriber) {
                        subscriber.lastEventId = parsed.eventid;
                    }

                    safeSend(socket, { status: "ok", msg: "ACK accepted" });
                }
            }

        });

    });

    console.log("WebSocket Server running on port 8080");
}