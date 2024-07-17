import uWS from 'uWebSockets.js';
import net from 'node:net';
import dgram from 'node:dgram';
import dns from 'node:dns/promises';

const CONNECT_TYPE = {
    CONNECT: 0x01,
    DATA: 0x02,
    CONTINUE: 0x03,
    CLOSE: 0x04
};

const STREAM_TYPE = {
    TCP: 0x01,
    UDP: 0x02
};

function wispFrameParser(data) {
    const uint8arrayView = new Uint8Array(data);
    const dataView = new DataView(uint8arrayView.buffer);
    const type = dataView.getUint8(0);
    let streamID = dataView.getUint32(1, true);
    let payload = uint8arrayView.slice(5, uint8arrayView.byteLength);
    return {type, streamID, payload};
}

function connectPacketParser(payload) {
    const dataview = new DataView(payload.buffer);
    const streamType = dataview.getUint8(0);
    const port = dataview.getUint16(1, true);
    const hostname = new TextDecoder("utf8").decode(dataview.buffer.slice(3, dataview.buffer.byteLength));
    return {streamType, port, hostname};
}

function continuePacketMaker(wispFrame, queue) {
    const initialPacket = new DataView(new Uint8Array(9).buffer);
    initialPacket.setUint8(0, CONNECT_TYPE.CONTINUE);
    initialPacket.setUint32(1, wispFrame.streamID, true);
    initialPacket.setUint32(5, queue, true);
    return initialPacket.buffer;
}

function closePacketMaker(wispFrame, reason) {
    const closePacket = new DataView(new Uint8Array(9).buffer);
    closePacket.setUint8(0, CONNECT_TYPE.CLOSE);
    closePacket.setUint32(1, wispFrame.streamID, true);
    closePacket.setUint8(5, reason);
    return closePacket.buffer;
}

function dataPacketMaker(wispFrame, data) {
    const dataPacketHeader = new DataView(new Uint8Array(5).buffer);
    dataPacketHeader.setUint8(0, CONNECT_TYPE.DATA);
    dataPacketHeader.setUint32(1, wispFrame.streamID, true);
    return Buffer.concat([
        Buffer.from(dataPacketHeader.buffer),
        data
    ]);
}

const uwsServer = uWS.App();

uwsServer.ws('/*', {
    compression: 0,
    maxPayloadLength: 16 * 1024 * 1024,
    idleTimeout: 32,
    open: (ws) => {
        ws.connections = new Map();
       // console.log("[Info]: WebSocket connected");
        ws.send(continuePacketMaker({
            streamID: 0
        }, 127), true, true);
    },
    message: (ws, message, isBinary) => {
        if (!isBinary) {
           // console.log("Info]: Received non-binary message, ignoring");
            return;
        }
        if (ws.closed) {
           // console.log("[Info]: WebSocket is closed, ignoring message");
            return;
        }

        const wispFrame = wispFrameParser(Buffer.from(message));
        // Used for debugging.
        //// console.log("Parsed WISP frame:", wispFrame);

        try {
            if (wispFrame.type === CONNECT_TYPE.CONNECT) {
                const connectFrame = connectPacketParser(wispFrame.payload);
                // Used for debugging.
                //// console.log("Parsed CONNECT frame:", connectFrame);

                if (connectFrame.streamType === STREAM_TYPE.TCP) {
                    const client = new net.Socket();
                    client.connect(connectFrame.port, connectFrame.hostname);

                    ws.connections.set(wispFrame.streamID, {client, buffer: 127});

                    client.on("connect", () => {
                        // Used for debugging.
                        //// console.log(`Connected to ${connectFrame.hostname}:${connectFrame.port}`);
                        ws.send(continuePacketMaker({
                            streamID: wispFrame.streamID
                        }, 127), true);
                    });

                    client.on("data", (data) => {
                        // Used for debugging.
                        //// console.log(`Received data from ${connectFrame.hostname}:${connectFrame.port}`);
                        ws.send(dataPacketMaker(wispFrame, data), true);
                    });

                    client.on("error", (error) => {
                        // Used for debugging.
                        // console.error(`Error in connection to ${connectFrame.hostname}:${connectFrame.port}:`, error);
                        if (ws.readyState === ws.OPEN) {
                            try {
                                ws.send(closePacketMaker(wispFrame, 0x03), true);
                                ws.connections.delete(wispFrame.streamID);
                            } catch (error) {
                                console.error('[Error]: Error sending WebSocket message (Libcurl may fix this)');
                            }
                        }
                    });

                    client.on("close", () => {
                        // Used for debugging.
                        //// console.log(`Connection closed to ${connectFrame.hostname}:${connectFrame.port}`);
                        if (ws.readyState === ws.OPEN) {
                            try {
                                ws.send(closePacketMaker(wispFrame, 0x02), true);
                                ws.connections.delete(wispFrame.streamID);
                            } catch (error) {
                                console.error('[Error]: Error sending WebSocket message (Libcurl may fix this)');
                            }
                        }
                    });
                } else if (connectFrame.streamType === STREAM_TYPE.UDP) {
                    (async () => {
                        let iplevel = net.isIP(connectFrame.hostname);
                        let host = connectFrame.hostname;

                        if (iplevel === 0) {
                            try {
                                host = (await dns.resolve(connectFrame.hostname))[0];
                                iplevel = net.isIP(host);
                            } catch (e) {
                                console.error("[Error]: Failure while trying to resolve hostname " + connectFrame.hostname + " with error: " + e);
                                return;
                            }
                        }

                        if (iplevel != 4 && iplevel != 6) {
                            return;
                        }

                        const client = dgram.createSocket(iplevel === 6 ? "udp6" : "udp4");
                        client.connect(connectFrame.port, host);

                        ws.connections.set(wispFrame.streamID, {client, buffer: 127});

                        client.on("connect", () => {
                           // console.log(`[Info]: Connected to ${host}:${
                               // connectFrame.port
                            //} via UDP`);
                            ws.send(continuePacketMaker({
                                streamID: wispFrame.streamID
                            }, 127), true);
                        });

                        client.on("message", (data, rinfo) => {
                            // Used for debugging.
                            //// console.log(`Received UDP data from ${rinfo.address}:${rinfo.port}`);
                            ws.send(dataPacketMaker(wispFrame, data), true);
                        });

                        client.on("error", (error) => {
                            console.error("[Error]: UDP error:", error);
                            if (ws.readyState === ws.OPEN) {
                                try {
                                    ws.send(closePacketMaker(wispFrame, 0x3), true);
                                    ws.connections.delete(wispFrame.streamID);
                                } catch (error) {
                                    console.error('[Error]: Error sending WebSocket message (Libcurl may fix this)');
                                }
                            }
                            client.close();
                        });

                        client.on("close", () => {
                           // console.log("[Info]: UDP connection closed");
                            if (ws.readyState === ws.OPEN) {
                                try {
                                    ws.send(closePacketMaker(wispFrame, 0x02), true);
                                    ws.connections.delete(wispFrame.streamID);
                                } catch (error) {
                                    console.error('[Error]: Error sending WebSocket message (Libcurl may fix this)');
                                }
                            }
                        });
                    })();
                }
            }

            if (wispFrame.type === CONNECT_TYPE.DATA) {
                const stream = ws.connections.get(wispFrame.streamID);
                if (stream && stream.client) {
                    // Used for debugging.
                    //// console.log(`Forwarding data to streamID ${wispFrame.streamID}`);
                    if (stream.client instanceof net.Socket) {
                        stream.client.write(wispFrame.payload);
                    } else if (stream.client instanceof dgram.Socket) {
                        stream.client.send(wispFrame.payload);
                    }
                    stream.buffer --;
                    if (stream.buffer === 0) {
                        stream.buffer = 127;
                        ws.send(continuePacketMaker(wispFrame, stream.buffer), true);
                    }
                } else {
                    console.error(`[Error]: No active connection found for streamID ${
                        wispFrame.streamID
                    }`);
                }
            }

            if (wispFrame.type === CONNECT_TYPE.CLOSE) {
               // console.log(`[Info]: Client decided to terminate streamID ${
                    //wispFrame.streamID
                //} with reason ${
                    //wispFrame.payload[0]
                //}`);
                const stream = ws.connections.get(wispFrame.streamID);
                if (stream && stream.client) {
                    if (stream.client instanceof net.Socket) {
                        stream.client.destroy();
                    } else if (stream.client instanceof dgram.Socket) {
                        stream.client.close();
                    }
                }
                ws.connections.delete(wispFrame.streamID);
            }
        } catch (e) {
            console.error("[Error]: Error in WISP message handler:");
            console.error(e);
            ws.end();
            for (const {client}
            of ws.connections.values()) {
                if (client instanceof net.Socket) {
                    client.destroy();
                } else if (client instanceof dgram.Socket) {
                    client.close();
                }
            }
            ws.connections.clear();
        }
    },
    close: (ws, code, message) => {
        if (ws.closed) {
           // console.log("[Info]: WebSocket is already closed");
            return;
        }
       // console.log(`[Info]: WebSocket connection closed with code ${code} and message: ${message}`);
        for (const {client}
        of ws.connections.values()) {
            if (client instanceof net.Socket) {
                client.destroy();
            } else if (client instanceof dgram.Socket) {
                client.close();
            }
        }
        ws.connections.clear();
    }
});

export { uwsServer };
