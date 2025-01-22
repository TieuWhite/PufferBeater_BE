const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  matchHistory: [{ type: mongoose.Schema.Types.ObjectId, ref: "Result" }],
});

const user = mongoose.model("User", userSchema);

module.exports = user;
