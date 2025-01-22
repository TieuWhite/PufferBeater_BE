require("dotenv").config();
const mongoose = require("mongoose");
const http = require("http");
const express = require("express");
const userRouter = require("./src/routes/user.api");
const wordRouter = require("./src/routes/word.api");
const resultRouter = require("./src/routes/result.api");
const { Server } = require("socket.io");
const {
  handleConnection,
  handleStartGame,
  handleScoreUpdate,
  handleDisconnection,
  handleReplayRequest,
} = require("./src/controllers/gameController");

const app = express();

const cors = require("cors");
const bodyPar = require("body-parser");
app.use(cors());
app.use(bodyPar());

app.get("/", (req, res) => {
  res.send("Hi");
});

app.use("/api/users", userRouter);
app.use("/api/words", wordRouter);
app.use("/api/results", resultRouter);

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  handleConnection(socket, io);

  socket.on("startGame", () => handleStartGame(io));
  socket.on("scoreUpdate", (data) => {
    handleScoreUpdate(io, data);
  });
  socket.on("playerLeave", () => handleDisconnection(socket, io));
  socket.on("playerReplay", () => handleReplayRequest(socket, io));
});

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    const PORT = process.env.PORT;
    server.listen(PORT, () => {
      console.log(`MongoDB is running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.log(err);
  });

app.use((err, req, res, next) => {
  console.error("Error:", err.message);
  res.status(err.status || 500).json({
    error: err.message || "Something happened...",
  });
});
