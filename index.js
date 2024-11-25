require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const Word = require("./src/models/Word");
const WebSocket = require("ws");
const http = require("http");

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ port: 8080 });
app.use(cors());
app.use(bodyParser.json());

let clients = [];
let gameStarted = false;

function broadcastPlayerStatus() {
  const statuses = clients.map((_, index) => ({
    playerNumber: index + 1,
    connected: true,
  }));

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({ type: "playerStatus", statuses }));
    }
  });
}

wss.on("connection", (ws) => {
  const playerIndex = clients.length;
  clients.push(ws);
  console.log(`New client connected as Player ${playerIndex + 1}`);

  ws.send(
    JSON.stringify({ type: "playerAssigned", playerNumber: playerIndex + 1 })
  );

  broadcastPlayerStatus(); // Notify all players of the updated statuses

  ws.on("close", () => {
    clients = clients.filter((client) => client !== ws);
    console.log(`Client disconnected`);
    gameStarted = false;

    if (clients.length < 2) {
      console.log("Game reset due to player disconnection.");
      broadcastPlayerStatus(); // Update statuses for all players
    }
  });

  ws.on("message", (message) => {
    const data = JSON.parse(message);

    if (data.type === "startGame" && clients.length === 2 && !gameStarted) {
      gameStarted = true;
      console.log("Game starting...");
      const gameId = Math.random().toString(36).substring(7); // Example game ID
      clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
          client.send(JSON.stringify({ type: "gameStart", gameId }));
        }
      });
    }
  });
});

console.log("WebSocket server running on ws://localhost:8080");

// Endpoint to get random words
app.get("/random-words", async (req, res) => {
  try {
    const randomWord = await Word.aggregate([{ $sample: { size: 200 } }]);
    res.status(200).json(randomWord);
  } catch (err) {
    res.status(404).json(err);
  }
});

// Connect to MongoDB and start the server
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("Successfully connected to MongoDB");
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
