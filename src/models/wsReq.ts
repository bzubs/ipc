export interface Request {
    requestType : string
}


export interface pubRequest extends Request {
    requestType : "PUBLISH"
    topic : string
    message : string
}

export interface subRequest extends Request {
    requestType : "SUBSCRIBE"
    consumerId : string
    groupId : string
    topic : string
    fromEventId : number
}

export interface ackRequest extends Request {
  requestType : "ACK"
  consumerId : string
  groupId : string
  topic : string
  eventId : number  
}

