const fs = require('fs');
const path = require('path');

class TokenStore {
    constructor(options = {}) {
        this.filePath = options.filePath || process.env.AUTH_STORE_PATH ||
            path.join(__dirname, '..', 'data', 'auth', 'tokens.json');
        this.ensureStoreFile();
    }

    ensureStoreFile() {
        const dir = path.dirname(this.filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }

        if (!fs.existsSync(this.filePath)) {
            fs.writeFileSync(this.filePath, JSON.stringify({}, null, 2));
        }
    }

    readStore() {
        this.ensureStoreFile();
        try {
            const content = fs.readFileSync(this.filePath, 'utf8');
            return content ? JSON.parse(content) : {};
        } catch (error) {
            return {};
        }
    }

    writeStore(data) {
        this.ensureStoreFile();
        fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2));
    }

    async get(key) {
        const data = this.readStore();
        return Object.prototype.hasOwnProperty.call(data, key) ? data[key] : null;
    }

    async set(key, value) {
        const data = this.readStore();
        data[key] = value;
        this.writeStore(data);
        return true;
    }
}

module.exports = { TokenStore };
