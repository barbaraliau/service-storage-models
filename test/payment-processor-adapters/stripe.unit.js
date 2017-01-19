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

// describe('Storage/models/payment-processor-adapters/stripeAdapter', function() {
//   // create User doc to test with
//   let user;
//   let stripeToken;
//   let stripeProcessor;
//   let adapter;
//   const d = new Date();
//   const name = 'stripe';
//   const cardInfo = {
//     exp_month: d.getMonth() + 1,
//     exp_year: d.getFullYear(),
//     number: 4242424242424242
//   };
//
//   before(function(done) {
//     User.create('user@paymentprocessor.tld', sha256('pass'),
//     function(err, newUser) {
//       if (err) {
//         return done(err);
//       }
//       user = newUser;
//
//       // Stub out test token for Stripe stuff
//       Stripe.tokens.create({ card: cardInfo }, function(err, token) {
//         if (err) {
//           return done(err);
//         }
//         stripeToken = token.id;
//         PaymentProcessor
//           .create({ name: 'stripe', user, token: stripeToken })
//           .then((processor) => {
//             adapter = processor.adapter('stripe');
//             done()
//           });
//       });
//     });
//   });


  // describe('#register', function() {
  //
  //   it('should use the stripe api to create customer', function(done) {
  //     Stripe.tokens.create({ card: cardInfo }, function(err, token) {
  //       if (err) {
  //         return done(err);
  //       }
  //       adapter
  //         .register(token.id, user.email)
  //         .then((result) => {
  //           expect(result.customer).to.be.an('object');
  //           expect(result.customer.id).to.be.a('string');
  //           done();
  //         })
  //         .catch((err) => {
  //           if (err) {
  //             return done(err);
  //           }
  //         });
  //     })
  //   });
  //
  //   it('should fail with duplicate credit card token', function(done) {
  //     adapter
  //       .register(stripeToken, user.email)
  //       .catch((err) => {
  //         expect(err).to.be.an.instanceOf(Error);
  //         done();
  //       });
  //   });
  //
  //   it('should fail without valid credit card token', function(done) {
  //     adapter
  //       .register('badtoken', user.email)
  //       .catch((err) => {
  //         expect(err).to.be.an.instanceOf(Error);
  //         done();
  //       });
  //   });
  //
  //   it('should fail without valid user email', function(done) {
  //     Stripe.tokens.create({ card: cardInfo }, function(err, token) {
  //       if (err) {
  //         return done(err);
  //       }
  //       adapter
  //         .register(token.id, 'wrong@domain')
  //         .catch((err) => {
  //           expect(err.message).to.equal('Invalid email');
  //           expect(err).to.be.an.instanceOf(Error);
  //           done();
  //         })
  //     })
  //   });
  //
  // });
  //
  // describe('#delete', function() {
  //
  //   it('should delete stripe customer', function(done) {
  //     console.log('adapter', adapter)
  //     User.findOne({ _id: user.email }, function(err, user) {
  //       const stripeAdapter = paymentProcessorAdapters[name](user);
  //
  //       stripeAdapter
  //         .delete()
  //         .then((result) => {
  //           expect(result).to.equal('User successfully deleted');
  //           done();
  //         });
  //     })
  //
  //   });

    // it('should fail with invalid customer id', function(done) {
    //   const newUser = {
    //     data: {
    //       customer: {
    //         id: 'not-a-real-customer-id-123'
    //       }
    //     }
    //   };
    //   adapter
    //     .delete(newUser)
    //     .catch((err) => {
    //       expect(err).to.be.an.instanceOf(Error);
    //       expect(err.message).to.equal(
    //         `No such customer: ${newUser.data.customer.id}`
    //       );
    //       done();
    //     });
    // });
    //
    // it('should fail with null customer id passed in', function(done) {
    //   adapter
    //     .delete(user)
    //     .catch((err) => {
    //       expect(err).to.be.an.instanceOf(Error);
    //       done();
    //     });
    // });
  // });

  // describe('#cancel', function() {
  //
  //   it('should cancel a stripe subscription', function(done) {
  //     Stripe.subscriptions.list({ limit: 1 }, function(err, subscriptions) {
  //       const subscriptionId = subscriptions.data[0].id;
  //       adapter
  //         .cancel(subscriptionId)
  //         .then((result) => {
  //           expect(result.id).to.equal(subscriptionId);
  //           expect(result.status).to.equal('canceled');
  //           done();
  //         });
  //     });
  //   });
  //
  //   it('should fail with invalid subscription id', function(done) {
  //     const subscriptionId = 'blah-blah-blah_id';
  //     adapter
  //       .cancel(subscriptionId)
  //       .catch((err) => {
  //         expect(err).to.be.an.instanceOf(Error);
  //         expect(err.message)
  //           .to.equal(`No such subscription: ${subscriptionId}`);
  //         done();
  //       });
  //   });
  //
  //   it('should fail with null subscription id', function(done) {
  //     const subscriptionId = null;
  //     adapter
  //       .cancel(subscriptionId)
  //       .catch((err) => {
  //         expect(err).to.be.an.instanceOf(Error);
  //         done();
  //       });
  //   })
  //
  // });
// });
