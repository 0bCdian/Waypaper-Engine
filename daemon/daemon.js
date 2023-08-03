"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
try {
    process.on('message', function (message) {
        console.log(message);
    });
}
catch (error) {
    console.error(error);
    throw new Error('Failed to connect to DB, exiting playlist daemon...');
}
