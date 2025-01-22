const { startGameTimer } = require("./timeControllers");
const { saveGameResult } = require("../utils/saveGameResult");
const User = require("../models/User");

let player1 = null;
let player2 = null;
let player1Score = 0;
let player2Score = 0;
let replayRequests = { player1: false, player2: false };
let gameInterval = null;
let gracePeriodActive = false;
let gracePeriodTimer = null;
const sessions = {};

async function handleConnection(socket, io) {
  const name = socket.handshake.query.name;

  if (!name) {
    console.log("Player name is required for connection.");
    socket.emit("error", { message: "Player name is required." });
    socket.disconnect();
    return;
  }

  try {
    const user = await User.findOne({ username: name });
    if (!user) {
      console.log(`No user found with name: ${name}`);
      socket.emit("error", { message: "User not found." });
      socket.disconnect();
      return;
    }

    const mongoUserId = user._id.toString();

    if (!player1) {
      player1 = socket.id;
      sessions[socket.id] = {
        playerNumber: 1,
        socketId: socket.id,
        mongoUserId,
      };
      console.log(
        `Player 1 connected with name: ${name}, MongoDB ID: ${mongoUserId}`
      );
      socket.emit("playerAssigned", { playerNumber: 1, mongoUserId, name });
    } else if (!player2) {
      player2 = socket.id;
      sessions[socket.id] = {
        playerNumber: 2,
        socketId: socket.id,
        mongoUserId,
      };
      console.log(
        `Player 2 connected with name: ${name}, MongoDB ID: ${mongoUserId}`
      );
      socket.emit("playerAssigned", { playerNumber: 2, mongoUserId, name });
    } else {
      console.log("Third connection rejected");
      socket.emit("full", { message: "Only two players are allowed." });
      socket.disconnect();
    }

    broadcastPlayerStatus(io);
  } catch (error) {
    console.error("Error during user lookup:", error);
    socket.emit("error", { message: "Internal server error." });
    socket.disconnect();
  }
}

function handleStartGame(io) {
  if (player1 && player2) {
    io.emit("gameStart");

    gracePeriodActive = true;
    if (gracePeriodTimer) clearTimeout(gracePeriodTimer);
    gracePeriodTimer = setTimeout(() => {
      gracePeriodActive = false;
    }, 3000);
    startGameTimer(io, () => endGame(io));
  } else {
    console.log("Cannot start game: Not enough players connected.");
  }
}

function handleScoreUpdate(io, { playerNumber, score }) {
  if (playerNumber === 1) {
    player1Score = score;
  } else if (playerNumber === 2) {
    player2Score = score;
  }

  console.log(`playerNum: ${playerNumber}`);
  console.log(`score: ${score}`);

  io.emit("scoreUpdate", { playerNumber, score });
}

function handleReplayRequest(socket, io) {
  console.log(`Replay request received from ${socket.id}`);

  if (socket.id === player1) {
    replayRequests.player1 = true;
  } else if (socket.id === player2) {
    replayRequests.player2 = true;
  }

  const replayCount = Object.values(replayRequests).filter(Boolean).length;
  io.emit("replayStatus", { replayCount });

  if (replayRequests.player1 && replayRequests.player2) {
    console.log("Both players requested a replay. Restarting game...");
    resetGameState();
    io.emit("gameRestart");
    startGameTimer(io, () => endGame(io));
  }
}

function handleDisconnection(socket, io) {
  console.log(`Client disconnected: ${socket.id}`);
  let playerNumber = null;

  // Identify which player is disconnecting
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
    console.log(`Removed session for player ${playerNumber}:`, session[0]);
  }

  if (!player1 && !player2) {
    if (gracePeriodActive) {
      console.log("Grace period active. Skipping game termination.");
      return;
    }
    console.log("Both players disconnected. Ending game...");
    clearInterval(gameInterval);
    gameInterval = null;

    io.sockets.sockets.forEach((s) => {
      s.disconnect(true);
    });

    endGame(io);
    disconnectState();
  }

  // Notify other clients about the player leaving
  io.emit("playerLeave", { playerNumber });

  // Reset game state and update player statuses
  resetGameState();
  disconnectState();
  broadcastPlayerStatus(io);

  console.log(`Player ${playerNumber} has been disconnected.`);
}

async function endGame(io) {
  const player1Id = sessions[player1]?.mongoUserId;
  const player2Id = sessions[player2]?.mongoUserId;

  console.log("Game over. Calculating results...");
  let winner = "Tie";
  if (player1Score > player2Score) {
    const player1 = await User.findById(player1Id);
    winner = player1?.username || "Unknown";
  } else if (player2Score > player1Score) {
    const player2 = await User.findById(player2Id);
    winner = player2?.username || "Unknown";
  }

  io.emit("gameOver", { player1Score, player2Score, winner });

  if (!player1Id || !player2Id) {
    console.error("Player IDs are missing. Cannot save game result.");
    return;
  }

  saveGameResult(player1Id, player2Id, player1Score, player2Score, winner);
  resetGameState();
}

function resetGameState() {
  player1Score = 0;
  player2Score = 0;
  replayRequests = { player1: false, player2: false };
  console.log("Game state reset.");
}

function disconnectState() {
  player1 = null;
  player2 = null;
}

function broadcastPlayerStatus(io) {
  io.emit("playerStatus", { player1: !!player1, player2: !!player2 });
}

module.exports = {
  handleConnection,
  handleStartGame,
  handleScoreUpdate,
  handleDisconnection,
  handleReplayRequest,
};
