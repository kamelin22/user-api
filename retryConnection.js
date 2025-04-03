const connectWithRetry = async (callback, retries = 3) => {
    try {
      await callback();
    } catch (err) {
      if (retries > 0) {
        console.log(`Retrying... (${retries} left)`);
        setTimeout(() => connectWithRetry(callback, retries - 1), 5000);
      } else {
        throw err;
      }
    }
  };
  
  module.exports = connectWithRetry;