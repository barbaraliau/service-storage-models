'use strict';

/*jshint expr: true*/

const mongoose = require('mongoose');
const chai = require('chai');
const expect = chai.expect;
const stripeAdapter =
  require('../../lib/models/payment-processor-adapters/stripe');
const PaymentProcessorSchema = require('../../lib/models/payment-processor');

var PaymentProcessor;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017__storj-bridge-test',
    function() {
      PaymentProcessor = PaymentProcessorSchema(connection);
      done();
    }
  );
})

after(function(done) {
  PaymentProcessor.remove({}, function() {
    connection.close(done);
  });
});

// describe('Storage/models/payment-processor-adapters/stripeAdapter', function() {
//
//   describe('#serializeData', function() {
//
//     it('should serialize rawData', function(done) {
//       stripeAdapter.add()
//     });
//
//   });
//
//   describe('#parseData', function() {
//
//     it('should parse rawData', function(done) {
//
//     });
//
//   });
//
//   describe('#register', function() {
//
//     it('should use the stripe api to create customer', function(done) {
//
//     });
//
//     it('should fail without credit card token', function(done) {
//
//     });
//
//     it('should fail without user email', function(done) {
//
//     });
//
//   });
//
//   describe('#delete', function() {
//
//     it('should delete stripe customer', function(done) {
//
//     });
//   });
//
// });
