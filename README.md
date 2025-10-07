# URL Shortener with Reliable Async Delivery (NestJS + Socket.IO)

## Overview

This project implements a URL Shortener server that receives a URL by an HTTP POST request, generates a shortened URL, and returns the shortened URL to the client asynchronously using a WebSocket (Socket.IO) connection and not using the HTTP response.


The server ensures reliable delivery of the shortened URL, supports client acknowledgment, and retries delivery if acknowledgment is not received from the websocket connection of the client.

This solution is built using:

- NestJS for the application framework.
- Socket.IO for bi-directional real-time communication.
- In-memory Maps for persistence (task requirement says no DB).


## Features

- Asynchronous shortened URL delivery over WebSocket (Socket.IO).
- Reliable delivery with exponential backoff retry strategy.
- Client acknowledgment protocol to confirm delivery.
- Retry termination after max attempts (5 tries).
- Shortened URLs accessible via standard HTTP GET.
- Scalable and production ready design that can easily integrate Redis or other adapters for horizontal scaling.
- Complete unit test coverage.


## Architecture

                ┌─────────────────────────┐
                │       HTTP Client       │
                │  (Axios, Postman, etc)  │
                └────────────┬────────────┘
                             │ POST /url
                             ▼
                    ┌───────────────────┐
                    │  NestJS REST API  │
                    │ (UrlController)   │
                    └─────────┬─────────┘
                              │
                              │ generate shortened URL
                              ▼
                     ┌────────────────────┐
                     │ ShortenerGateway   │
                     │ (Socket.IO server) │
                     └─────────┬──────────┘
                               │
                               │ emit shortened URL
                               ▼
                 ┌──────────────────────────────┐
                 │     Socket.IO Client        │
                 │ (client-example.js)         │
                 └────────────┬────────────────┘
                              │ ACK shortened URL
                              ▼
                     ┌────────────────────┐
                     │  Update            |
                     |  Delivery Tracker  │
                     │ (Map + timeouts)   │
                     └────────────────────┘


## COMPONENTS

#### ShortnerController:

- Handles POST /url requests with { url, clientId }
- Generates and creates a 5-character short code by calling ShortnerService.
- Hands over delivery to ShortenerGateway.


#### ShortenerGateway:

- Manages all Socket.IO client connections.
- Tracks clients by clientId.
- Sends shortened URLs asynchronously.
- Implements retry + acknowledgment handling.

#### StorageSrvice:

- Stores every url in a map with the code being the key and the url being the value.
- Simulates a DB.
- Gets a url by the code.

#### Client:

- Registers with the server using register event.
- Sends HTTP POST to trigger URL shortening.
- Listens for shortened events and responds with ack.
- Used for testing application

## Design Decisions

#### 1. Using Socket.IO:

Why:

- Automatic reconnection
- Event-based communication which is easier to structure
- Easier scaling for example using Redis Adapter in a Pub/Sub Architecture if there were multiple servers
- Better error handling

#### 2. Separate HTTP for Request & Socket.IO for Response:

The task required:
```

After shortening the URL, the server has to return the result to the client, but not through the request's response. Be prepared to receive a response back from the client through the same protocol acknowledging that it has received the result.

```

I used:
- HTTP POST → initiate shortening
- Socket.IO → return shortened URL
- Socket.IO → client ACK back to server

This decouples request and response, allowing asynchronous operations and retry mechanisms.

#### 3. Reliable Delivery with Retry and Acknowledgment:

I built a delivery tracker using an in-memory Map:
- Key: shortenedURL
- Value: { acknowledged, timeouts[], attempt, clientId }


Logic:

- Send shortened URL immediately.
- Schedule exponential backoff retries (1s, 2s, 4s, 8s, 16s) with setTimeout.
- If client sends ack cancel retries.
- Stop after 5 attempts if no ACK received.

This ensures reliable delivery even with unstable connections as a user can reconnect with clientId and still get a response.


#### 4. Client Registration

Each client sends a register event with a unique clientId.

The server maps this clientId to the Socket.IO connection.

The same clientId is passed during the HTTP POST to associate requests with the correct client connection.


#### 5. In-memory Persistence

For simplicity and also because of task requirements, shortened URLs and delivery states are stored in memory.

In production this can easily be replaced with Redis or a database for persistence and horizontal scaling.



## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# test coverage
$ npm run test:cov
```

## Run the Socket.IO Client

```bash

node client-example.js

```

## Testing the Flow

1. Run the server.
2. Run the client.
3. Observe:
- Client registers with server.
- Client POSTs URL.
- Server sends shortened URL over Socket.IO.
- Client acknowledges.
- Server stops retries.

## Future Improvements

- Add a Redis adapter for scaling multiple gateway instances using a Pub/Sub Architecture.
- Persist shortened URLs to a real DB.
- Add authentication & authorization for clients.
- Add monitoring for retry failures and delivery stats.
