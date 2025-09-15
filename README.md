# ion-server-api

A lightweight Node.js connector for the [IonTrader](https://iontrader.com/) trading platform, designed for high-speed server-to-server integration via TCP socket. It enables seamless communication with the IonTrader platform, supporting both old (`{ command, data, from }`) and new (flat objects like `{ login, volume, cmd, ... }`) command formats, with built-in event handling, automatic reconnection, and dynamic command invocation.

## Features

- Connects to the IonTrader platform via TCP for ultra-low latency communication.
- Supports legacy command format (`{ command, data, from }`) and modern flat object format (e.g., `{ login, volume, cmd, ... }`).
- Dynamic command invocation (e.g., `platform.HealthCheck(data)`).
- Automatic `extID` generation using `shortid`.
- Configurable reconnection logic and robust error handling.
- Minimal configuration with sensible defaults for easy integration.
- Ideal for server-to-server integration, CRM systems, or desktop applications (not recommended for client terminals).

## About IonTrader

[IonTrader](https://iontrader.com/) is an ultra-low latency institutional trading engine designed for brokers and fintech companies. It provides comprehensive brokerage services across multiple financial markets, including Forex, equities, and futures. Key features include White Label licensing, enhanced back-office functionality, and connectivity gateways to exchanges and liquidity providers.

## Documentation

For detailed information on available commands and integration options, refer to the official IonTrader documentation:
- [Server API Documentation](https://iontrader.com/tcp/)
- [Client API Documentation](https://iontrader.com/client-api/)
- [FIX API Documentation](https://iontrader.com/fix-api/)


## Installation

Install the package via npm:

```bash
npm install ion-server-api
```

## Requirements

- Node.js v14 or higher.
- Dependencies: `net`, `events`, `jsonrepair`, `shortid` (automatically installed).

## Usage

### Basic Setup

```javascript
const IONPlatform = require('ion-server-api');
const shortid = require('shortid');

// Configure shortid character set
shortid.characters('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$@');

// Initialize platform with minimal parameters
const platform = new IONPlatform(
  'example.host:8080', // URL (host:port)
  'ion-example',       // Platform name
  {},                  // Options (optional, defaults provided)
  null,                // Broker (optional, defaults to {})
  null,                // Context (optional, defaults to {})
  'your-auth-token'    // Authentication token (required)
);

// Send a command in the new format
const data = {}; // If some data needed
platform.HealthCheck(data)
  .then(response => console.log('Response:', response))
  .catch(error => console.error('Error:', error.message));

// Clean up
platform.destroy();
```

### Sending Commands

The package supports two command formats:

1. **Old Format** (for compatibility with existing systems):
   ```javascript
   const data = {
     command: 'HealthCheck',
     data: {},
     from: 123
   };
   data.extID = shortid.generate();
   platform.send(data);
   ```

2. **New Format** (recommended for IonTrader):
   ```javascript
   const data = {}; // If some data needed
   platform.HealthCheck(data)
     .then(response => console.log('Response:', response));
   ```

### Handling Responses

Use an `EventEmitter` to listen for responses based on the `extID`:

```javascript
const events = require('events');
const emitter = new events.EventEmitter();
const platform = new IONPlatform(url, name, {}, null, null, token, emitter);

const data = {}; // If some data needed
data.extID = shortid.generate();
platform.HealthCheck(data);

emitter.once(data.extID, (response) => {
  console.log('Response:', response);
});
```

## Example

To run the example provided in the package:

```bash
npm run example
```

The `example/example.js` demonstrates:
- Initializing `IONPlatform` with minimal parameters.
- Sending a `HealthCheck` command in the new format using `platform.HealthCheck(data)`.
- Handling the response with `async/await`.
- Generating `extID` with `shortid`.

Replace placeholders (`url`, `token`) with real values before running.

## API

### `new IONPlatform(url, name, options, broker, ctx, token, emitter)`

- `url` (string): Host and port (e.g., `'example.host:8080'`). Required.
- `name` (string): Platform identifier. Required.
- `options` (object): Configuration options. Defaults to `{ ignoreEvents: false, prefix: 'ion', mode: 'live' }`.
- `broker` (object): Moleculer broker. Defaults to `{}`.
- `ctx` (object): Moleculer context. Defaults to `{}`.
- `token` (string): Authentication token. Required.
- `emitter` (EventEmitter): Event emitter for handling responses. Defaults to a new `EventEmitter`.

### Methods

- `platform.send(data)`: Sends a command in the old format (`{ command, data, from, extID }`).
- `platform.<CommandName>(data)`: Sends a command in the new format (e.g., `platform.HealthCheck({ ... })`).
- `platform.destroy()`: Closes the connection.

### Events

- Emits responses on the provided `emitter` using the `extID` as the event name.

## License

[MIT License](LICENSE)

## Contributing

Contributions are welcome! Please submit issues or pull requests to the [GitHub repository](https://github.com/iontrader/server-api-js).