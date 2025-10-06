import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, WebSocket } from 'ws';

/**
 * this are the message shape used between the client and server:
 * Client sends:
 * { type: 'register', clientId: string } this is the message sent by a new client to register and connects to the websocket
 * { type: 'ack', shortenedURL: string } this is the message sent when a client acknowledges the shortnedUrl has been received from the server
 * Server sends: 
 * { type: 'shortened', shortenedURL: string } this is the message sent by the websocket server to client when a the url uploaded has been shortened
 * { type: 'registered', clientId: string } this is the message sent by the websocket server when a new user has registered successfully
 */

interface ClientSocket extends WebSocket {
  clientId?: string;
}

interface Delivery {
  acknowledged: boolean; //this is used to be sure a shortenedUrl has been delivered and acknowledged.
  timeouts: NodeJS.Timeout[]; //this stores the array of retries using exponential backoff with setTimeout 
  attempt: number; //this is the total number of attempts for this delivery
  clientId: string; //this is the clientId that the response is being sent to
}

@WebSocketGateway({ path: '/ws', cors: { origin: '*' } })
export class ShortenerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  //this map stores every client connected with the clientId being the key and the socket connection being the value
  private clients = new Map<string, ClientSocket>();
  
  //this map stores every shortenedUrl delivery with the shortenedUrl being the key and delivery metadata being the value
  private deliveries = new Map<string, Delivery>();

  //max attempts
  private readonly MAX_ATTEMPTS = 5;

  handleConnection(client: ClientSocket) {
    client.on('message', (raw) => this.onMessage(client, raw.toString()));
    client.on('close', () => {
      if (client.clientId) {
        this.clients.delete(client.clientId);
        console.log(`client ${client.clientId} disconnected`);
      }
    });
    console.log('ws: client connected');
  }

  handleDisconnect(client: ClientSocket) {
    if (client.clientId) this.clients.delete(client.clientId);
  }

  private sendJSON(client: ClientSocket, payload: any) {
    try {
      if (client && client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payload));
      }
    } catch (err) {
      console.error('ws send error', err);
    }
  }

  //this function is used to handle incoming messages from client
  private onMessage(client: ClientSocket, raw: string) {
    let msg: any;
    try {
      msg = JSON.parse(raw);
    } catch {
      console.warn('ws invalid json:', raw);
      return;
    }

    if (msg.type === 'register' && msg.clientId) {
      client.clientId = msg.clientId;
      this.clients.set(msg.clientId, client);
      this.sendJSON(client, { type: 'registered', clientId: msg.clientId });
      console.log(`ws: registered clientId=${msg.clientId}`);
      return;
    }

    if (msg.type === 'ack' && msg.shortenedURL) {
      this.handleAck(msg.shortenedURL);
      return;
    }

  }


  //this function sends shortenedURL reliably to the client by calling the attemptSend function
  sendShortenedURL(clientId: string, shortenedURL: string) {
    const client = this.clients.get(clientId);

    const delivery: Delivery = {
      acknowledged: false,
      timeouts: [],
      attempt: 0,
      clientId,
    };

    this.deliveries.set(shortenedURL, delivery);

    // initial send now
    this.attemptSend(clientId, shortenedURL);
  }

  //this function sends shortenedURL reliably to the client by  matching clientId it retries until ack is received or until MAX_ATTEMPTS is reached 
  private async attemptSend(clientId: string, shortenedURL: string) {
      const existingDelivery = this.deliveries.get(shortenedURL);
      if (!existingDelivery) return; //delivery has been cleaned up or already acked
      if (existingDelivery.acknowledged) {
        //delivery has already acked and we can delete the delivery data
        this.cleanupDelivery(shortenedURL);
        return;
      }

      existingDelivery.attempt += 1;
      const sock = this.clients.get(clientId);

      if (sock && sock.readyState === WebSocket.OPEN) {
        this.sendJSON(sock, { type: 'shortened', shortenedURL, attempt: existingDelivery.attempt });
        console.log(`Sent shortenedURL=${shortenedURL} to client=${clientId} (attempt ${existingDelivery.attempt})`);
      } else {
        console.warn(`Client ${clientId} not connected (attempt ${existingDelivery.attempt})`);
      }

      if (existingDelivery.attempt >= this.MAX_ATTEMPTS) {
        //stop retrying max limit reached.
        console.error(`Failed to deliver ${shortenedURL} to ${clientId} after ${existingDelivery.attempt} attempts`);
        //delete delivery data
        this.cleanupDelivery(shortenedURL);
        return;
      }

      //here we schedule next attempt with exponential backoff to avoid being rate limited (if in a real world scenario)
      const delayMs = Math.pow(2, existingDelivery.attempt) * 1000;
      const to = setTimeout(() => this.attemptSend(clientId, shortenedURL), delayMs);
      existingDelivery.timeouts.push(to);
    };

  //this function handles ACK received from client over WS and it stops any further retries for that shortenedURL
  handleAck(shortenedURL: string) {
    const delivery = this.deliveries.get(shortenedURL);
    if (!delivery) {
      console.log(`ACK for unknown or already handled shortenedURL=${shortenedURL}`);
      return;
    }

    delivery.acknowledged = true;
    //clear timeouts to avoid future retries
    delivery.timeouts.forEach(clearTimeout);
    this.deliveries.delete(shortenedURL);
    console.log(`ACK received. Stopped retries for ${shortenedURL}`);
  }

  //this function is used to cleanup the delivery data for every shortened URL request.
  private cleanupDelivery(shortenedURL: string) {
    const d = this.deliveries.get(shortenedURL);
    if (!d) return;
    d.timeouts.forEach(clearTimeout);
    this.deliveries.delete(shortenedURL);
  }
}
