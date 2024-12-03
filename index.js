require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid"); // Import uuid for generating session IDs
const Word = require("./src/models/Word");

const app = express();
const server = http.createServer(app);

app.use(cors());

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Players and Replay State
let player1 = null;
let player2 = null;
let replayRequests = { player1: false, player2: false };
const sessions = {}; // Store sessionId -> player mapping

// Broadcast current player status to all clients
function broadcastPlayerStatus() {
  io.emit("playerStatus", {
    player1: player1 !== null,
    player2: player2 !== null,
  });
}

io.on("connection", (socket) => {
  const sessionId = uuidv4(); // Generate a unique session ID
  console.log(`New client connected: ${socket.id}, Session ID: ${sessionId}`);

  // Send session ID to the client
  socket.emit("sessionIdAssigned", { sessionId });

  // Assign players to slots
  if (!player1) {
    player1 = socket.id;
    sessions[sessionId] = { playerNumber: 1, socketId: socket.id };
    socket.emit("playerAssigned", { playerNumber: 1 });
    console.log("Player 1 connected");
  } else if (!player2) {
    player2 = socket.id;
    sessions[sessionId] = { playerNumber: 2, socketId: socket.id };
    socket.emit("playerAssigned", { playerNumber: 2 });
    console.log("Player 2 connected");
  } else {
    console.log("Third connection rejected");
    socket.emit("error", { message: "Only two players are allowed" });
    socket.disconnect();
    return;
  }

  // Notify all clients of the updated player status
  broadcastPlayerStatus();

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);

    let playerNumber = null;

    if (socket.id === player1) {
      console.log("Player 1 disconnected");
      playerNumber = 1;
      player1 = null;
      replayRequests.player1 = false; // Reset Player 1 replay request
    } else if (socket.id === player2) {
      console.log("Player 2 disconnected");
      playerNumber = 2;
      player2 = null;
      replayRequests.player2 = false; // Reset Player 2 replay request
    }

    // Remove session mapping
    const session = Object.entries(sessions).find(
      ([, value]) => value.socketId === socket.id
    );
    if (session) {
      delete sessions[session[0]];
    }

    if (playerNumber) {
      // Notify all players about the disconnection
      io.emit("playerDisconnected", { playerNumber });

      // Notify about replay reset if applicable
      const replayCount = Object.values(replayRequests).filter(Boolean).length;
      io.emit("replayStatus", { replayCount });

      // Broadcast updated player statuses
      broadcastPlayerStatus();

      console.log(`Player ${playerNumber} replay request cleared.`);
    }
  });

  // Handle manual player leave
  socket.on("playerLeave", () => {
    console.log(`Player leave request received from ${socket.id}`);

    let playerNumber = null;

    if (socket.id === player1) {
      playerNumber = 1;
      player1 = null;
      replayRequests.player1 = false; // Reset replay request
    } else if (socket.id === player2) {
      playerNumber = 2;
      player2 = null;
      replayRequests.player2 = false; // Reset replay request
    }

    // Remove session mapping
    const session = Object.entries(sessions).find(
      ([, value]) => value.socketId === socket.id
    );
    if (session) {
      delete sessions[session[0]];
    }

    // Notify both players to leave the game
    io.emit("playerLeave", { playerNumber });

    // Notify about replay reset
    io.emit("replayStatus", { replayCount: 0 });

    // Broadcast updated player status
    broadcastPlayerStatus();
  });

  // Handle replay requests
  socket.on("playerReplay", () => {
    console.log(`Replay request received from ${socket.id}`);

    if (socket.id === player1) {
      replayRequests.player1 = true;
    } else if (socket.id === player2) {
      replayRequests.player2 = true;
    }

    // Notify all players about replay request status
    const replayCount = Object.values(replayRequests).filter(Boolean).length;
    io.emit("replayStatus", { replayCount });

    // If both players requested replay, restart the game
    if (replayRequests.player1 && replayRequests.player2) {
      io.emit("gameRestart");
      console.log("Game restarting for both players.");

      // Reset replay requests
      replayRequests = { player1: false, player2: false };

      // Notify all players about the reset replay count
      io.emit("replayStatus", { replayCount: 0 });
    }
  });

  // Handle start game event
  socket.on("startGame", () => {
    console.log("Start Game event received.");
    if (player1 && player2) {
      io.emit("gameStart", { gameId: new Date().getTime() });
    } else {
      console.log("Cannot start game: Not enough players connected.");
    }
  });
});

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
    const PORT = process.env.PORT;
    server.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });
