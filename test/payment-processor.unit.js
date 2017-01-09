'use strict';

/*jshint expr: true*/

const mongoose = require('mongoose');
const crypto = require('crypto');
const chai = require('chai');
const expect = chai.expect;
const UserSchema = require('../lib/models/user');
const PaymentProcessorSchema = require('../lib/models/payment-processor');
const constants = require('../lib/constants');
const PAYMENT_PROCESSORS = constants.PAYMENT_PROCESSORS;

var PaymentProcessor;
var User;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017__storj-bridge-test',
    function() {
      PaymentProcessor = PaymentProcessorSchema(connection);
      User = UserSchema(connection);
      done();
    }
  );
})

after(function(done) {
  PaymentProcessor.remove({}, function() {
    User.remove({}, function() {
      connection.close(done);
    })
  });
});

function sha256(i) {
  return crypto.createHash('sha256').update(i).digest('hex');
}

describe('Storage/models/payment-processor', function() {

  describe('#toObject', function() {

    it('should modify object returned', function(done) {
      User.create('user@domain.tld', sha256('password'), function(err, user) {
        if (err) {
          return done(err);
        }
        console.log('user', user)
        done();
      })
    });

  });

});
