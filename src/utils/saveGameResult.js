const Result = require("../models/Result");
const User = require("../models/User");

async function saveGameResult(
  player1Id,
  player2Id,
  player1Score,
  player2Score,
  winner
) {
  try {
    const result = new Result({
      player1: player1Id,
      player2: player2Id,
      player1Score,
      player2Score,
      winner,
    });
    await result.save();
    console.log("game saved: ", result);

    await User.findByIdAndUpdate(
      player1Id,
      { $push: { matchHistory: result._id } },
      { new: true }
    );

    await User.findByIdAndUpdate(
      player2Id,
      { $push: { matchHistory: result._id } },
      { new: true }
    );
  } catch (err) {
    console.log(err);
  }
}

module.exports = { saveGameResult };
