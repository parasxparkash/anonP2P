// Anonymous P2P Network Architecture in Node.js
// Complete decentralized network with anonymity features

const AnonymousP2PNode = require('./network/AnonymousP2PNode');
const AnonymousIdentity = require('./core/AnonymousIdentity');
const OnionRouter = require('./core/OnionRouter');
const KademliaNode = require('./core/KademliaNode');

// ============== USAGE EXAMPLE ==============

// Create and start anonymous P2P node
const node = new AnonymousP2PNode(3000);

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

module.exports = { AnonymousP2PNode, AnonymousIdentity, OnionRouter, KademliaNode };