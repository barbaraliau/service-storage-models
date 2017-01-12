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
const paymentProcessorAdapters = require('./../lib/models/payment-processor-adapters');
const Stripe = require('./../lib/vendor/stripe');

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

  // create User doc to test with
  let user;
  let stripeToken;
  let stripeProcessor;
  const d = new Date();
  const name = 'stripe';
  const cardInfo = {
    exp_month: d.getMonth() + 1,
    exp_year: d.getFullYear(),
    number: 4242424242424242
  };

  before(function(done) {
    User.create('user@paymentprocessor.tld', sha256('pass'),
    function(err, newUser) {
      if (err) {
        return done(err);
      }
      user = newUser;

      // Stub out test token for Stripe stuff
      Stripe.tokens.create({ card: cardInfo }, function(err, token) {
        if (err) {
          return done(err);
        }
        stripeToken = token.id;
        user
          .addPaymentProcessor(name, stripeToken)
          .then((result) => {
            stripeProcessor = result;
            done();
          });
      });
    });
  });

  describe('#virtuals', function() {

    it('should return correct billing date', function(done) {
      User.findOne({ _id: user.email }, function(err, res) {
        if (err) {
          return done(err);
        }
        expect(res.defaultPaymentProcessor.billingDate).to.equal(d.getDate());
        done();
      });
    });

    it('should return correct paymentMethods', function(done) {
      User.findOne({ _id: user.email }, function(err, res) {
        if (err) {
          return done(err);
        }
        const converted = cardInfo.number.toString().split('');
        const last4 = converted
          .slice(converted.length - 4, converted.length)
          .join('');

        const paymentMethod = res.defaultPaymentProcessor.paymentMethods[0];
        expect(paymentMethod.last4).to.equal(last4);
        expect(paymentMethod.exp_year).to.equal(cardInfo.exp_year);
        expect(paymentMethod.exp_month).to.equal(cardInfo.exp_month);
        done();
      });
    });

    it('should return defaultPaymentMethod', function(done) {
      User.findOne({ _id: user.email }, function(err, res) {
        if (err) {
          return done(err);
        }
        const converted = cardInfo.number.toString().split('');
        const last4 = converted
          .slice(converted.length - 4, converted.length)
          .join('');
        const paymentMethod = res.defaultPaymentProcessor.defaultPaymentMethod;
        expect(paymentMethod.lastFour).to.equal(last4);
        done();
      });
    });

  });

});
