const osc = require("osc");
const WebSocket = require('ws');
const open = require('open');
const { apps } = open;
const throttledQueue = require('throttled-queue');
const chatboxRatelimit = throttledQueue(1, 1300);

const server = new WebSocket.Server({ port: 3228 });

let vrchatOSC = new osc.UDPPort({
    remoteAddress: "localhost",
    remotePort: 9000,
    metadata: true
});

let sendToChatbox = "false";
let chatboxText = "❤{HR} bpm";

// Define a variable to keep track of the last time the data was sent
let lastSentTime = 0;

vrchatOSC.open();
open('https://vard88508.github.io/vrc-osc-miband-hrm/html/', { app: { name: apps.chrome } });
console.log("Waiting for connection from the browser...");

server.on('connection', ws => {
    console.log("Connected. Waiting for data...");
    ws.on('message', function message(data) {
        let chatbox_text = JSON.parse(data).text;
        let data_string = data.toString();
        if (chatbox_text) {
            chatboxText = chatbox_text;
        } else if (data_string === "true" || data_string === "false") {
            sendToChatbox = data_string;
        } else {
            if (data == 0) {
                console.log("Got heart rate: 0 bpm, skipping parameter update...");
            } else {
                console.log('Got heart rate: %s bpm', data);
                let heartrate = {
                    address: "/avatar/parameters/Heartrate",
                    args: {
                        type: "f",
                        value: data / 127 - 1
                    }
                };
                let heartrate2 = {
                    address: "/avatar/parameters/Heartrate2",
                    args: {
                        type: "f",
                        value: data / 255
                    }
                };
                let heartrate3 = {
                    address: "/avatar/parameters/Heartrate3",
                    args: {
                        type: "i",
                        value: data
                    }
                };
                vrchatOSC.send(heartrate);
                vrchatOSC.send(heartrate2);
                vrchatOSC.send(heartrate3);

                // Rate limiting logic starts here
                const currentTime = Date.now();
                const timeSinceLastSent = currentTime - lastSentTime;

                // Check if enough time has passed since the last data was sent
                if (timeSinceLastSent >= 5000) { // 5000 milliseconds = 5 seconds
                    lastSentTime = currentTime; // Update the last sent time
                    if (sendToChatbox === "true") {
                        chatboxRatelimit(() => {
                            let text = chatboxText.replace("{HR}", data_string) + "    ";

                            let heartrate_chatbox = {
                                address: "/chatbox/input",
                                args: [
                                    { type: "s", value: text },
                                    { type: "T", value: true }
                                ],
                            };

                            vrchatOSC.send(heartrate_chatbox);
                        });
                    }
                }
            }
        }
    });
});
