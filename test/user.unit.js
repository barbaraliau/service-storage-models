'use strict';

const crypto = require('crypto');
const errors = require('storj-service-error-types');
const expect = require('chai').expect;
const mongoose = require('mongoose');
const sinon = require('sinon');
const ms = require('ms');
const Stripe = require('./../lib/vendor/stripe');

require('mongoose-types').loadTypes(mongoose);

const UserSchema = require('../lib/models/user');

var User;
var connection;

before(function(done) {
  connection = mongoose.createConnection(
    'mongodb://127.0.0.1:27017/__storj-bridge-test',
    function() {
      User = UserSchema(connection);
      done();
    }
  );
});

after(function(done) {
  User.remove({}, function() {
    connection.close(done);
  });
});

function sha256(i) {
  return crypto.createHash('sha256').update(i).digest('hex');
}

describe('Storage/models/User', function() {

  describe('#create', function() {

    it('should create the user account in inactive state', function(done) {
      User.create('user@domain.tld', sha256('password'), function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.activated).to.equal(false);
        done();
      });
    });

    it('should not create a duplicate user account', function(done) {
      User.create('user@domain.tld', sha256('password'), function(err) {
        expect(err.message).to.equal('Email is already registered');
        done();
      });
    });

    it('should not create a invalid email', function(done) {
      User.create('wrong@domain', sha256('password'), function(err) {
        expect(err.message).to.equal('User validation failed');
        done();
      });
    });

    it('should not create a user account with bad password', function(done) {
      User.create('wrong@domain.tld', 'password', function(err) {
        expect(err.message).to.equal(
          'Password must be hex encoded SHA-256 hash'
        );
        done();
      });
    });

    it('should support modern TLDs', function(done) {
      User.create('user@domain.lawyer', sha256('password'), function(err) {
        if (err) {
          return done(err);
        }
        done();
      });
    });

    it('should create user account with virtuals', function(done) {
      User.create('test@test.com', sha256('pass'), function(err, user) {
        if (err) {
          return done(err);
        }
        expect(user.defaultPaymentProcessor).to.be.null;
        expect(user.email).to.equal(user.id);
        done();
      })
    })

  });

  /* jshint ignore: start */
  /* ignoring: too many statements */
  describe('#recordDownloadBytes', function() {
    it('should record the bytes and increment existing', function(done) {
      var user = new User({
        _id: 'test@user.tld',
        hashpass: 'hashpass'
      });
      var clock = sinon.useFakeTimers();
      user.recordDownloadBytes(4096);
      expect(user.bytesDownloaded.lastHourBytes).to.equal(4096);
      expect(user.bytesDownloaded.lastDayBytes).to.equal(4096);
      expect(user.bytesDownloaded.lastMonthBytes).to.equal(4096);
      user.recordDownloadBytes(1000);
      expect(user.bytesDownloaded.lastHourBytes).to.equal(5096);
      expect(user.bytesDownloaded.lastDayBytes).to.equal(5096);
      expect(user.bytesDownloaded.lastMonthBytes).to.equal(5096);
      clock.tick(ms('1h'));
      user.recordDownloadBytes(2000);
      expect(user.bytesDownloaded.lastHourBytes).to.equal(2000);
      expect(user.bytesDownloaded.lastDayBytes).to.equal(7096);
      expect(user.bytesDownloaded.lastMonthBytes).to.equal(7096);
      clock.tick(ms('24h'));
      user.recordDownloadBytes(1000);
      expect(user.bytesDownloaded.lastHourBytes).to.equal(1000);
      expect(user.bytesDownloaded.lastDayBytes).to.equal(1000);
      expect(user.bytesDownloaded.lastMonthBytes).to.equal(8096);
      clock.tick(ms('30d'));
      user.recordDownloadBytes(5000);
      expect(user.bytesDownloaded.lastHourBytes).to.equal(5000);
      expect(user.bytesDownloaded.lastDayBytes).to.equal(5000);
      expect(user.bytesDownloaded.lastMonthBytes).to.equal(5000);
      clock.restore();
      done();
    });
  });

  describe('#isDownloadRateLimited', function() {
    let userFree = null;
    let userPaid = null;
    let clock = null;

    before(() => {
      clock = sinon.useFakeTimers();
      userFree = new User({
        _id: 'user@free.tld',
        hashpass: 'hashpass'
      });
      userPaid = new User({
        _id: 'user@paid.tld',
        hashpass: 'hashpass',
        isFreeTier: false
      });
    });
    after(() => clock.restore());

    it('should return false in paid tier', function() {
      expect(userPaid.isDownloadRateLimited(10, 20, 30)).to.equal(false);
      userPaid.recordDownloadBytes(700);
      expect(userPaid.isDownloadRateLimited(10, 20, 30)).to.equal(false);
    });

    it('should return false if under the limits', function() {
      expect(userFree.isDownloadRateLimited(10, 20, 30)).to.equal(false);
      userFree.recordDownloadBytes(10);
      clock.tick(ms('1hr'));
      expect(userFree.isDownloadRateLimited(10, 20, 30)).to.equal(false);
    });

    it('should return true if over the hourly limits', function() {
      userFree.recordDownloadBytes(10);
      expect(userFree.isDownloadRateLimited(10, 20, 30)).to.equal(true);
    });

    it('should return true if over the daily limits', function() {
      clock.tick(ms('2hr'));
      userFree.recordDownloadBytes(10);
      expect(userFree.isDownloadRateLimited(10, 20, 30)).to.equal(true);
    });

    it('should return true if over the monthly limits', function() {
      clock.tick(ms('20h'));
      userFree.recordDownloadBytes(10);
      expect(userFree.isDownloadRateLimited(10, 20, 30)).to.equal(true);
    });
  });

  describe('#recordUploadBytes', function() {

    it('should record the bytes and increment existing', function(done) {
      var user = new User({
        _id: 'test@user.tld',
        hashpass: 'hashpass'
      });
      var clock = sinon.useFakeTimers();
      user.recordUploadBytes(4096);
      expect(user.bytesUploaded.lastHourBytes).to.equal(4096);
      expect(user.bytesUploaded.lastDayBytes).to.equal(4096);
      expect(user.bytesUploaded.lastMonthBytes).to.equal(4096);
      user.recordUploadBytes(1000);
      expect(user.bytesUploaded.lastHourBytes).to.equal(5096);
      expect(user.bytesUploaded.lastDayBytes).to.equal(5096);
      expect(user.bytesUploaded.lastMonthBytes).to.equal(5096);
      clock.tick(ms('1h'));
      user.recordUploadBytes(2000);
      expect(user.bytesUploaded.lastHourBytes).to.equal(2000);
      expect(user.bytesUploaded.lastDayBytes).to.equal(7096);
      expect(user.bytesUploaded.lastMonthBytes).to.equal(7096);
      clock.tick(ms('24h'));
      user.recordUploadBytes(1000);
      expect(user.bytesUploaded.lastHourBytes).to.equal(1000);
      expect(user.bytesUploaded.lastDayBytes).to.equal(1000);
      expect(user.bytesUploaded.lastMonthBytes).to.equal(8096);
      clock.tick(ms('30d'));
      user.recordUploadBytes(5000);
      expect(user.bytesUploaded.lastHourBytes).to.equal(5000);
      expect(user.bytesUploaded.lastDayBytes).to.equal(5000);
      expect(user.bytesUploaded.lastMonthBytes).to.equal(5000);
      clock.restore();
      done();
    });

  });
  /* jshint ignore: end */

  describe('#isUploadRateLimited', function() {

    let userFree = null;
    let userPaid = null;
    let clock = null;

    before(() => {
      clock = sinon.useFakeTimers();
      userFree = new User({
        _id: 'user@free.tld',
        hashpass: 'hashpass'
      });
      userPaid = new User({
        _id: 'user@paid.tld',
        hashpass: 'hashpass',
        isFreeTier: false
      });
    });
    after(() => clock.restore());

    it('should return false in paid tier', function() {
      expect(userPaid.isUploadRateLimited(10, 20, 30)).to.equal(false);
      userPaid.recordUploadBytes(700);
      expect(userPaid.isUploadRateLimited(10, 20, 30)).to.equal(false);
    });

    it('should return false if under the limits', function() {
      expect(userFree.isUploadRateLimited(10, 20, 30)).to.equal(false);
      userFree.recordUploadBytes(10);
      clock.tick(ms('1hr'));
      expect(userFree.isUploadRateLimited(10, 20, 30)).to.equal(false);
    });

    it('should return true if over the hourly limits', function() {
      userFree.recordUploadBytes(10);
      expect(userFree.isUploadRateLimited(10, 20, 30)).to.equal(true);
    });

    it('should return true if over the daily limits', function() {
      clock.tick(ms('2hr'));
      userFree.recordUploadBytes(10);
      expect(userFree.isUploadRateLimited(10, 20, 30)).to.equal(true);
    });

    it('should return true if over the monthly limits', function() {
      clock.tick(ms('20h'));
      userFree.recordUploadBytes(10);
      expect(userFree.isUploadRateLimited(10, 20, 30)).to.equal(true);
    });
  });

  describe('#activate', function() {

    it('should activate the user account', function(done) {
      User.findOne({}, function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.activated).to.equal(false);
        user.activate(function() {
          expect(user.activated).to.equal(true);
          done();
        });
      });
    });

  });

  describe('#deactivate', function() {

    it('should activate the user account', function(done) {
      User.findOne({}, function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.activated).to.equal(true);
        user.deactivate(function() {
          expect(user.activated).to.equal(false);
          done();
        });
      });
    });

  });

  describe('#lookup', function() {

    it('should return the user account', function(done) {
      User.lookup('user@domain.tld', sha256('password'), function(err, user) {
        expect(err).to.not.be.instanceOf(Error);
        expect(user.id).to.equal('user@domain.tld');
        done();
      });
    });

    it('should give a not authorized error if user not found', function(done) {
      User.lookup('user@domain.tld', sha256('password2'), function(err) {
        expect(err).to.be.instanceOf(errors.NotAuthorizedError);
        done();
      });
    });

  });

  describe('#addPaymentProcessor', function() {
    // NB: The application uses Stripe.js to generate a token based on the CC
    // info. Stripe API does not have a way to gen a token, but does offer an
    // alternative of sending in a dictionary of CC info instead
    // https://stripe.com/docs/api/node#create_customer

    let user;
    const name = 'stripe';
    const d = new Date();
    const stripeInfo = {
      object: 'card',
      exp_month: d.getMonth() + 1,
      exp_year: d.getFullYear(),
      number: 4242424242424242
    };

    before(function(done) {
      User.create('user@paymentprocessor.tld', sha256('pass'), function(err,
      newUser) {
        if (err) {
          return done(err);
        }
        user = newUser;
        done();
      });
    })

    it('should register new processor if none exists', function(done) {
      user
        .addPaymentProcessor(name, stripeInfo)
        .then((result) => {
          expect(result.name).to.equal(name);
          expect(result.rawData).to.be.an('array');
          expect(result.default).to.be.true;
          expect(result.rawData[0].billingDate).to.equal(d.getDate());
          done();
        })
        .catch((err) => {
          if (err) {
            return done(err);
          }
        })
    });

    it('should update existing processor if one exists', function(done) {
      done()
    });

  });

});
