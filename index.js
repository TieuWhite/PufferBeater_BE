require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { v4: uuidv4 } = require("uuid");
const Word = require("./src/models/Word");
const Result = require("./src/models/Result");
const bodyPar = require("body-parser");

const app = express();
const server = http.createServer(app);

app.use(cors());
app.use(bodyPar());

const userRouter = require("./routes/user.api");
app.use("/api", userRouter);

// Endpoint to get random words
app.get("/random-words", async (req, res) => {
  try {
    const randomWord = await Word.aggregate([{ $sample: { size: 200 } }]);
    res.status(200).json(randomWord);
  } catch (err) {
    res.status(404).json(err);
  }
});

app.get("/");

// Connect to MongoDB and start the server
// mongoose
//   .connect(process.env.MONGO_URI)
//   .then(() => {
//     console.log("Successfully connected to MongoDB");
//     const PORT = process.env.PORT;
//     server.listen(PORT, () => {
//       console.log(`Server is running on port ${PORT}`);
//     });
//   })
//   .catch((err) => {
//     console.log(err);
//   });

const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

let player1 = null;
let player2 = null;
let player1Score = 0;
let player2Score = 0;
let replayRequests = { player1: false, player2: false };
let currentGameId = null;
let gameDuration = 30;
let gameInterval = null;
let gameEnded = false;
let gracePeriodActive = false;
let gracePeriodTimer = null;
const sessions = {};

// Broadcast current player status to all clients
function broadcastPlayerStatus() {
  io.emit("playerStatus", {
    player1: player1 !== null,
    player2: player2 !== null,
  });
}

function startGameTimer(io) {
  let remainingTime = gameDuration;
  console.log(`Timer started with ${remainingTime} seconds.`);
  if (gameInterval) {
    clearInterval(gameInterval);
    gameInterval = null;
    console.log("Cleared previous game interval.");
  }

  gameInterval = setInterval(() => {
    if (remainingTime >= 0) {
      console.log(`Remaining time: ${remainingTime}`);
      io.emit("timeUpdate", { remainingTime });
      remainingTime--;
    } else {
      clearInterval(gameInterval);
      gameInterval = null;
      console.log("Timer expired. Ending game...");
      gameEnded = true;
      endGame(io);
      gameEnded = false;
    }
  }, 1000);
}

function endGame(io) {
  console.log("Game over. Calculating results...");

  const winner =
    player1Score > player2Score
      ? "Player 1"
      : player2Score > player1Score
      ? "Player 2"
      : "It's a tie!";

  io.emit("gameOver", {
    player1Score,
    player2Score,
    winner,
  });

  if (gameEnded) {
    saveGameResult(currentGameId, player1Score, player2Score, winner)
      .then(() => console.log("Game result saved successfully"))
      .catch((err) => console.error("Error saving game result:", err));

    currentGameId = null; // Reset game ID after saving
  }

  player1Score = 0;
  player2Score = 0;
  replayRequests = { player1: false, player2: false };
}

const saveGameResult = async (gameId, player1Score, player2Score, winner) => {
  console.log(
    `Saving game result: gameId=${gameId}, P1=${player1Score}, P2=${player2Score}, Winner=${winner}`
  );
  try {
    // Check if the gameId already exists
    const existingResult = await Result.findOne({ gameId });
    if (existingResult) {
      console.log(`Result for gameId ${gameId} already exists.`);
      return; // Skip saving to avoid duplication
    }

    const result = new Result({
      gameId,
      player1Score,
      player2Score,
      winner,
    });
    await result.save();
    console.log("Game result saved successfully:", result);
  } catch (error) {
    if (error.code === 11000) {
      console.error("Duplicate gameId detected during save.");
    } else {
      console.error("Error saving game result:", error);
    }
  }
};

io.on("connection", (socket) => {
  const sessionId = uuidv4(); // Generate a unique session ID
  console.log(`New client connected: ${socket.id}, Session ID: ${sessionId}`);

  socket.emit("sessionIdAssigned", { sessionId });

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

  // Handle start game event
  socket.on("startGame", () => {
    console.log("Start Game event received.");
    if (player1 && player2) {
      const gameId = new Date().getTime().toString();
      io.emit("gameStart", { gameId });
      currentGameId = gameId;
      console.log("Game started with ID:", gameId);

      // Activate grace period for 5 seconds
      gracePeriodActive = true;
      if (gracePeriodTimer) clearTimeout(gracePeriodTimer);
      gracePeriodTimer = setTimeout(() => {
        gracePeriodActive = false;
        console.log(
          "Grace period ended. Disconnections will now trigger endGame."
        );
      }, 3000);

      startGameTimer(io);
    } else {
      console.log("Cannot start game: Not enough players connected.");
    }
  });

  // Handle Score Updates
  socket.on("scoreUpdate", ({ playerNumber, score }) => {
    console.log(`Player ${playerNumber} updated their score to ${score}`);
    if (playerNumber === 1) {
      player1Score = score;
    } else if (playerNumber === 2) {
      player2Score = score;
    }
    io.emit("scoreUpdate", { playerNumber, score });
  });

  // Handle manual player leave
  socket.on("playerLeave", async () => {
    console.log(`Player leave request received from ${socket.id}`);

    let playerNumber = null;

    if (socket.id === player1) {
      playerNumber = 1;
      player1 = null;
      replayRequests.player1 = false;
    } else if (socket.id === player2) {
      playerNumber = 2;
      player2 = null;
      replayRequests.player2 = false;
    }

    // Remove session mapping
    const session = Object.entries(sessions).find(
      ([, value]) => value.socketId === socket.id
    );
    if (session) {
      delete sessions[session[0]];
    }

    // End the game if no players remain
    if (!player1 && !player2 && currentGameId) {
      console.log("Both players left the game. Ending game...");
      clearInterval(gameInterval);
      gameInterval = null;
      gameEnded = true;

      endGame(io);
    }

    // Notify both players to leave the game
    io.emit("playerLeave", { playerNumber });
    // Notify about replay reset
    io.emit("replayStatus", { replayCount: 0 });

    player1Score = 0;
    player2Score = 0;

    broadcastPlayerStatus();
  });

  // Handle replay requests
  socket.on("playerReplay", async () => {
    console.log(`Replay request received from ${socket.id}`);

    if (socket.id === player1) {
      replayRequests.player1 = true;
    } else if (socket.id === player2) {
      replayRequests.player2 = true;
    }

    const replayCount = Object.values(replayRequests).filter(Boolean).length;
    io.emit("replayStatus", { replayCount });
    console.log(`Replay requests: ${replayCount}/2`);

    // If both players request a replay
    if (replayRequests.player1 && replayRequests.player2) {
      console.log("Both players requested a replay. Ending current game...");

      clearInterval(gameInterval);
      gameInterval = null;
      gameEnded = true;

      endGame(io, currentGameId);

      // Reset the game state for the new match
      currentGameId = new Date().getTime().toString();
      replayRequests = { player1: false, player2: false };
      player1Score = 0;
      player2Score = 0;

      // Notify players about the new game
      io.emit("gameRestart", { gameId: currentGameId });
      console.log(`Game restarted with new gameId: ${currentGameId}`);

      // Start a fresh timer for the new game
      startGameTimer(io);
    }
  });

  // Handle disconnection
  socket.on("disconnect", async () => {
    console.log(`Client disconnected: ${socket.id}`);

    let playerNumber = null;

    // Identify the disconnected player
    if (socket.id === player1) {
      console.log("Player 1 disconnected");
      playerNumber = 1;
      player1 = null;
      replayRequests.player1 = false;
    } else if (socket.id === player2) {
      console.log("Player 2 disconnected");
      playerNumber = 2;
      player2 = null;
      replayRequests.player2 = false;
    }

    // Remove session mapping
    const session = Object.entries(sessions).find(
      ([, value]) => value.socketId === socket.id
    );
    if (session) {
      delete sessions[session[0]];
    }

    // End the game if both players are disconnected
    if (!player1 && !player2 && currentGameId) {
      if (gracePeriodActive) {
        console.log("Grace period active. Skipping endGame for now.");
        return;
      }

      console.log("Both players disconnected. Ending game...");
      clearInterval(gameInterval);
      gameInterval = null;
      endGame(io);
    }
    if (playerNumber) {
      io.emit("playerDisconnected", { playerNumber });

      const replayCount = Object.values(replayRequests).filter(Boolean).length;
      io.emit("replayStatus", { replayCount });

      broadcastPlayerStatus();

      console.log(`Player ${playerNumber} replay request cleared.`);
    }
  });
});
