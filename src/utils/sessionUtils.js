function removeSession(sessions, socketId) {
  const session = Object.entries(sessions).find(
    ([, value]) => value.socketId === socketId
  );
  if (session) delete sessions[session[0]];
}

module.exports = { removeSession };
