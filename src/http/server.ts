import express from "express";
import type { postTopicReq } from "../models/httpReq.js";
import { globalQueue, topicExists } from "../store.js";
import type { consumerGroup, event, Subscriber } from "../store.js";


export function startHTTPServer(){

    const app = express()

    app.use(express.json())


    app.get('/', (req, res) => {
        res.status(200).send({ msg: "nice" });

    })

    app.post('/topics', (req, res) => {
        const body: postTopicReq = req.body;

        const topic = body.topic;
        const mode = body.mode;

        if (!topic) {
            return res.status(400).json({ status: "error", msg: "topic required" });
        }

        let valid, _ = topicExists(topic);

        if(valid){
            res.status(403).json({status : "error", msg : "topic already exists"});
        }
        else{
            globalQueue.push({ topic: topic, queue: Array<event>(), group: Array<consumerGroup>(), nextId : 0, mode :  mode});
            res.status(201).json({status : "ok", msg : "topic created now"});                
        }

    });

    app.get('/topics', (req, res)=>{
        let data = "";
        globalQueue.forEach((e)=>{
            data += e.topic;
            data += "\t";
        })

        res.status(200).json({status : "ok", topics : data});
    });




    app.listen(3000, () => {
        console.log("Express Server running on port 3000");
    });

}
