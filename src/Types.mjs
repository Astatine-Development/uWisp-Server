export const CONNECT_TYPE = {
    CONNECT: 0x01,
    DATA: 0x02,
    CONTINUE: 0x03,
    CLOSE: 0x04
};

export const STREAM_TYPE = {
    TCP: 0x01,
    UDP: 0x02
};

export const WispFrame = {
    type: CONNECT_TYPE,
    streamID: 0,
    payload: new Uint8Array()
};

export const WispOptions = {
    logging: false
};
