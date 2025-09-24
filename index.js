const net = require('net');
const events = require('events');
const { jsonrepair } = require('jsonrepair');

const shortid = require('shortid');
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

class IONPlatform {
    constructor(url, name, options = {}, broker, ctx, token, emitter = null) {
        this.name = name;
        this.url = url;
        this.errorCount = 0;
        this.broker = broker || {};
        this.ctx = ctx || {};
        this.ignoreEvents = options.ignoreEvents || false;
        this.prefix = options.prefix || 'ion';
        this.mode = options.mode || 'live';
        this.token = token;
        this.emitter = emitter || new events.EventEmitter();
        this.createSocket();

        // Return a Proxy to handle dynamic method calls
        return new Proxy(this, {
            get: (target, prop, receiver) => {
                // If the property exists on the target, return it
                if (prop in target) {
                    return Reflect.get(target, prop, receiver);
                }
                // Otherwise, treat prop as a command name and return a function
                return async function(data = {}) {
                    // Transform data into the send format
                    const transformedData = {
                        command: prop,
                        data
                    };
                    // Generate extID if not provided
                    if (!transformedData.extID) {
                        transformedData.extID = shortid.generate();
                    }
                    // Send the command
                    return target.send(transformedData);
                };
            }
        });
    }

    createSocket() {
        this.errorCount = 0;
        this.connected = false;
        this.alive = true;
        this.recv = '';

        // Create a new TCP socket
        this.socket = new net.Socket();
        this.socket.setKeepAlive(true);
        this.socket.setNoDelay();

        // Set up socket event handlers
        this.socket
            .on('connect', () => {
                console.info('IONPlatform connected', this.name, this.url);
                this.connected = true;
            })
            .on('timeout', () => {
                console.error('IONPlatform timeout connection', this.name, this.url);
                if (this.alive) this.reconnect();
            })
            .on('close', () => {
                this.connected = false;
                console.warn('IONPlatform closed', this.name);
                if (this.alive) this.reconnect();
            })
            .on('error', (err) => {
                console.error('IONPlatform socket error', this.name, err.message);
                if (this.alive) this.reconnect();
            })
            .on('data', (data) => {
                this.recv += data.toString();

                // Process received data
                let lastDelimiterPosition = this.recv.lastIndexOf('\r\n');

                if (lastDelimiterPosition === -1) {
                    return;
                }

                let received = this.recv.slice(0, lastDelimiterPosition);
                this.recv = this.recv.slice(lastDelimiterPosition + 2);

                let tokens = received.split('\r\n');

                tokens.forEach(async (token) => {
                    if (token.length > 0) {
                        let data;

                        try {
                            data = JSON.parse(jsonrepair(token.replace(/[\n\r\t]/g, '').replace(/[-\u0019]+/g, "")));
                        } catch (e) {
                            console.error('Parse error:', token, e.message);
                            return;
                        }

                        if (data.extID) {
                            this.emitter.emit(data.extID, data);
                        }
                    }
                });
            });

        // Connect to the specified host and port
        let url_pars = this.url.split(':');

        this.socket.connect({ host: url_pars[0], port: url_pars[1] }, (err) => {
            if (err) {
                console.error('IONPlatform connection error', this.name, err.message);
                if (this.alive) this.reconnect();
            }
        });
    }

    async send(data) {
        if (!data.extID) {
            data.extID = shortid.generate();
        }
        // Add authentication token to data
        data.__token = this.token;

        if (!this.connected) {
            console.warn('IONPlatform not connected', this.name);
            return Promise.reject(new Error(`Socket not connected for ${this.name}`));
        }

        try {
            this.socket.write(JSON.stringify(data) + "\r\n");

            return await new Promise((resolve, reject) => {
                const timeoutId = setTimeout(() => {
                    console.warn('IONPlatform response timeout', this.name, data.extID);
                    reject(new Error(`Response timeout for extID: ${data.extID}`));
                }, 30000);

                this.emitter.once(data.extID, (response) => {
                    clearTimeout(timeoutId);
                    resolve(response);
                });
            });
        } catch (err) {
            console.error('IONPlatform send error', this.name, data.extID, err.message);
            return Promise.reject(err);
        }
    }

    reconnect() {
        // Destroy the current socket
        this.socket.destroy();
        if (!this._reconnectTimer) {
            // Schedule a reconnect attempt
            this._reconnectTimer = setTimeout(() => {
                delete this._reconnectTimer;
                this.lastReconnectTime = Date.now();
                console.info('IONPlatform reconnecting', this.name);
                this.createSocket();
            }, 4000);
        } else {
            console.info('Reconnect already pending, doing nothing.', this.name);
        }
    }

    destroy() {
        // Mark platform as inactive and destroy the socket
        this.alive = false;
        this.socket.destroy();
    }
}

module.exports = IONPlatform;