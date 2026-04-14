import { WebSocketServer, WebSocket } from "ws"
import type {Request} from "./models/requests.js";



type event = {
    status : string
    message : string

}

type Subscriber = {
    socket : WebSocket,
    topic : string
}


type topicQueue = {
    topic: string,
    queue : Array<event>
    subs : Array<Subscriber>
}


let globalQueue : Array<topicQueue> = new Array<topicQueue>();

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
        try {

            const data = msg.toString();

            // console.log("Raw:", data);

            const parsed: Request = JSON.parse(data);

            console.log("Parsed:", parsed);

            if (parsed.requestType === "SUBSCRIBE") {
                console.log("Subscribing to:", parsed.topic);

                let res = topicExists(parsed.topic)


                let isTopic: boolean = res.valid;
                let object = res.object;

                if(isTopic){
                    if(object){
                        let element: topicQueue = object;
                        element.subs.push({ socket: socket, topic: parsed.topic });
                        socket.send(JSON.stringify({
                            status: "ok",
                            msg: "subsrcibed"
                        }));

                    }
                    

                }
                else{
                    socket.send(JSON.stringify({
                        status : "failed",
                        msg : "no such topic"
                    }))
                }
                


            }

            if(parsed.requestType==="PUBLISH") {
                
                
                    globalQueue.push({topic: parsed.topic, queue : Array<event>(), subs : Array<Subscriber>()})
                    socket.send(JSON.stringify({
                        status : "ok",
                        msg : "topic published now"
                    }));

                    let eve : event = {status: "init", message: parsed.message}
                    let element : topicQueue;

                    let res2 = topicExists(parsed.topic)

                    if(res2.valid && res2.object){
                        element = res2.object;
                        element.queue.push(eve);
                        element.subs.forEach((s)=>{

                            element.queue.forEach((e)=>{
                                s.socket.send(JSON.stringify(e));
                            })


                        });

                    }
                
            }

            
        } catch (err) {
            console.error("Invalid message:", err);

            socket.send(JSON.stringify({
                status: "error",
                message: "Invalid JSON format"
            }));
        }

    })

});




