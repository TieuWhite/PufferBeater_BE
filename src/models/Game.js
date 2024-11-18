const mongoose = require("mongoose");
const { Schema } = mongoose;

const gameSchema = new Schema({
  gameId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  player1: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  gameMode: { type: String, enum: ["solo"], required: true },
  difficulty: {
    type: String,
    enum: ["easy", "medium", "hard"],
    required: true,
  },
  startDate: { type: Date, default: Date.now },
  createdUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

const Game = mongoose.model("Game", gameSchema);

module.exports = Game;
