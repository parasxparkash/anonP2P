# Anonymous P2P Node.js Library

A modular, privacy-preserving, decentralized P2P networking library for Node.js. Features include:
- Onion routing for anonymous message delivery
- Kademlia DHT for distributed storage and peer discovery
- Pseudonymous and ephemeral identity management
- Event-driven, extensible architecture
- **NAT traversal (UDP hole punching) for peer connectivity**
- **Configurable mesh topology: structured (supernode/leaf) or unstructured**

*(If using locally, clone and use `npm link` or import directly by path)*

## Usage Example

```js
const { AnonymousP2PNode } = require('anonymous-p2p');

// Unstructured mesh (default): each node connects to random peers
const node1 = new AnonymousP2PNode(3000, {
  meshType: 'unstructured',
  maxPeerConnections: 8 // max random peers
});

// Structured mesh: supernode
const supernode = new AnonymousP2PNode(4000, {
  meshType: 'structured',
  role: 'supernode',
  supernodeList: ['127.0.0.1:4000', '127.0.0.1:4001'] // list of all supernodes
});

// Structured mesh: leaf node
const leaf = new AnonymousP2PNode(5000, {
  meshType: 'structured',
  role: 'leaf',
  supernodeList: ['127.0.0.1:4000', '127.0.0.1:4001'] // connect only to supernodes
});
```

## Mesh Topology Options

- `meshType`: `'structured'` or `'unstructured'`
  - **Unstructured:** Each node connects to up to `maxPeerConnections` random peers from the DHT.
  - **Structured:** Nodes are either `supernode` or `leaf`:
    - **Supernode:** Connects to all other supernodes in `supernodeList`.
    - **Leaf:** Connects only to supernodes in `supernodeList`.
- `role`: `'supernode'` or `'leaf'` (only for structured mesh)
- `supernodeList`: Array of addresses (e.g., `['ip:port', ...]`) for structured mesh
- `maxPeerConnections`: Max random peers for unstructured mesh

## API

### Classes
- `AnonymousP2PNode(port, options)` — Main node, event emitter
- `AnonymousIdentity` — Identity and ZK proof
- `OnionRouter` — Onion routing logic
- `KademliaNode` — DHT logic

### Events
- `anonymousMessage` — Fired when an anonymous message is received
- `peerConnected` — Fired when a new peer connects

### Methods (AnonymousP2PNode)
- `storeData(key, value)` — Store data in the DHT
- `retrieveData(key)` — Retrieve data from the DHT
- `sendAnonymousMessage(message, targetPseudonym)` — Send a message anonymously
- `connectToPeer(address)` — Connect to a peer by address
- `getNetworkStats()` — Get node/network stats
- `attemptNATHolePunch(peerAddress)` — Attempt UDP hole punching to connect to a peer behind NAT

## Development
- All code is in `core/` and `network/` directories
- Entry point: `index.js`
- No external dependencies (uses Node.js built-ins)

## License

This project is licensed under the **MIT License** (c) 2024 Paras Parkash. It is free and open source—anyone can use, fork, or modify it without restriction. See the LICENSE file for details. 
