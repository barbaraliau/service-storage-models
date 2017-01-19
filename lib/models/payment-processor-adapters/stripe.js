'use strict';

const stripe = require('../../vendor/stripe');
const constants = require('../../constants');
const STRIPE_PLAN_ID = constants.STRIPE_PLAN_ID;
const { validateEmail } = require('../../utils');
const errors = require('storj-service-error-types');

let stripeProcessor;

const stripeAdapter = {
  /**
   * register - use stripe api to create customer
   * @param token {String}: credit card token returned from stripe api
   * (see https://stripe.com/docs/subscriptions/tutorial)
   * @param email {String}: email of user create customer for
   * @return {Promise}
   */
  register: function(options) {
    return new Promise((resolve, reject) => {
      if (!validateEmail(options.user.email)) {
        return reject(new errors.BadRequestError('Invalid email'));
      }
      stripe.customers.create({
        source: options.token,
        plan: STRIPE_PLAN_ID,
        email: options.user.email
      }, (err, customer) => {
        if (err) {
          return reject(new errors.InternalError(err));
        }
        return resolve({
          customer: customer,
          billingDate: (new Date()).getDate()
        });
      });
    });
  },
  /**
   * delete - delete stripe customer; Unlike other objects, deleted customers
   * can still be retrieved through the API, in order to be able to track the
   * history of customers while still removing their credit card details and
   * preventing any further operations to be performed (such as adding a new
   * subscription) https://stripe.com/docs/api/node#delete_customer
   * @param options {Object}:
   * @return {Promise}: resolves/rejects with an object with `status`
   * and `message` properties
   */
  delete: function() {
    return new Promise((resolve, reject) => {
      const customerId = stripeProcessor.customer.id;
      stripe.customers.del(
        customerId,
        (err, confirmation) => {
          if (!err && confirmation.deleted) {
            return resolve('User successfully deleted');
          }

          if (err.statusCode === 404) {
            return reject(new errors.BadRequestError(err.message));
          }

          return reject(new errors.InternalError(err.message));
        });
    });
  },
  /**
   * cancel - cancel stripe subscription
   * @return {Promise}
   */
  cancel: function() {
    return new Promise((resolve, reject) => {
      const subscriptionId = stripeProcessor.customer.subscriptions.data[0].id;

      stripe.subscriptions.del(
        subscriptionId,
        (err, confirmation) => {
          console.log('err', err);
          console.log('conf', confirmation);

          if (!err && confirmation.status === 'canceled') {
            return resolve(confirmation);
          }

          if (err.statusCode === 404) {
            return reject(new errors.BadRequestError(err.message));
          }

          return reject(new errors.InternalError(err.message));

        });
    });
  },
  /**
   * isSubscribed - returns true if the user has a subscription to
   * the stripe plan with id of `STRIPE_PLAN_ID`
   * @return {Boolean}
   */
  validate: function() {
    return new Promise((resolve, reject) => {
      const subscriptions = stripeProcessor.customer.subscriptions.data;

      if (subscriptions.data[0].plan.id !== STRIPE_PLAN_ID) {
        return reject('Customer is subscribed to unknown plan!');
      }

      if (subscriptions.length === 1) {
        return resolve(true);
      }

      if (subscriptions.length > 1) {
        return reject('Customer has more than one stripe subscription!');
      }

      if (subscriptions.length < 1) {
        return reject('Customer has no stripe subscriptions');
      }

      return reject('Unknown error');
    });
  },
  /**
   * addPaymentMethod - add a credit card to the users stripe customer
   * @param options {Object}:
   *   + data {String}: stripe credit card token
   *     (see https://stripe.com/docs/subscriptions/tutorial)
   *   + user {User}: the current `User` instance for the request
   * @return {Promise}: resolves/rejects with an object with `status`
   * and `message` properties
   */
  addPaymentMethod: function(data) {
    const customerId = stripeProcessor.customer.id;

    return new Promise((resolve, reject) => {
      stripe.customers.createSource(
        customerId,
        { source: data.token },
        function(err) {
          if (err) {
            return reject(err);
          }

          stripe.customers.retrieve(customerId, function(err, customer) {
            if (err) {
              return reject(err);
            }
            stripeProcessor.customer = customer;
            return resolve(stripeProcessor);
          });

        }
      );
    });
  },
  /**
   * charge - add an inventory item to the subscription's current
   * billing cycle
   * (see https://stripe.com/docs/subscriptions/guide#adding-invoice-items)
   * @param options {Object}:
   *   + data {String}: stripe credit card token
   *     (see https://stripe.com/docs/subscriptions/tutorial)
   *   + user {User}: the current `User` instance for the request
   * @return {Promise}
   */
  charge: function() {
    throw new Error('stripe charge method not yet implemented');
  },

  defaultPaymentMethod: function() {
    if (stripeProcessor.customer.sources.data[0]) {
      const source = stripeProcessor.customer.sources.data[0];
      return {
        id: source.id,
        merchant: source.brand,
        lastFour: source.last4
      };
    }
    return null;
  },

  paymentMethods: function() {
    return stripeProcessor.customer.sources.data;
  }

};

module.exports = function(paymentProcessor) {
  stripeProcessor = paymentProcessor;
  return stripeAdapter;
};
