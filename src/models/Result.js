const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  player1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  player2: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  player1Score: { type: Number, required: true },
  player2Score: { type: Number, required: true },
  winner: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const Result = mongoose.model("Result", resultSchema);

module.exports = Result;
