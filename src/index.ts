import { WebSocketServer, WebSocket } from "ws"
import type { Request, pubRequest, subRequest, ackRequest } from "./models/requests.js";

let count: number = 0;

type event = {
    id: number,
    status: string
    message: string

}

type Subscriber = {
    consumerId: string
    socket: WebSocket,
    topic: string
    lastEventId: number
}


type topicQueue = {
    topic: string,
    queue: Array<event>
    subs: Array<Subscriber>
}


let globalQueue: Array<topicQueue> = new Array<topicQueue>();

const wss = new WebSocketServer({ port: 8080 });

function topicExists(topic: string) {
    const found = globalQueue.find(el => el.topic === topic);

    if (found) {
        return { valid: true, object: found };
    }
    return { valid: false, object: null };
}



wss.on('connection', (socket) => {

    socket.on('message', (msg) => {
        const data = msg.toString();

        // console.log("Raw:", data);

        const parsed: Request = JSON.parse(data);
        console.log("Parsed:", parsed);

        if (parsed.requestType === "SUBSCRIBE") {



            const parsed: subRequest = JSON.parse(data);
            console.log("Parsed:", parsed);



            console.log("Subscribing to:", parsed.topic);

            let res = topicExists(parsed.topic)


            let isTopic: boolean = res.valid;
            let object = res.object;

            if (isTopic && object) {
                let element: topicQueue = object;
                let subscriber = element.subs.find(s => s.consumerId === parsed.consumerId);
                if (subscriber) {
                    subscriber.socket = socket;
                    element.queue.forEach((e) => {
                        if (e.id > subscriber.lastEventId) {
                            e.status = "IN-FLIGHT";
                            subscriber.socket.send(JSON.stringify(e));
                        }
                    })
                }
                else {
                    let element: topicQueue = object;
                    element.subs.push({ consumerId: parsed.consumerId, socket: socket, topic: parsed.topic, lastEventId: -1 });
                    socket.send(JSON.stringify({
                        status: "ok",
                        msg: "subsrcibed"
                    }));

                    let subscriber = element.subs.find(s => s.consumerId === parsed.consumerId);
                    if (subscriber) {
                        element.queue.forEach((e) => {
                            if (e.id > subscriber.lastEventId)
                                e.status = "IN-FLIGHT";
                            subscriber.socket.send(JSON.stringify(e));
                        });
                    }
                }




            }
            else {
                socket.send(JSON.stringify({
                    status: "failed",
                    msg: "no such topic"
                }))
            }



        }

        if (parsed.requestType === "PUBLISH") {

            const parsed: pubRequest = JSON.parse(data);
            console.log("Parsed:", parsed);

            globalQueue.push({ topic: parsed.topic, queue: Array<event>(), subs: Array<Subscriber>() })
            socket.send(JSON.stringify({
                status: "ok",
                msg: "topic published now"
            }));

            let eve: event = { id: count++, status: "PENDING", message: parsed.message }
            let element: topicQueue;

            let res = topicExists(parsed.topic)

            if (res.valid && res.object) {
                element = res.object;
                element.queue.push(eve);
                element.subs.forEach((s) => {

                    element.queue.forEach((e) => {
                        if (e.id > s.lastEventId) {
                            e.status = "IN-FLIGHT"
                            s.socket.send(JSON.stringify(e));

                        }

                    })


                });

            }

        }

        if (parsed.requestType === "ACK") {

            const parsed: ackRequest = JSON.parse(data)

            let res = topicExists(parsed.topic)

            if (res.valid && res.object) {

                let element = res.object;

                const event = element.queue.find(e => e.id === parsed.eventid);
                const subscriber = element.subs.find(s => s.consumerId === parsed.consumerId)

                if (event) {
                    event.status = "ACKNOWLEDGED";
                }
                if (subscriber) {
                    subscriber.lastEventId = parsed.eventid
                }


            }

        }

    })

});




