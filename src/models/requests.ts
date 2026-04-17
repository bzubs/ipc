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
    topic : string
}

export interface ackRequest extends Request {
  requestType : "ACK"
  consumerId : string
  topic : string
  eventid : number  
}

