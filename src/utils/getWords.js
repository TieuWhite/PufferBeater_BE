const fs = require("fs");
const { faker } = require("@faker-js/faker");

const generateWords = () => {
  const uniqueWords = new Set();
  const count = 100;

  while (uniqueWords.size < count) {
    const word = faker.word.sample();
    if (word.length >= 5 && word.length <= 15) {
      uniqueWords.add(word);
    }
  }

  return Array.from(uniqueWords).map((word) => ({ word }));
};

module.exports = { generateWords };
