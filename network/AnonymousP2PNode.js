const net = require('net');
const crypto = require('crypto');
const EventEmitter = require('events');
const OnionRouter = require('../core/OnionRouter');
const AnonymousIdentity = require('../core/AnonymousIdentity');
const KademliaNode = require('../core/KademliaNode');

/**
 * AnonymousP2PNode is the main class for running a decentralized, anonymous P2P node.
 * Handles peer connections, message mixing, onion routing, DHT, and NAT traversal.
 * @extends EventEmitter
 */
class AnonymousP2PNode extends EventEmitter {
    /**
     * Create a new AnonymousP2PNode instance.
     * @param {number} port - The TCP/UDP port to listen on (default 3000).
     */
    constructor(port = 3000) {
        super();
        /** @type {number} */
        this.port = port;
        /** @type {AnonymousIdentity} */
        this.identity = new AnonymousIdentity();
        /** @type {OnionRouter} */
        this.onionRouter = new OnionRouter();
        /** @type {KademliaNode} */
        this.dht = new KademliaNode(this.identity.pseudonym, port);
        /** @type {Map<string, net.Socket>} */
        this.peers = new Map();
        /** @type {Array<object>} */
        this.messageQueue = [];
        /** @type {boolean} */
        this.coverTraffic = true;
        /** @type {number} */
        this.mixingDelay = 100; // ms
        this.setupMixingNode();
        this.startCoverTraffic();
    }

    /**
     * Set up the TCP server for peer connections.
     */
    setupMixingNode() {
        this.server = net.createServer((socket) => {
            this.handlePeerConnection(socket);
        });
        this.server.listen(this.port, () => {
            console.log(`Anonymous P2P node listening on port ${this.port}`);
        });
    }

    /**
     * Handle a new incoming peer connection.
     * @param {net.Socket} socket - The peer's socket.
     */
    handlePeerConnection(socket) {
        const peerId = crypto.randomBytes(8).toString('hex');
        socket.on('data', (data) => {
            this.handleIncomingMessage(data, peerId);
        });
        socket.on('close', () => {
            this.peers.delete(peerId);
        });
        this.peers.set(peerId, socket);
    }

    /**
     * Handle an incoming message from a peer, with random delay for mixing.
     * @param {Buffer} data - The received data.
     * @param {string} peerId - The peer's ID.
     */
    async handleIncomingMessage(data, peerId) {
        try {
            const message = JSON.parse(data.toString());
            this.messageQueue.push({
                message,
                peerId,
                timestamp: Date.now()
            });
            setTimeout(() => this.processMessage(message, peerId), 
                Math.random() * this.mixingDelay);
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    /**
     * Process a parsed message from a peer.
     * @param {object} message - The message object.
     * @param {string} peerId - The peer's ID.
     */
    async processMessage(message, peerId) {
        switch (message.type) {
            case 'ONION_PACKET':
                await this.processOnionPacket(message, peerId);
                break;
            case 'DHT_QUERY':
                await this.processDHTQuery(message, peerId);
                break;
            case 'PEER_DISCOVERY':
                await this.processPeerDiscovery(message, peerId);
                break;
            case 'ANONYMOUS_MESSAGE':
                await this.processAnonymousMessage(message, peerId);
                break;
        }
    }

    /**
     * Process an incoming onion packet (decrypt a layer, forward or deliver).
     * @param {object} message - The onion packet message.
     * @param {string} peerId - The peer's ID.
     */
    async processOnionPacket(message, peerId) {
        try {
            const decrypted = this.onionRouter.decryptLayer(
                message.packet, 
                this.identity.keyPair.privateKey
            );
            if (decrypted.nextHop) {
                await this.forwardOnionPacket(decrypted, decrypted.nextHop);
            } else {
                this.emit('anonymousMessage', decrypted.payload);
            }
        } catch (error) {
            console.error('Error processing onion packet:', error);
        }
    }

    /**
     * Send an anonymous message through a randomly built circuit.
     * @param {any} message - The message to send.
     * @param {string} targetPseudonym - The recipient's pseudonym.
     * @returns {Promise<void>}
     */
    async sendAnonymousMessage(message, targetPseudonym) {
        const circuitNodes = await this.findCircuitNodes(3);
        const circuitId = await this.onionRouter.buildCircuit(circuitNodes);
        const circuit = this.onionRouter.circuits.get(circuitId);
        const packet = this.onionRouter.createOnionPacket(message, circuit);
        const firstHop = circuit[0];
        await this.sendToNode(firstHop.address, {
            type: 'ONION_PACKET',
            packet,
            circuitId
        });
    }

    /**
     * Find random nodes from the DHT to build a circuit.
     * @param {number} count - Number of nodes to find.
     * @returns {Promise<Array<string>>} List of node IDs.
     */
    async findCircuitNodes(count) {
        const nodes = [];
        for (let i = 0; i < count; i++) {
            const randomKey = crypto.randomBytes(20).toString('hex');
            const closestNodes = this.dht.findClosestNodes(randomKey, 1);
            if (closestNodes.length > 0) {
                nodes.push(closestNodes[0].id);
            }
        }
        return nodes;
    }

    /**
     * Start generating cover traffic (dummy messages) to random peers.
     */
    startCoverTraffic() {
        if (!this.coverTraffic) return;
        setInterval(() => {
            const peerIds = Array.from(this.peers.keys());
            if (peerIds.length > 0) {
                const randomPeer = peerIds[Math.floor(Math.random() * peerIds.length)];
                const dummyMessage = {
                    type: 'DUMMY_TRAFFIC',
                    data: crypto.randomBytes(64).toString('hex'),
                    timestamp: Date.now()
                };
                this.sendToPeer(randomPeer, dummyMessage);
            }
        }, 5000 + Math.random() * 10000);
    }

    /**
     * Send a message to a connected peer by peerId.
     * @param {string} peerId - The peer's ID.
     * @param {object} message - The message to send.
     */
    async sendToPeer(peerId, message) {
        const peer = this.peers.get(peerId);
        if (peer) {
            peer.write(JSON.stringify(message));
        }
    }

    /**
     * Send a message to a node by address (host:port).
     * @param {string} address - The node's address.
     * @param {object} message - The message to send.
     * @returns {Promise<void>}
     */
    async sendToNode(address, message) {
        return new Promise((resolve, reject) => {
            const [host, port] = address.split(':');
            const socket = net.createConnection(parseInt(port), host);
            socket.on('connect', () => {
                socket.write(JSON.stringify(message));
                socket.end();
                resolve();
            });
            socket.on('error', reject);
        });
    }

    /**
     * Store data in the DHT.
     * @param {string} key - The key to store.
     * @param {any} value - The value to store.
     * @returns {Promise<void>}
     */
    async storeData(key, value) {
        return this.dht.store(key, value);
    }

    /**
     * Retrieve data from the DHT.
     * @param {string} key - The key to retrieve.
     * @returns {Promise<any|null>} The value, or null if not found.
     */
    async retrieveData(key) {
        return this.dht.retrieve(key);
    }

    /**
     * Connect to a peer by address (host:port).
     * @param {string} address - The peer's address.
     * @returns {Promise<string>} The peer ID.
     */
    async connectToPeer(address) {
        const socket = net.createConnection(parseInt(address.split(':')[1]), address.split(':')[0]);
        const peerId = crypto.randomBytes(8).toString('hex');
        socket.on('connect', () => {
            this.peers.set(peerId, socket);
            this.emit('peerConnected', peerId);
        });
        return peerId;
    }

    /**
     * Attempt NAT traversal (UDP hole punching) with a peer.
     * @param {string} peerAddress - The peer's address (host:port).
     * @returns {Promise<boolean>} True if successful, false otherwise.
     */
    async attemptNATHolePunch(peerAddress) {
        // peerAddress: 'host:port'
        return new Promise((resolve, reject) => {
            const [host, port] = peerAddress.split(':');
            const punchMessage = JSON.stringify({
                type: 'NAT_PUNCH',
                nodeId: this.identity.pseudonym,
                timestamp: Date.now()
            });
            // Listen for a response
            const onMessage = (msg, rinfo) => {
                try {
                    const message = JSON.parse(msg.toString());
                    if (message.type === 'NAT_PUNCH_ACK' && rinfo.address === host && rinfo.port === parseInt(port)) {
                        this.dht.socket.off('message', onMessage);
                        resolve(true);
                    }
                } catch {}
            };
            this.dht.socket.on('message', onMessage);
            // Send punch message
            this.dht.socket.send(punchMessage, parseInt(port), host, (err) => {
                if (err) {
                    this.dht.socket.off('message', onMessage);
                    reject(err);
                }
            });
            // Timeout
            setTimeout(() => {
                this.dht.socket.off('message', onMessage);
                reject(new Error('NAT punch timeout'));
            }, 3000);
        });
    }

    /**
     * Get current network/node statistics.
     * @returns {object} Stats object.
     */
    getNetworkStats() {
        return {
            nodeId: this.identity.pseudonym,
            connectedPeers: this.peers.size,
            dhtEntries: this.dht.storage.size,
            circuits: this.onionRouter.circuits.size,
            reputation: this.identity.reputation
        };
    }
}

module.exports = AnonymousP2PNode; 