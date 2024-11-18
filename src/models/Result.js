const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema({
  player1Score: { type: Number, required: true },
  gameId: { type: mongoose.Schema.Types.ObjectId, ref: "Game", required: true },
});

const Result = mongoose.model("Result", resultSchema);

module.exports = Result;
