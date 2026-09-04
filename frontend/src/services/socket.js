// WSN_LAB1/frontend/src/services/socket.js
import { io } from 'socket.io-client';

// Dynamically use the IP address in the browser's URL bar, but force port 5000
const SOCKET_URL = `http://${window.location.hostname}:5000`;

export const socket = io(SOCKET_URL, {
    autoConnect: true,
    reconnection: true,
});