'use strict';

/*jshint expr: true*/

const crypto = require('crypto');
const mongoose = require('mongoose');
const chai = require('chai');
const expect = chai.expect;
const stripeAdapter =
  require('../../lib/models/payment-processor-adapters/stripe');
const PaymentProcessorSchema = require('../../lib/models/payment-processor');
const UserSchema = require('../../lib/models/user');
const Stripe = require('./../../lib/vendor/stripe');
const paymentProcessorAdapters = require('../../lib/models/payment-processor-adapters');

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

describe('Storage/models/payment-processor-adapters/stripeAdapter', function() {
  // create User doc to test with
  let user;
  let stripeToken;
  let stripeProcessor;
  let adapter;
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
            adapter = paymentProcessorAdapters[name](user);
            done();
          });
      });
    });
  });

  describe('#serializeData', function() {

    it('should serialize rawData', function(done) {
      console.log('stripe', stripeProcessor)
      const rawData = stripeProcessor.rawData[0];
      console.log('adapter', adapter)
      const serialized = adapter.serializeData(rawData);
      expect(serialized).to.be.an('array');
      done();
    });

  });

  describe('#parseData', function() {

    it('should parse rawData', function(done) {
      const rawData = adapter.parseData(stripeProcessor.rawData);
      expect(rawData).to.be.an('object');
      done();
    });

  });

  describe('#register', function() {

    it('should use the stripe api to create customer', function(done) {
      Stripe.tokens.create({ card: cardInfo }, function(err, token) {
        if (err) {
          return done(err);
        }
        adapter
          .register(token.id, user.email)
          .then((result) => {
            expect(result.customer).to.be.an('object');
            expect(result.customer.id).to.be.a('string');
            done();
          })
          .catch((err) => {
            if (err) {
              return done(err);
            }
          });
      })
    });

    it('should fail with duplicate credit card token', function(done) {
      adapter
        .register(stripeToken, user.email)
        .catch((err) => {
          expect(err).to.be.an.instanceOf(Error);
          done();
        });
    });

    it('should fail without valid credit card token', function(done) {
      adapter
        .register('badtoken', user.email)
        .catch((err) => {
          expect(err).to.be.an.instanceOf(Error);
          done();
        });
    });

    it('should fail without valid user email', function(done) {
      Stripe.tokens.create({ card: cardInfo }, function(err, token) {
        if (err) {
          return done(err);
        }
        adapter
          .register(token.id, 'wrong@domain')
          .catch((err) => {
            expect(err.message).to.equal('Invalid email');
            expect(err).to.be.an.instanceOf(Error);
            done();
          })
      })
    });

  });

  // describe('#delete', function() {
  //
  //   it('should delete stripe customer', function(done) {
  //
  //   });
  // });

});
