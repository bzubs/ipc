import { WebSocket } from "ws"

type event = {
  id: number;
  message: string;
  status: Record<string, "PENDING" | "IN-FLIGHT" | "ACK">; 
  // key = groupId
}

export type Subscriber = {
    consumerId: string
    socket: WebSocket
    topic: string
    lastEventId: number
}

export type consumerGroup = {
    groupId : string
    subs: Array<Subscriber>
    lastEventId: number
    rrIndex: number 
}

export type topicQueue = {
    topic: string
    queue: Array<event>
    group : Array<consumerGroup>
    nextId : number
}

export function topicExists(topic: string) {
    const found = globalQueue.find(el => el.topic === topic);

    if (found) {
        return { valid: true, object: found };
    }
    return { valid: false, object: null };
}

export let globalQueue: Array<topicQueue> = new Array<topicQueue>();
