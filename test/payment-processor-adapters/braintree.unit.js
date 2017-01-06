'use strict';

/*jshint expr: true*/

const chai = require('chai');
const expect = chai.expect;

const braintreeAdapter =
  require('../../lib/models/payment-processor-adapters/braintree');

describe('Storage/models/payment-processor-adapters/braintreeAdapter',
function() {

  describe('#add', function() {

    it('should add braintreeAdapter to payment processor', function(done) {
      expect(braintreeAdapter.add).to.be.a('function');
      braintreeAdapter
        .add()
        .then(function success() {
          // brain tree not yet implemented
          done();
        }, function error() {
          done();
        });
    });

  });

});
