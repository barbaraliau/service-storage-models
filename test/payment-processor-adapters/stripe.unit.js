'use strict';

/*jshint expr: true*/

const chai = require('chai');
const expect = chai.expect;
const stripeAdapter =
  require('../../lib/models/payment-processor-adapters/stripe');

  describe('Storage/models/payment-processor-adapters/stripeAdapter',
  function() {

    describe('#serializeData', function() {

      it('should serialize rawData', function(done) {

      });

    });

    describe('#parseData', function() {

      it('should parse rawData', function(done) {

      });

    });

    describe('#register', function() {

      it('should use the stripe api to create customer', function(done) {

      });

      it('should fail without credit card token', function(done) {

      });

      it('should fail without user email', function(done) {

      });

    });

    describe('#delete', function() {

      it('should delete stripe customer', function(done) {

      });
    });

  });
