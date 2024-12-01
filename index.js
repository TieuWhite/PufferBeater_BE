require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bodyParser = require("body-parser");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const Word = require("./src/models/Word"); // Ensure the Word model exists

const app = express();
const server = http.createServer(app);
app.use(cors());
app.use(bodyParser());

const io = require("socket.io")(server, {
  cors: {
    origin: "*", // Allow all origins for development
  },
});

let player1 = null;
let player2 = null;

function broadcastPlayerStatus() {
  io.emit("playerStatus", {
    player1: player1 !== null,
    player2: player2 !== null,
  });
}

io.on("connection", (socket) => {
  console.log(`New client connected: ${socket.id}`);

  // Assign players to available slots
  if (!player1) {
    player1 = socket.id;
    console.log("Player 1 connected");
  } else if (!player2) {
    player2 = socket.id;
    console.log("Player 2 connected");
  } else {
    console.log("Third connection rejected");
    socket.emit("error", { message: "Only two players are allowed" });
    socket.disconnect(); // Disconnect third client
    return;
  }

  // Broadcast updated statuses
  broadcastPlayerStatus();

  // Handle disconnection
  socket.on("disconnect", () => {
    console.log(`Client disconnected: ${socket.id}`);
    if (socket.id === player1) {
      console.log("Player 1 disconnected");
      player1 = null;
    } else if (socket.id === player2) {
      console.log("Player 2 disconnected");
      player2 = null;
    }
    broadcastPlayerStatus();
  });

  // Handle start game event
  socket.on("startGame", () => {
    console.log("Start Game event received.");
    if (player1 && player2) {
      io.emit("gameStart", { gameId: new Date().getTime() }); // Broadcast game start with unique ID
    } else {
      console.log("Cannot start game, not enough players.");
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
