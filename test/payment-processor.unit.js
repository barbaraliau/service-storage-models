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
  const d = new Date();
  const name = 'stripe';
  const cardInfo = {
    exp_month: d.getMonth() + 1,
    exp_year: d.getFullYear(),
    number: 4242424242424242
  };

  before(function(done) {
    User.create('payment@domain.tld', sha256('pass'), function(err, newUser) {
      if (err) {
        return done(err);
      }
      user = newUser;
      done();
    });
  });

  describe('#create', function() {

    it('should create a new PaymentProcessor', function(done) {
      // Stub out test token for Stripe stuff
      Stripe.tokens.create({ card: cardInfo }, function(err, token) {
        if (err) {
          return done(err);
        }
        PaymentProcessor
          .create({ name , user, token: token.id })
          .then((result) => {
            expect(result.user).to.equal(user.email);
            expect(result.default).to.equal(name);
            expect(result.stripe.billingDate).to.equal(d.getDate());
            expect(result.stripe.customer.email).to.equal(user.email);
            done();
          })
          .catch((err) => {
            if (err) {
              return done(err);
            }
          })
        });
    });

    it('should fail if no email is passed in', function(done) {
      PaymentProcessor
        .create({ name , user: {} })
        .catch((err) => {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.statusCode).to.equal(400);
          expect(err.message).to.equal('Must pass in valid email');
          done();
        })
    });

    it('should fail with invalid processor name', function(done) {
      const invalidName = 'invalidProcessorName';
      PaymentProcessor
        .create({ name: invalidName, user })
        .catch((err) => {
          expect(err).to.be.an.instanceOf(Error);
          expect(err.statusCode).to.equal(400);
          expect(err.message).to.equal(
            `${invalidName} payment processor is not supported / invalid name`
          );
          done();
        })
    });

    it('should fail if processor already exists', function(done) {
      User.create('payMe@domain.tld', sha256('pass'), function(err, user) {
        if (err) {
          return done(err);
        }
        PaymentProcessor
          .create({ name, user })
          .then(() => {
            PaymentProcessor
              .create({ name, user })
              .then()
              .catch((err) => {
                expect(err).to.be.an.instanceOf(Error);
                expect(err.code).to.equal(400);
                expect(err.message).to.equal(
                  'Cannot create stripe processor. Processor already exists'
                )
                done();
              })
          })
        })
    });

  });

});

describe('#get', function() {

});
  //
  // describe('#virtuals', function() {
  //
  //   it('should return correct billing date', function(done) {
  //     User.findOne({ _id: user.email }, function(err, res) {
  //       if (err) {
  //         return done(err);
  //       }
  //       expect(res.defaultPaymentProcessor.billingDate).to.equal(d.getDate());
  //       done();
  //     });
  //   });
  //
  //   it('should return correct paymentMethods', function(done) {
  //     User.findOne({ _id: user.email }, function(err, res) {
  //       if (err) {
  //         return done(err);
  //       }
  //       const converted = cardInfo.number.toString().split('');
  //       const last4 = converted
  //         .slice(converted.length - 4, converted.length)
  //         .join('');
  //
  //       const paymentMethod = res.defaultPaymentProcessor.paymentMethods[0];
  //       expect(paymentMethod.last4).to.equal(last4);
  //       expect(paymentMethod.exp_year).to.equal(cardInfo.exp_year);
  //       expect(paymentMethod.exp_month).to.equal(cardInfo.exp_month);
  //       done();
  //     });
  //   });
  //
  //   it('should return defaultPaymentMethod', function(done) {
  //     User.findOne({ _id: user.email }, function(err, res) {
  //       if (err) {
  //         return done(err);
  //       }
  //       const converted = cardInfo.number.toString().split('');
  //       const last4 = converted
  //         .slice(converted.length - 4, converted.length)
  //         .join('');
  //       const paymentMethod = res.defaultPaymentProcessor.defaultPaymentMethod;
  //       expect(paymentMethod.lastFour).to.equal(last4);
  //       done();
  //     });
  //   });
  //
  // });
  //
  // describe('PaymentProcessors', function() {
  //
  //   let user;
  //   let stripeToken;
  //   const name = 'stripe';
  //   const d = new Date();
  //
  //   before(function(done) {
  //     User.create('user@paymentprocessor2.tld', sha256('pass'), function(err,
  //     newUser) {
  //       if (err) {
  //         return done(err);
  //       }
  //       user = newUser;
  //
  //       // Stub out test token for Stripe stuff
  //       const cardInfo = {
  //         exp_month: d.getMonth() + 1,
  //         exp_year: d.getFullYear(),
  //         number: 4242424242424242
  //       };
  //       Stripe.tokens.create({ card: cardInfo }, function(err, token) {
  //         if (err) {
  //           return done(err);
  //         }
  //         stripeToken = token.id;
  //         done();
  //       });
  //     });
  //   });
  //
  //   describe('#addPaymentProcessor', function() {
  //
  //     it('should register new processor if none exists', function(done) {
  //       user
  //         .addPaymentProcessor(name, stripeToken)
  //         .then((result) => {
  //           expect(result.name).to.equal(name);
  //           expect(result.rawData).to.be.an('array');
  //           expect(result.default).to.be.true;
  //           expect(result.rawData[0].billingDate).to.equal(d.getDate());
  //           done();
  //         })
  //         .catch((err) => done(err));
  //     });
  //
  //     it('should fail if processor already exists', function(done) {
  //       try {
  //         user.addPaymentProcessor(name, stripeToken);
  //       } catch(err) {
  //         expect(err).to.be.an.instanceOf(Error);
  //         expect(err.message).to.equal(
  //           `${name} PaymentProcessor already exists`
  //         );
  //         done();
  //       }
  //     });
  //
  //     it('should fail if processor is invalid', function(done) {
  //       try {
  //         user.addPaymentProcessor('invalid')
  //       } catch(err) {
  //         expect(err).to.be.an.instanceOf(Error);
  //         expect(err.message).to.equal(`invalid PaymentProcessor is invalid`);
  //         done();
  //       }
  //     });
  //
  //   });
  //
  //   describe('#getPaymentProcessor', function() {
  //
  //     it('should return payment processor if it exists', function(done) {
  //       const processor = user.getPaymentProcessor(name);
  //       expect(processor.name).to.equal(name);
  //       done();
  //     });
  //
  //     it('should return ! if payment processor does not exist', function(done) {
  //       const processor = user.getPaymentProcessor('braintree');
  //       expect(processor).to.be.undefined;
  //       done();
  //     });
  //
  //   });
  //
  // });
