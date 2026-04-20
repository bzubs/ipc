import type { Request } from "express";

export type MODE  = "fanout" | "queue"

export interface postTopicReq extends Request {
    topic : string
    mode : MODE
}