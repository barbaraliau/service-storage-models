'use strict';

let herokuProcessor;

const herokuAdapter = {
  register: function() {
    return Promise.resolve();
  },
  serializeData: function() {
    return [];
  }
};

module.exports = function(paymentProcessor) {
  herokuProcessor = paymentProcessor;
  return herokuAdapter;
}
