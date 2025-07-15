const crypto = require('crypto');
const dgram = require('dgram');
const EventEmitter = require('events');

/**
 * KademliaNode implements a distributed hash table (DHT) node for peer discovery and decentralized storage.
 * Handles UDP communication, routing table management, and DHT operations.
 * @extends EventEmitter
 */
class KademliaNode extends EventEmitter {
    /**
     * Create a new KademliaNode instance.
     * @param {string} nodeId - The node's unique ID (optional).
     * @param {number} port - The UDP port to bind to (default 3000).
     */
    constructor(nodeId, port = 3000) {
        super();
        /** @type {string} */
        this.nodeId = nodeId || crypto.randomBytes(20).toString('hex');
        /** @type {number} */
        this.port = port;
        /** @type {Array<Array<{id: string, address: string, lastSeen: number}>>} */
        this.buckets = new Array(160).fill(null).map(() => []);
        /** @type {Map<string, {value: any, timestamp: number, ttl: number}>} */
        this.storage = new Map();
        /** @type {number} */
        this.alpha = 3; // Concurrency parameter
        /** @type {number} */
        this.k = 20; // Bucket size
        /** @type {dgram.Socket} */
        this.socket = dgram.createSocket('udp4');
        this.setupSocket();
    }

    /**
     * Set up the UDP socket to listen for incoming DHT messages.
     */
    setupSocket() {
        this.socket.on('message', (msg, rinfo) => {
            this.handleMessage(msg, rinfo);
        });
        this.socket.bind(this.port);
    }

    /**
     * Calculate the XOR distance between two node IDs.
     * @param {string} a - First node ID (hex string).
     * @param {string} b - Second node ID (hex string).
     * @returns {string} The XOR distance as a hex string.
     */
    xorDistance(a, b) {
        const bufA = Buffer.from(a, 'hex');
        const bufB = Buffer.from(b, 'hex');
        const result = Buffer.alloc(bufA.length);
        for (let i = 0; i < bufA.length; i++) {
            result[i] = bufA[i] ^ bufB[i];
        }
        return result.toString('hex');
    }

    /**
     * Find the appropriate bucket index for a node ID.
     * @param {string} nodeId - The node ID to locate.
     * @returns {number} The bucket index (0-159).
     */
    getBucketIndex(nodeId) {
        const distance = this.xorDistance(this.nodeId, nodeId);
        const buffer = Buffer.from(distance, 'hex');
        for (let i = 0; i < buffer.length; i++) {
            for (let j = 0; j < 8; j++) {
                if (buffer[i] & (1 << (7 - j))) {
                    return i * 8 + j;
                }
            }
        }
        return 159;
    }

    /**
     * Add a node to the routing table.
     * @param {string} nodeId - The node's ID.
     * @param {string} address - The node's address (host:port).
     */
    addNode(nodeId, address) {
        const bucketIndex = this.getBucketIndex(nodeId);
        const bucket = this.buckets[bucketIndex];
        const existingIndex = bucket.findIndex(node => node.id === nodeId);
        if (existingIndex !== -1) {
            bucket.splice(existingIndex, 1);
        }
        bucket.unshift({ id: nodeId, address, lastSeen: Date.now() });
        if (bucket.length > this.k) {
            bucket.pop();
        }
    }

    /**
     * Find the closest nodes to a target ID.
     * @param {string} target - The target ID (hex string).
     * @param {number} [count=this.k] - Number of nodes to return.
     * @returns {Array<{id: string, address: string, lastSeen: number, distance: string}>} Closest nodes.
     */
    findClosestNodes(target, count = this.k) {
        const allNodes = this.buckets.flat();
        return allNodes
            .map(node => ({
                ...node,
                distance: this.xorDistance(node.id, target)
            }))
            .sort((a, b) => a.distance.localeCompare(b.distance))
            .slice(0, count);
    }

    /**
     * Store a value in the DHT and replicate to closest nodes.
     * @param {string} key - The key to store.
     * @param {any} value - The value to store.
     * @returns {Promise<void>}
     */
    async store(key, value) {
        const keyHash = crypto.createHash('sha1').update(key).digest('hex');
        this.storage.set(keyHash, {
            value,
            timestamp: Date.now(),
            ttl: 3600000 // 1 hour
        });
        const closestNodes = this.findClosestNodes(keyHash);
        for (const node of closestNodes.slice(0, this.k)) {
            await this.sendStore(node.address, keyHash, value);
        }
    }

    /**
     * Retrieve a value from the DHT.
     * @param {string} key - The key to retrieve.
     * @returns {Promise<any|null>} The value, or null if not found.
     */
    async retrieve(key) {
        const keyHash = crypto.createHash('sha1').update(key).digest('hex');
        if (this.storage.has(keyHash)) {
            const stored = this.storage.get(keyHash);
            if (Date.now() - stored.timestamp < stored.ttl) {
                return stored.value;
            }
        }
        const closestNodes = this.findClosestNodes(keyHash);
        const queries = closestNodes.slice(0, this.alpha).map(node => 
            this.sendFindValue(node.address, keyHash)
        );
        const results = await Promise.allSettled(queries);
        for (const result of results) {
            if (result.status === 'fulfilled' && result.value) {
                return result.value;
            }
        }
        return null;
    }

    /**
     * Send a STORE message to another node.
     * @param {string} address - The target node's address (host:port).
     * @param {string} key - The key to store.
     * @param {any} value - The value to store.
     * @returns {Promise<void>}
     */
    sendStore(address, key, value) {
        return new Promise((resolve, reject) => {
            const message = {
                type: 'STORE',
                key,
                value,
                nodeId: this.nodeId
            };
            const [host, port] = address.split(':');
            this.socket.send(JSON.stringify(message), parseInt(port), host, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    /**
     * Send a FIND_VALUE message to another node.
     * @param {string} address - The target node's address (host:port).
     * @param {string} key - The key to find.
     * @returns {Promise<any>}
     */
    sendFindValue(address, key) {
        return new Promise((resolve, reject) => {
            const message = {
                type: 'FIND_VALUE',
                key,
                nodeId: this.nodeId
            };
            const [host, port] = address.split(':');
            this.socket.send(JSON.stringify(message), parseInt(port), host, (err) => {
                if (err) reject(err);
                else resolve();
            });
            setTimeout(() => reject(new Error('Timeout')), 5000);
        });
    }

    /**
     * Handle incoming UDP messages for DHT operations and NAT traversal.
     * @param {Buffer} msg - The received message.
     * @param {object} rinfo - Remote address info.
     */
    handleMessage(msg, rinfo) {
        try {
            const message = JSON.parse(msg.toString());
            const senderAddress = `${rinfo.address}:${rinfo.port}`;
            this.addNode(message.nodeId, senderAddress);
            switch (message.type) {
                case 'STORE':
                    this.storage.set(message.key, {
                        value: message.value,
                        timestamp: Date.now(),
                        ttl: 3600000
                    });
                    break;
                case 'FIND_VALUE':
                    const stored = this.storage.get(message.key);
                    if (stored && Date.now() - stored.timestamp < stored.ttl) {
                        this.sendResponse(senderAddress, 'FOUND', stored.value);
                    } else {
                        const closestNodes = this.findClosestNodes(message.key);
                        this.sendResponse(senderAddress, 'NODES', closestNodes);
                    }
                    break;
                case 'PING':
                    this.sendResponse(senderAddress, 'PONG', { nodeId: this.nodeId });
                    break;
                case 'NAT_PUNCH':
                    // Respond to NAT punch with ACK
                    this.sendResponse(senderAddress, 'NAT_PUNCH_ACK', { nodeId: this.nodeId });
                    break;
            }
        } catch (error) {
            console.error('Error handling message:', error);
        }
    }

    /**
     * Send a response message to another node.
     * @param {string} address - The target node's address (host:port).
     * @param {string} type - The response type.
     * @param {any} data - The response data.
     */
    sendResponse(address, type, data) {
        const message = {
            type,
            data,
            nodeId: this.nodeId
        };
        const [host, port] = address.split(':');
        this.socket.send(JSON.stringify(message), parseInt(port), host);
    }
}

module.exports = KademliaNode; 