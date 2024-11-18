const express = require("express");
const Game = require("../models/Game");
const User = require("../models/User");
const Word = require("../models/Word");

const router = express.Router();

router.post("/start", async (req, res) => {
  try {
    const { userId, difficulty } = req.body;

    const user = await User.findById(userId);
    if (!user) return res.status(404).send("User not found");
    let word;
    if (difficulty === "easy") {
      word = await Word.aggregate([{ $sample: { size: 1 } }]);
    } else if (difficulty === "medium") {
      word = await Word.aggregate([
        { $match: { word: { $exists: true, $not: { $size: 0 } } } },
        { $sample: { size: 1 } },
      ]);
    } else if (difficulty === "hard") {
      word = await Word.aggregate([
        { $match: { word: { $exists: true, $not: { $size: 0 } } } },
        { $sample: { size: 1 } },
      ]);
    }

    if (!word || word.length === 0)
      return res.status(404).send("No word found for difficulty");

    const newGame = new Game({
      player1: userId,
      gameMode: "solo",
      difficulty,
      createdUser: userId,
    });

    await newGame.save();

    res.status(201).send({ gameId: newGame._id, word: word[0].word });
  } catch (error) {
    res.status(500).send("Server error");
  }
});

module.exports = router;
