const crypto = require('crypto');
const EventEmitter = require('events');

/**
 * OnionRouter handles anonymous message routing using onion encryption.
 * It builds circuits, encrypts/decrypts message layers, and manages relay nodes.
 * @extends EventEmitter
 */
class OnionRouter extends EventEmitter {
    /**
     * Create a new OnionRouter instance.
     */
    constructor() {
        super();
        /** @type {Map<string, Array>} */
        this.circuits = new Map();
        /** @type {Set<string>} */
        this.relayNodes = new Set();
        /** @type {number} */
        this.circuitLength = 3; // Default circuit length
    }

    /**
     * Create a multi-layer encrypted onion packet for a message and circuit.
     * @param {any} message - The message to send.
     * @param {Array<{id: string, publicKey: any, address: string}>} circuit - The ordered list of circuit nodes.
     * @returns {object} The onion-encrypted packet.
     */
    createOnionPacket(message, circuit) {
        let packet = {
            payload: message,
            timestamp: Date.now()
        };
        // Layer encryption from exit to entry
        for (let i = circuit.length - 1; i >= 0; i--) {
            const node = circuit[i];
            packet = this.encryptLayer(packet, node.publicKey);
        }
        return packet;
    }

    /**
     * Encrypt a single layer of the onion packet.
     * @param {object} data - The data to encrypt.
     * @param {any} publicKey - The public key of the node.
     * @returns {object} The encrypted layer with a nextHop field.
     */
    encryptLayer(data, publicKey) {
        const serialized = JSON.stringify(data);
        const encrypted = crypto.publicEncrypt(publicKey, Buffer.from(serialized));
        return {
            encrypted: encrypted.toString('base64'),
            nextHop: crypto.randomBytes(16).toString('hex')
        };
    }

    /**
     * Decrypt a single layer of the onion packet.
     * @param {object} packet - The encrypted packet.
     * @param {any} privateKey - The private key of the node.
     * @returns {object} The decrypted data.
     * @throws {Error} If decryption fails.
     */
    decryptLayer(packet, privateKey) {
        try {
            const decrypted = crypto.privateDecrypt(privateKey, Buffer.from(packet.encrypted, 'base64'));
            return JSON.parse(decrypted.toString());
        } catch (error) {
            throw new Error('Decryption failed');
        }
    }

    /**
     * Build an anonymous circuit through the network.
     * @param {Array<string>} targetNodes - List of node IDs for the circuit.
     * @returns {Promise<string>} The circuit ID.
     */
    async buildCircuit(targetNodes) {
        const circuitId = crypto.randomBytes(16).toString('hex');
        const circuit = [];
        for (const nodeId of targetNodes) {
            const node = await this.getNodeInfo(nodeId);
            if (node) {
                circuit.push({
                    id: nodeId,
                    publicKey: node.publicKey,
                    address: node.address
                });
            }
        }
        this.circuits.set(circuitId, circuit);
        return circuitId;
    }

    /**
     * Simulate node discovery and return node info.
     * @param {string} nodeId - The node ID to look up.
     * @returns {Promise<{publicKey: any, address: string}>} The node's public key and address.
     */
    async getNodeInfo(nodeId) {
        // Simulate node discovery
        return {
            publicKey: crypto.generateKeyPairSync('rsa', { modulusLength: 2048 }).publicKey,
            address: `${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}:${3000 + Math.floor(Math.random() * 1000)}`
        };
    }
}

module.exports = OnionRouter; 