# Anonymous P2P Node.js Library — Architecture & Flow

This document explains the architecture and step-by-step flow of the Anonymous P2P Node.js library, covering how each component works and interacts.

---

## 1. Initialization

- **Create a node:**
  ```js
  const node = new AnonymousP2PNode(3000);
  ```
- **What happens:**
  - Generates a pseudonymous identity (RSA key pair, random pseudonym)
  - Initializes OnionRouter, KademliaNode (DHT), and TCP/UDP servers
  - Prepares for peer connections, message mixing, and cover traffic

---

## 2. Peer Discovery

- **Mechanism:**
  - Uses Kademlia DHT for decentralized peer lookup
  - Each node maintains a routing table (buckets by XOR distance)
  - Nodes discover each other by sending/receiving UDP messages
- **Process:**
  - On receiving a message, a node adds the sender to its routing table
  - To find peers, a node queries the DHT for closest nodes to a random key

---

## 3. Decentralized Storage (DHT)

- **Store data:**
  ```js
  await node.storeData('key', 'value');
  ```
- **How it works:**
  - Key is hashed (SHA-1)
  - Value is stored locally and replicated to the k closest nodes in the DHT
  - Each entry has a TTL (time-to-live)
- **Retrieve data:**
  ```js
  const value = await node.retrieveData('key');
  ```
  - Checks local storage first, then queries closest nodes in parallel

---

## 4. Anonymous Message Routing (Onion Routing)

- **Send anonymous message:**
  ```js
  await node.sendAnonymousMessage('Hello', 'target-pseudonym');
  ```
- **How it works:**
  1. **Circuit building:**
     - Selects 3 random nodes from the DHT as a circuit
     - Fetches their public keys and addresses
  2. **Onion encryption:**
     - Encrypts the message in layers (exit → entry)
     - Each node can only decrypt its own layer
  3. **Transmission:**
     - Sends the packet to the first hop
     - Each relay node peels a layer and forwards to the next hop
     - Final node delivers the message to the recipient

---

## 5. NAT Traversal (UDP Hole Punching)

- **Purpose:**
  - Allows nodes behind NAT/firewall to establish direct UDP connections
- **How it works:**
  1. Node A calls:
     ```js
     await node.attemptNATHolePunch('peer-ip:peer-port');
     ```
  2. Sends a special UDP packet (NAT_PUNCH) to the peer
  3. Peer responds with NAT_PUNCH_ACK
  4. If ACK is received, a direct UDP path is likely open
- **Integration:**
  - NAT punch messages are handled in the DHT UDP socket
  - Can be used before sending direct UDP messages

---

## 6. Security & Privacy

- **Anonymity:**
  - Onion routing hides sender/receiver relationship
  - Pseudonymous IDs and ephemeral keys prevent identity linkage
- **Traffic Analysis Resistance:**
  - Random delays, message mixing, and dummy cover traffic
- **Zero-Knowledge Proofs:**
  - Prove identity without revealing pseudonym
- **DHT Redundancy:**
  - Data is replicated for fault tolerance

---

## 7. Event-Driven API

- **Events:**
  - `anonymousMessage`: Fired when an anonymous message is received
  - `peerConnected`: Fired when a new peer connects
- **Extensibility:**
  - All main classes extend EventEmitter
  - You can hook into events for custom logic

---

## 8. Example Flow: Sending a Message

1. Node A wants to send a message to Node B
2. Node A builds a 3-hop circuit using DHT
3. Node A onion-encrypts the message
4. Node A sends the packet to the first hop
5. Each hop decrypts a layer and forwards
6. Node B receives and decrypts the final message
7. All nodes only know their immediate neighbors, preserving anonymity

---

## 9. Limitations & Extending

- **Persistence:** In-memory only (add disk storage for production)
- **NAT traversal:** Basic UDP hole punching (add relay/ICE for more robustness)
- **Security:** Add rate limiting, DoS protection, and input validation for production
- **Transport:** Only TCP/UDP sockets (add WebRTC, WebSockets for browser support)

---

## 10. Summary

This library provides a modular, extensible foundation for building decentralized, privacy-preserving P2P applications in Node.js. Each component is designed for security, anonymity, and flexibility. 