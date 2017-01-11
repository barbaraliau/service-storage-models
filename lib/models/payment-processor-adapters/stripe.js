'use strict';

const stripe = require('../../vendor/stripe');
const constants = require('../../constants');
const STRIPE_PLAN_ID = constants.STRIPE_PLAN_ID;
const { validateEmail } = require('../../utils');
const errors = require('storj-service-error-types');

let stripeProcessor;

const stripeAdapter = {
  /**
   * setData - format `rawData` in terms of the
   * `User#PaymentProcessors[n]#data` array
   * @param rawData {Object}:
   *   + customer {Object}: stripe customer object
   *   (used to determine the billing cycle for the subscription)
   * @return {Array}
   */
  serializeData: function(rawData) {
    if (!rawData) {
      return new errors.BadRequestError('rawData is not defined');
    }
    return [rawData];
  },

  /**
   * setData - format `rawData` in terms of the
   * `User#PaymentProcessors[n]#data` array
   * @param rawData {array}
   * @return {Object}
   */
  parseData: function(rawData) {
    if (!rawData) {
      return new errors.BadRequestError('rawData must be an Array')
    }
    return rawData[0];
  },
  /**
   * register - use stripe api to create customer
   * @param token {String}: credit card token returned from stripe api
   * (see https://stripe.com/docs/subscriptions/tutorial)
   * @param email {String}: email of user create customer for
   * @return {Promise}
   */
  register: function(token, email) {
    return new Promise((resolve, reject) => {
      if (!validateEmail(email)) {
        return reject(new errors.BadRequestError('Invalid email'));
      }
      stripe.customers.create({
        source: token,
        plan: STRIPE_PLAN_ID,
        email: email
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
  delete: function(stripeCustomerId) {
    return new Promise((resolve, reject) => {
      stripe.customers.del(
        stripeCustomerId,
        (err, confirmation) => {
          if (!err && confirmation.deleted) {
            return resolve('User successfully deleted')
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
  cancel: function(subscriptionId) {
    return new Promise((resolve, reject) => {
      const stripeCustomer = stripeProcessor.data.customer;
      const subscriptionId = stripeCustomer.subscriptions.data[0].id;
      stripe.subscriptions.del(
        subscriptionId,
        (err, cancelledSubscription) => {
          if (err) {
            return reject(new Error(err));
          }

          if (cancelledSubscription.status !== 'cancelled') {
            return reject(new Error(
                'stripe couldn\'t cancel the subscription: ' + subscriptionId
            ));
          }

          return resolve();
        });
    });
  },
  /**
   * isSubscribed - returns true if the user has a subscription to
   * the stripe plan with id of `STRIPE_PLAN_ID`
   * @return {Boolean}
   */
  validate: function(stripeProcessor) {
    const subscriptions = stripeProcessor.data.customer.subscriptions;

    if (subscriptions.length > 1) {
      let msg = 'Customer has more than one stripe subscription!';
      return Promise.reject(new Error(msg));
    }

    if (subscriptions.length < 1) {
      return Promise.resolve(false);
    }

    if (subscriptions.data[0].plan.id !== STRIPE_PLAN_ID) {
      let msg = 'Customer is subscribed to unknown plan!';
      return Promise.reject(new Error(msg));
    }

    return Promise.resolve(true);
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
  addPaymentMethod: function(token) {
    const customerId = stripeProcessor.data.customer.id;

    return new Promise((resolve, reject) => {
      stripe.customers.createSource(
        customerId,
        { source: token },
        function(err) {
          if (err) {
            return reject(err);
          }

          // retrieve customer
          stripe.customers.retrieve(customerId, function(err, customer) {
            stripeProcessor.data.customer = customer;
            return resolve(stripeProcessor.update(stripeProcessor));
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
    if (stripeProcessor.data.customer.sources.data[0]) {
      const source = stripeProcessor.data.customer.sources.data[0];
      return {
        id: source.id,
        merchant: source.brand,
        lastFour: source.last4
      };
    }
    return null;
  },
  billingDate: function() {
    return stripeProcessor.data.billingDate;
  },

  paymentMethods: function() {
    return stripeProcessor.data.customer.sources.data;
  }

};

module.exports = function(paymentProcessor) {
  stripeProcessor = paymentProcessor;
  return stripeAdapter;
};
