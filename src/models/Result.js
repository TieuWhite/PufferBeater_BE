const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  gameId: { type: String, required: true, unique: true },
  player1Score: { type: Number, required: true },
  player2Score: { type: Number, required: true },
  winner: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Result = mongoose.model("Result", resultSchema);

module.exports = Result;
