# Anonymous P2P Node.js Library

A modular, privacy-preserving, decentralized P2P networking library for Node.js. Features include:
- Onion routing for anonymous message delivery
- Kademlia DHT for distributed storage and peer discovery
- Pseudonymous and ephemeral identity management
- Event-driven, extensible architecture
- **NAT traversal (UDP hole punching) for peer connectivity**

*(If using locally, clone and use `npm link` or import directly by path)*

## Usage Example

```js
const { AnonymousP2PNode, AnonymousIdentity, OnionRouter, KademliaNode } = require('anonymous-p2p');

// Create and start a node
const node = new AnonymousP2PNode(3000);

// NAT traversal example
node.attemptNATHolePunch('192.168.1.42:4000').then(() => {
    console.log('NAT hole punching succeeded!');
}).catch(() => {
    console.log('NAT hole punching failed.');
});

node.on('anonymousMessage', (message) => {
    console.log('Received anonymous message:', message);
});

node.on('peerConnected', (peerId) => {
    console.log('New peer connected:', peerId);
});

// Store data anonymously
node.storeData('secret-key', 'sensitive-data').then(() => {
    console.log('Data stored anonymously');
});

// Retrieve data
node.retrieveData('secret-key').then((data) => {
    console.log('Retrieved data:', data);
});

// Send anonymous message (requires other nodes to be running)
// node.sendAnonymousMessage('Hello anonymous world!', 'target-pseudonym');

console.log('Anonymous P2P Network Node Stats:', node.getNetworkStats());
```

## API

### Classes
- `AnonymousP2PNode(port)` — Main node, event emitter
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
