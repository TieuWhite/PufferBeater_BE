function startGameTimer(io, onTimerEnd) {
  let remainingTime = 15; // Set game duration
  console.log("Game timer started.");

  const gameInterval = setInterval(() => {
    if (remainingTime >= 0) {
      io.emit("timeUpdate", { remainingTime });
      remainingTime--;
    } else {
      onTimerEnd();
      clearInterval(gameInterval);
    }
  }, 1000);

  return gameInterval;
}

module.exports = { startGameTimer };
