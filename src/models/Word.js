const mongoose = require("mongoose");

const wordSchema = new mongoose.Schema({
  word: { type: String, required: true },
});

const Word = mongoose.model("Word", wordSchema);

module.exports = Word;
