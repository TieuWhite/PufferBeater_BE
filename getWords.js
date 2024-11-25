const fs = require("fs");
const { faker } = require("@faker-js/faker");

const generateWords = () => {
  const uniqueWords = new Set();
  const count = 2000;

  while (uniqueWords.size < count) {
    const word = faker.word.sample();
    if (word.length >= 5 && word.length <= 10) {
      uniqueWords.add(word);
    }
  }

  return Array.from(uniqueWords).map((word) => ({ word }));
};

const words = generateWords();
fs.writeFileSync("db.json", JSON.stringify(words, null, 2), "utf-8");
console.log("Unique words saved to db.json");
