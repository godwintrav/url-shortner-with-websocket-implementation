import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface Delivery {
  acknowledged: boolean; //this is used to be sure a shortenedUrl has been delivered and acknowledged.
  timeouts: NodeJS.Timeout[]; //this stores the array of retries using exponential backoff with setTimeout
  attempt: number; //this is the total number of attempts for this delivery
  clientId: string; //this is the clientId that the response is being sent to
}

@WebSocketGateway({
  cors: { origin: '*' },
})
export class ShortenerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  //this map stores every client connected with the clientId being the key and the socket connection being the value: Map clientId -> socket
  private clients = new Map<string, Socket>();

  //this map stores every shortenedUrl delivery with the shortenedUrl being the key and delivery metadata being the value: Map shortenedURL -> delivery metadata
  private deliveries = new Map<string, Delivery>();

  private readonly MAX_ATTEMPTS = 5;

  handleConnection(socket: Socket) {
    console.log(`Socket.IO: client connected: ${socket.id}`);
  }

  handleDisconnect(socket: Socket) {
    for (const [clientId, s] of this.clients.entries()) {
      if (s.id === socket.id) {
        this.clients.delete(clientId);
        console.log(`Socket.IO: client disconnected: ${clientId}`);
        break;
      }
    }
  }

  //Client registers itself by sending its clientId
  @SubscribeMessage('register')
  handleRegister(@ConnectedSocket() socket: Socket, @MessageBody() data: { clientId: string }) {
    const { clientId } = data;
    if (!clientId) return;

    this.clients.set(clientId, socket);
    console.log(`Registered clientId=${clientId} with socket.id=${socket.id}`);

    //Acknowledge registration
    socket.emit('registered', { clientId });
  }

  //Client acknowledges receipt of shortened URL so we can stop every retry
  @SubscribeMessage('ack')
  handleAck(@MessageBody() data: { shortenedURL: string }) {
    const { shortenedURL } = data;
    if (!shortenedURL) return;

    const delivery = this.deliveries.get(shortenedURL);
    if (!delivery) {
      console.log(`ACK for unknown or already handled shortenedURL=${shortenedURL}`);
      return;
    }

    delivery.acknowledged = true;
    delivery.timeouts.forEach(clearTimeout);
    this.deliveries.delete(shortenedURL);
    console.log(`ACK received. Stopped retries for ${shortenedURL}`);
  }

  /**
   * Send shortened URL reliably to a client
   */
  sendShortenedURL(clientId: string, shortenedURL: string) {
    const socket = this.clients.get(clientId);
    if (!socket) {
      console.warn(`Cannot send shortenedURL. Client ${clientId} not connected.`);
      return;
    }

    const delivery: Delivery = {
      acknowledged: false,
      timeouts: [],
      attempt: 0,
      clientId,
    };

    this.deliveries.set(shortenedURL, delivery);

    this.attemptSend(clientId, shortenedURL);
  }

  //this function sends shortenedURL reliably to the client by matching clientId it retries until ack is received or until MAX_ATTEMPTS is reached
  private attemptSend(clientId: string, shortenedURL: string) {
    const delivery = this.deliveries.get(shortenedURL);
    if (!delivery) return;
    if (delivery.acknowledged) {
      this.cleanupDelivery(shortenedURL);
      return;
    }

    delivery.attempt += 1;
    const socket = this.clients.get(clientId);

    if (socket) {
      socket.emit('shortened', { shortenedURL });
      console.log(
        `Sent shortenedURL=${shortenedURL} to client=${clientId} (attempt ${delivery.attempt})`,
      );
    } else {
      console.warn(`Client ${clientId} not connected (attempt ${delivery.attempt})`);
    }

    if (delivery.attempt >= this.MAX_ATTEMPTS) {
      console.error(
        `Failed to deliver ${shortenedURL} to ${clientId} after ${delivery.attempt} attempts`,
      );
      this.cleanupDelivery(shortenedURL);
      return;
    }

    //here we schedule next attempt with exponential backoff to avoid being rate limited (if in a real world scenario)
    const delayMs = Math.pow(2, delivery.attempt) * 1000;
    const to = setTimeout(() => this.attemptSend(clientId, shortenedURL), delayMs);
    delivery.timeouts.push(to);
  }

  private cleanupDelivery(shortenedURL: string) {
    const exisitingDelivery = this.deliveries.get(shortenedURL);
    if (!exisitingDelivery) return;
    exisitingDelivery.timeouts.forEach(clearTimeout);
    this.deliveries.delete(shortenedURL);
  }
}
