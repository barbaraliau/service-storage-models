'use strict';

let braintreeProcessor;

const braintreeAdapter = {
  add: function() {
    return new Promise((resolve, reject) => {
      return reject({
        status: 'error',
        message: 'braintree payment processor adapter not yet implemented!'
      });
    });
  },
  register: function(token, email) {
    return new Promise((resolve, reject) => {
      return resolve(true);
    });
  },
  serializeData: function(data) {
    return data;
  },
  validate: function() {
    return new Promise((resolve, reject) => {
      return resolve(true);
    });
  }
};

module.exports = function(paymentProcessor) {
  braintreeProcessor = paymentProcessor;
  return braintreeAdapter;
};
