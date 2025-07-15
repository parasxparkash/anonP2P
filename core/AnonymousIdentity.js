const crypto = require('crypto');

/**
 * AnonymousIdentity manages pseudonymous and ephemeral identities, and provides zero-knowledge proof support.
 */
class AnonymousIdentity {
    /**
     * Create a new AnonymousIdentity instance.
     */
    constructor() {
        /** @type {{ publicKey: any, privateKey: any }} */
        this.keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        /** @type {Map<string, { keyPair: any, created: number, uses: number }>} */
        this.ephemeralKeys = new Map();
        /** @type {number} */
        this.reputation = 0;
        /** @type {string} */
        this.pseudonym = crypto.randomBytes(16).toString('hex');
    }

    /**
     * Generate a new ephemeral key for temporary interactions.
     * @returns {string} The ephemeral key ID.
     */
    generateEphemeralKey() {
        const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
        const keyId = crypto.randomBytes(8).toString('hex');
        this.ephemeralKeys.set(keyId, {
            keyPair,
            created: Date.now(),
            uses: 0
        });
        return keyId;
    }

    /**
     * Sign a message with an ephemeral key.
     * @param {string} message - The message to sign.
     * @param {string} keyId - The ephemeral key ID.
     * @returns {string} The base64-encoded signature.
     * @throws {Error} If the ephemeral key is not found.
     */
    signWithEphemeral(message, keyId) {
        const ephemeral = this.ephemeralKeys.get(keyId);
        if (!ephemeral) {
            throw new Error('Ephemeral key not found');
        }
        ephemeral.uses++;
        // Auto-expire after 100 uses or 1 hour
        if (ephemeral.uses > 100 || Date.now() - ephemeral.created > 3600000) {
            this.ephemeralKeys.delete(keyId);
        }
        const signature = crypto.sign('sha256', Buffer.from(message), ephemeral.keyPair.privateKey);
        return signature.toString('base64');
    }

    /**
     * Create a zero-knowledge proof of identity for a challenge.
     * @param {string} challenge - The challenge string.
     * @returns {string} The proof (SHA-256 hash).
     */
    createZKProof(challenge) {
        const proof = crypto.createHash('sha256')
            .update(this.pseudonym)
            .update(challenge)
            .digest('hex');
        return proof;
    }

    /**
     * Verify a zero-knowledge proof.
     * @param {string} proof - The proof to verify.
     * @param {string} challenge - The challenge string.
     * @param {string} pseudonym - The pseudonym to check against.
     * @returns {boolean} True if the proof is valid, false otherwise.
     */
    verifyZKProof(proof, challenge, pseudonym) {
        const expected = crypto.createHash('sha256')
            .update(pseudonym)
            .update(challenge)
            .digest('hex');
        return proof === expected;
    }
}

module.exports = AnonymousIdentity; 