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
  }
};

module.exports = function(paymentProcessor) {
  braintreeProcessor = paymentProcessor;
  return braintreeAdapter;
};
